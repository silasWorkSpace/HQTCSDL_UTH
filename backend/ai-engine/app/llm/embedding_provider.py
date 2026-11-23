"""Provider abstraction for text and code embeddings."""
from __future__ import annotations

import hashlib
import json
import math
import os
from abc import ABC, abstractmethod
from typing import List
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from app.llm.base import LlmProviderError


class EmbeddingProvider(ABC):
    @abstractmethod
    def embed_text(self, text: str) -> List[float]:
        pass

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return [self.embed_text(t) for t in texts]


class DeterministicFakeEmbeddingProvider(EmbeddingProvider):
    """
    Deterministic fake provider for fast, reliable unit/integration testing without external APIs.
    Generates consistent float vectors using sha256 hashes.
    """
    def __init__(self, dimension: int = 16):
        self.dimension = dimension

    def embed_text(self, text: str) -> List[float]:
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        # Derive float values from bytes
        raw_vec = []
        for i in range(self.dimension):
            byte_idx = i % len(digest)
            val = (digest[byte_idx] - 128.0) / 128.0
            raw_vec.append(val)
        # Normalize vector
        magnitude = math.sqrt(sum(x * x for x in raw_vec)) or 1.0
        return [round(x / magnitude, 6) for x in raw_vec]


class GeminiEmbeddingProvider(EmbeddingProvider):
    """
    Gemini embedding provider using text-embedding-004.
    """
    def __init__(self, api_key: str | None = None, model_name: str | None = None):
        self.api_key = (api_key if api_key is not None else os.getenv("GEMINI_API_KEY", "")).strip()
        self.model_name = model_name or os.getenv("GEMINI_EMBEDDING_MODEL", "text-embedding-004")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is required for Gemini embedding provider")

    def embed_text(self, text: str) -> List[float]:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:embedContent"
        )
        body = {
            "model": f"models/{self.model_name}",
            "content": {"parts": [{"text": text[:2000]}]}
        }
        req = Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json", "x-goog-api-key": self.api_key},
            method="POST"
        )
        try:
            with urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            return data["embedding"]["values"]
        except HTTPError as exc:
            raise LlmProviderError(f"Gemini embedding API error: {exc.code}", upstream_status=exc.code) from exc
        except Exception as exc:
            raise LlmProviderError(f"Gemini embedding failed: {exc}") from exc


def get_embedding_provider() -> EmbeddingProvider:
    provider = os.getenv("EMBEDDING_PROVIDER", "").strip().lower()
    if provider == "gemini":
        return GeminiEmbeddingProvider()
    return DeterministicFakeEmbeddingProvider()
