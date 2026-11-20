import pytest
from app.llm.embedding_provider import (
    DeterministicFakeEmbeddingProvider,
    GeminiEmbeddingProvider,
    get_embedding_provider,
)


def test_deterministic_fake_embedding_provider():
    provider = DeterministicFakeEmbeddingProvider(dimension=16)
    vec1 = provider.embed_text("hello world")
    vec2 = provider.embed_text("hello world")
    vec3 = provider.embed_text("another text")

    assert len(vec1) == 16
    assert vec1 == vec2
    assert vec1 != vec3
    # Check normalization: sum of squares ~= 1.0
    magnitude_sq = sum(x * x for x in vec1)
    assert 0.99 <= magnitude_sq <= 1.01


def test_gemini_embedding_provider_requires_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(ValueError, match="GEMINI_API_KEY is required"):
        GeminiEmbeddingProvider(api_key=None)


def test_get_embedding_provider_defaults_to_fake(monkeypatch):
    monkeypatch.delenv("EMBEDDING_PROVIDER", raising=False)
    provider = get_embedding_provider()
    assert isinstance(provider, DeterministicFakeEmbeddingProvider)
