import pytest
from app.drift.models import CodeEntity, EntityKind
from app.drift.semantic import (
    DeterministicFakeSemanticProvider,
    GeminiSemanticProvider,
    get_semantic_provider,
)


def test_deterministic_fake_semantic_provider():
    provider = DeterministicFakeSemanticProvider(confidence=0.88)
    e1 = CodeEntity(
        qualified_name="com.test.Service.doWork",
        kind=EntityKind.METHOD,
        name="doWork",
        body_hash="hash_v1",
    )
    e2 = CodeEntity(
        qualified_name="com.test.Service.doWork",
        kind=EntityKind.METHOD,
        name="doWork",
        body_hash="hash_v2",
    )
    e_same = CodeEntity(
        qualified_name="com.test.Service.doWork",
        kind=EntityKind.METHOD,
        name="doWork",
        body_hash="hash_v1",
    )

    verdict = provider.assess(e1, e2)
    assert verdict is not None
    assert verdict.confidence == 0.88
    assert "doWork" in verdict.reason
    assert verdict.grounded_evidence["old_body_hash"] == "hash_v1"
    assert verdict.grounded_evidence["new_body_hash"] == "hash_v2"

    assert provider.assess(e1, e_same) is None


def test_gemini_semantic_provider_requires_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(ValueError, match="GEMINI_API_KEY is required"):
        GeminiSemanticProvider(api_key=None)


def test_get_semantic_provider_defaults_to_fake(monkeypatch):
    monkeypatch.delenv("SEMANTIC_PROVIDER", raising=False)
    provider = get_semantic_provider()
    assert isinstance(provider, DeterministicFakeSemanticProvider)
