"""Gemini implementation of the document-generation provider contract."""
from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from app.llm.base import LlmProvider, LlmProviderError
from app.llm.schemas import DocDraft
from app.llm.secret_masker import contains_secret, mask_secrets


def _gemini_response_schema() -> Dict[str, Any]:
    """Return the Pydantic draft contract using Google's supported JSON Schema subset."""
    def strip_unsupported_defaults(value: Any) -> Any:
        if isinstance(value, dict):
            return {key: strip_unsupported_defaults(item)
                    for key, item in value.items() if key != "default"}
        if isinstance(value, list):
            return [strip_unsupported_defaults(item) for item in value]
        return value

    return strip_unsupported_defaults(DocDraft.model_json_schema())


def _safe_provider_message(message: str, api_key: str) -> str:
    safe = message.replace(api_key, "[REDACTED]") if api_key else message
    safe = re.sub(r"(?i)([?&]key=)[^&\s]+", r"\1[REDACTED]", safe)
    safe = re.sub(r"(?i)\b(api[_-]?key|authorization|bearer|token)\b\s*[:=]\s*[^,\s;]+",
                  r"\1=[REDACTED]", safe)
    safe = re.sub(r"\bAQ\.[A-Za-z0-9._-]{16,}\b|\bAIza[0-9A-Za-z_-]{20,}\b",
                  "[REDACTED]", safe)
    return safe[:300]


def _provider_error_details(error: HTTPError, api_key: str) -> tuple[str | None, str]:
    try:
        payload = json.loads(error.read().decode("utf-8"))
        detail = payload.get("error") or {}
        code = detail.get("status") or detail.get("reason")
        message = detail.get("message") or "Gemini rejected the generation request"
    except (UnicodeDecodeError, json.JSONDecodeError, AttributeError, TypeError):
        code = None
        message = "Gemini rejected the generation request"
    safe_code = re.sub(r"[^A-Za-z0-9_.-]", "", str(code or ""))[:80] or None
    return safe_code, _safe_provider_message(str(message), api_key)


class GeminiProvider(LlmProvider):
    def __init__(self, api_key: str | None = None, model_name: str | None = None):
        self.api_key = (api_key if api_key is not None else os.getenv("GEMINI_API_KEY", "")).strip()
        self.model_name = model_name or os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is required when LLM_PROVIDER=gemini")

    def generate_doc(self, entities: List[Dict[str, Any]], template: Dict[str, Any],
                     options: Optional[Dict[str, Any]] = None) -> DocDraft:
        # Only allow evidence to originate from parser output. Do not let the model
        # invent paths, symbols, line ranges, or snippets.
        safe_entities = []
        allowed_refs: set[tuple[str, str]] = set()
        for entity in entities:
            safe = {k: entity.get(k) for k in (
                "id", "name", "kind", "file_path", "line_start", "line_end", "signature", "snippet"
            ) if entity.get(k) is not None}
            safe = {k: (mask_secrets(v) if isinstance(v, str) else v) for k, v in safe.items()}
            safe_entities.append(safe)
            if safe.get("file_path") and safe.get("name"):
                allowed_refs.add((str(safe["file_path"]), str(safe["name"])))
        prompt = {
            "task": "Write documentation grounded only in supplied parsed code entities.",
            "rules": [
                "Return JSON matching the requested schema.",
                "Every evidence item must exactly reference a supplied file_path and entity name.",
                "Do not invent behavior, APIs, line numbers, snippets, or code entities.",
                "If evidence is insufficient, say so in the section content and use an empty evidence list.",
            ],
            "entities": safe_entities,
            "template": template,
            "options": options or {},
        }
        schema = _gemini_response_schema()
        url = ("https://generativelanguage.googleapis.com/v1beta/models/"
               f"{quote(self.model_name, safe='')}:generateContent")
        body = {
            "contents": [{"role": "user", "parts": [{"text": json.dumps(prompt, ensure_ascii=False)}]}],
            "generationConfig": {"responseMimeType": "application/json", "responseJsonSchema": schema},
        }
        request = Request(url, data=json.dumps(body).encode("utf-8"),
                          headers={"Content-Type": "application/json", "x-goog-api-key": self.api_key},
                          method="POST")
        try:
            with urlopen(request, timeout=45) as response:
                response_body = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            code, message = _provider_error_details(exc, self.api_key)
            suffix = f" ({code})" if code else ""
            raise LlmProviderError(
                f"Gemini request rejected with HTTP {exc.code}{suffix}: {message}",
                upstream_status=exc.code,
                provider_code=code,
                retryable=exc.code == 429 or exc.code >= 500,
            ) from None
        except (URLError, TimeoutError):
            raise LlmProviderError("Gemini provider is temporarily unreachable") from None
        try:
            text = response_body["candidates"][0]["content"]["parts"][0]["text"]
            draft = DocDraft.model_validate_json(text)
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise LlmProviderError("Gemini returned a malformed document draft",
                                   provider_code="INVALID_RESPONSE") from None

        evidence_items = list(draft.evidence_list)
        for section in draft.sections:
            evidence_items.extend(section.evidence)
        for evidence in evidence_items:
            if evidence.entity_name and (evidence.source_file, evidence.entity_name) not in allowed_refs:
                raise LlmProviderError("Gemini evidence references an entity outside the analyzed source context",
                                       provider_code="INVALID_EVIDENCE")
            if evidence.line_range and evidence.entity_name:
                entity = next((e for e in safe_entities if e.get("file_path") == evidence.source_file
                               and e.get("name") == evidence.entity_name), None)
                expected = (f"{entity['line_start']}-{entity['line_end']}"
                            if entity and entity.get("line_start") and entity.get("line_end") else None)
                if expected != evidence.line_range:
                    raise LlmProviderError("Gemini evidence contains an unsupported line range",
                                           provider_code="INVALID_EVIDENCE")
            if evidence.snippet:
                entity = next((e for e in safe_entities if e.get("file_path") == evidence.source_file
                               and e.get("name") == evidence.entity_name), None)
                if not entity:
                    raise LlmProviderError("Gemini evidence snippet is not present in the analyzed source",
                                           provider_code="INVALID_EVIDENCE")
                snippet_source = entity.get("snippet")
                sig_source = entity.get("signature")
                if snippet_source:
                    if evidence.snippet not in str(snippet_source):
                        raise LlmProviderError("Gemini evidence snippet is not present in the analyzed source",
                                               provider_code="INVALID_EVIDENCE")
                elif sig_source:
                    if evidence.snippet not in str(sig_source) and str(sig_source) not in evidence.snippet:
                        evidence.snippet = str(sig_source)
        if contains_secret(draft.markdown_content):
            raise LlmProviderError("Gemini output contains a value matching a secret pattern",
                                   provider_code="SECRET_DETECTED")
        return draft
