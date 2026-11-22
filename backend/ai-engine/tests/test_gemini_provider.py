import io
import json
from urllib.error import HTTPError, URLError

import pytest
from app.llm.base import LlmProviderError
from app.llm.gemini_provider import GeminiProvider, _gemini_response_schema
from app.provider_errors import provider_http_exception


class FakeResponse:
    def __init__(self, payload):
        self.payload = json.dumps(payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return self.payload


def _draft_response(file_path, entity_name, commit_sha):
    draft = {
        "document_title": "Analysis Run Retrieval",
        "doc_type": "MODULE_GUIDE",
        "markdown_content": "# Analysis Run Retrieval\n\nReads an analysis run by its identifier.",
        "sections": [{
            "section_key": "behavior",
            "section_title": "Retrieval behavior",
            "content": "Reads the run record for the supplied identifier.",
            "confidence": 0.9,
            "evidence": [],
        }],
        "overall_confidence": 0.9,
        "evidence_list": [{"source_file": file_path, "entity_name": entity_name}],
        "source_files": [file_path],
        "code_entity_references": [{
            "name": entity_name, "kind": "method", "file_path": file_path,
            "line_start": 10, "line_end": 20,
        }],
        "commit_reference": commit_sha,
    }
    return {"candidates": [{"content": {"parts": [{"text": json.dumps(draft)}]}}]}


def _entities():
    return [{
        "id": "entity-1",
        "name": "AnalysisRunService.get",
        "kind": "method",
        "file_path": "src/AnalysisRunService.java",
        "line_start": 10,
        "line_end": 20,
        "signature": "public AnalysisRunResponse get(UUID runId)",
        "snippet": "return findRun(runId);",
    }]


def _assert_no_default_keyword(value):
    if isinstance(value, dict):
        assert "default" not in value
        for item in value.values():
            _assert_no_default_keyword(item)
    elif isinstance(value, list):
        for item in value:
            _assert_no_default_keyword(item)


def test_schema_uses_gemini_supported_json_schema_without_defaults():
    schema = _gemini_response_schema()

    _assert_no_default_keyword(schema)
    assert schema["type"] == "object"
    assert "properties" in schema
    assert "$defs" in schema


def test_provider_defaults_to_current_stable_model(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-gemini-secret-value")
    monkeypatch.delenv("GEMINI_MODEL", raising=False)

    assert GeminiProvider().model_name in ("gemini-2.5-flash", "gemini-3.5-flash-lite")


def test_generate_doc_uses_api_key_header_and_response_json_schema(monkeypatch):
    secret = "test-gemini-secret-value"
    commit_sha = "a" * 40
    file_path = _entities()[0]["file_path"]
    monkeypatch.setenv("GEMINI_API_KEY", secret)
    captured = {}

    def fake_urlopen(request, timeout):
        captured["request"] = request
        captured["timeout"] = timeout
        return FakeResponse(_draft_response(file_path, "AnalysisRunService.get", commit_sha))

    monkeypatch.setattr("app.llm.gemini_provider.urlopen", fake_urlopen)
    draft = GeminiProvider().generate_doc(
        _entities(),
        {"name": "Analysis Run Retrieval", "doc_type": "MODULE_GUIDE"},
        {"commit_sha": commit_sha},
    )

    request = captured["request"]
    body = json.loads(request.data)
    generation_config = body["generationConfig"]
    assert request.full_url.endswith(":generateContent")
    assert secret not in request.full_url
    assert request.get_header("X-goog-api-key") == secret
    assert "responseJsonSchema" in generation_config
    assert "responseSchema" not in generation_config
    _assert_no_default_keyword(generation_config["responseJsonSchema"])
    assert draft.commit_reference == commit_sha
    assert draft.markdown_content.startswith("# Analysis Run Retrieval")
    assert draft.evidence_list[0].entity_name == "AnalysisRunService.get"


def test_http_error_is_reported_with_safe_code_and_redacted_key(monkeypatch):
    secret = "test-gemini-secret-value"
    monkeypatch.setenv("GEMINI_API_KEY", secret)
    body = json.dumps({"error": {
        "code": 400,
        "status": "INVALID_ARGUMENT",
        "message": f"Invalid key={secret}; responseJsonSchema.default is unsupported",
    }}).encode("utf-8")
    error = HTTPError("https://example.invalid/generateContent", 400, "Bad Request", {}, io.BytesIO(body))
    monkeypatch.setattr("app.llm.gemini_provider.urlopen", lambda *_args, **_kwargs: (_ for _ in ()).throw(error))

    with pytest.raises(LlmProviderError) as caught:
        GeminiProvider().generate_doc(_entities(), {"name": "Guide"})

    assert caught.value.upstream_status == 400
    assert caught.value.provider_code == "INVALID_ARGUMENT"
    assert caught.value.retryable is False
    assert "INVALID_ARGUMENT" in str(caught.value)
    assert secret not in str(caught.value)


def test_network_error_does_not_echo_url_or_credentials(monkeypatch):
    secret = "test-gemini-secret-value"
    monkeypatch.setenv("GEMINI_API_KEY", secret)
    monkeypatch.setattr(
        "app.llm.gemini_provider.urlopen",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(URLError(f"failed https://example.invalid?key={secret}")),
    )

    with pytest.raises(LlmProviderError) as caught:
        GeminiProvider().generate_doc(_entities(), {"name": "Guide"})

    assert "temporarily unreachable" in str(caught.value)
    assert secret not in str(caught.value)
    assert "example.invalid" not in str(caught.value)


def test_ai_generate_endpoint_maps_provider_failure_to_502(monkeypatch):
    error = LlmProviderError(
        "Gemini request rejected with HTTP 400 (INVALID_ARGUMENT)",
        upstream_status=400,
        provider_code="INVALID_ARGUMENT",
    )

    response_error = provider_http_exception(error)

    assert response_error.status_code == 502
    assert "INVALID_ARGUMENT" in response_error.detail
