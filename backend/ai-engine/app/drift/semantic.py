"""Kiểm tra Semantic drift (DR-04). Hỗ trợ Gemini thực tế và Fake provider cho testing."""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, Protocol
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

from app.drift.models import CodeEntity
from app.llm.base import LlmProviderError
from app.llm.secret_masker import mask_secrets


@dataclass(frozen=True)
class SemanticVerdict:
    reason: str
    confidence: float
    grounded_evidence: Dict[str, Any] | None = None
    model_provider: str | None = None
    insufficient_evidence: bool = False


class SemanticProvider(Protocol):
    def assess(self, old: CodeEntity, new: CodeEntity) -> SemanticVerdict | None: ...


class DeterministicFakeSemanticProvider:
    """
    Deterministic provider for automated testing without calling external LLM APIs.
    Flags semantic drift when body_hash changes while public signature remains identical.
    """
    def __init__(self, confidence: float = 0.40):
        self._confidence = max(0.0, min(1.0, confidence))

    def assess(self, old: CodeEntity, new: CodeEntity) -> SemanticVerdict | None:
        if old.body_hash and new.body_hash and old.body_hash != new.body_hash:
            reason = (
                f"Phần thân của `{new.short_name}` đã thay đổi hành vi logic trong khi chữ ký giữ nguyên, "
                "mô tả trong tài liệu có thể không còn đúng."
            )
            evidence = {
                "entity": new.qualified_name,
                "file": new.file_path,
                "old_body_hash": old.body_hash,
                "new_body_hash": new.body_hash,
            }
            return SemanticVerdict(
                reason=reason,
                confidence=self._confidence,
                grounded_evidence=evidence,
                model_provider="deterministic-fake",
                insufficient_evidence=False,
            )
        return None


class GeminiSemanticProvider:
    """
    Production semantic drift assessment powered by Google Gemini.
    Strictly validates grounded evidence and clamps confidence scores.
    """
    def __init__(self, api_key: str | None = None, model_name: str | None = None):
        self.api_key = (api_key if api_key is not None else os.getenv("GEMINI_API_KEY", "")).strip()
        self.model_name = model_name or os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is required when SEMANTIC_PROVIDER=gemini")

    def assess(self, old: CodeEntity, new: CodeEntity) -> SemanticVerdict | None:
        if not old.body_hash or not new.body_hash or old.body_hash == new.body_hash:
            return None

        prompt = {
            "task": "Assess whether semantic/behavioral drift occurred between the two entity versions.",
            "instructions": [
                "Only declare drift if the business logic or contract changed meaningfully.",
                "If evidence is insufficient to conclude, set insufficientEvidence to true.",
                "Confidence must be a float between 0.0 and 1.0.",
                "Mask any sensitive tokens or secrets.",
            ],
            "entity": new.short_name,
            "qualified_name": new.qualified_name,
            "file": new.file_path,
            "old_signature": old.signature or old.short_name,
            "new_signature": new.signature or new.short_name,
            "old_body_summary": mask_secrets(str(old.body_hash)),
            "new_body_summary": mask_secrets(str(new.body_hash)),
        }

        schema = {
            "type": "object",
            "properties": {
                "drift": {"type": "boolean"},
                "reason": {"type": "string"},
                "confidence": {"type": "number"},
                "insufficientEvidence": {"type": "boolean"},
            },
            "required": ["drift", "reason", "confidence"],
        }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{quote(self.model_name, safe='')}:generateContent"
        body = {
            "contents": [{"role": "user", "parts": [{"text": json.dumps(prompt, ensure_ascii=False)}]}],
            "generationConfig": {"responseMimeType": "application/json", "responseJsonSchema": schema},
        }

        req = Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json", "x-goog-api-key": self.api_key},
            method="POST",
        )

        try:
            with urlopen(req, timeout=30) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
            text = resp_data["candidates"][0]["content"]["parts"][0]["text"]
            res = json.loads(text)
        except Exception as exc:
            raise LlmProviderError(f"Gemini semantic assessment failed: {exc}") from exc

        if not res.get("drift") or res.get("insufficientEvidence"):
            return None

        confidence = max(0.0, min(1.0, float(res.get("confidence", 0.5))))
        reason = mask_secrets(str(res.get("reason", "Semantic drift detected in code entity logic.")))

        return SemanticVerdict(
            reason=reason,
            confidence=round(confidence, 2),
            grounded_evidence={"entity": new.qualified_name, "file": new.file_path},
            model_provider=f"gemini/{self.model_name}",
            insufficient_evidence=False,
        )


MockSemanticProvider = DeterministicFakeSemanticProvider


def get_semantic_provider() -> SemanticProvider:
    provider = os.getenv("SEMANTIC_PROVIDER", "").strip().lower()
    if provider == "gemini":
        return GeminiSemanticProvider()
    return DeterministicFakeSemanticProvider()
