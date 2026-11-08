import pytest
from app.llm.secret_masker import mask_secrets, contains_secret
from app.llm.mock_provider import MockProvider
from app.llm.factory import get_llm_provider
from app.llm.schemas import DocDraft

def test_secret_masker_detection_and_redaction():
    text_with_api_key = "Setting api_key: AIzaSyD34908fakexyztoken123 for service."
    text_with_bearer = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secretpayload.sig"
    text_with_pwd = 'database password="SuperSecretPassword123!"'
    text_clean = "This is a normal function comment describing a user service."

    assert contains_secret(text_with_api_key) is True
    assert contains_secret(text_with_bearer) is True
    assert contains_secret(text_with_pwd) is True
    assert contains_secret(text_clean) is False

    masked_key = mask_secrets(text_with_api_key)
    assert "***MASKED***" in masked_key
    assert "AIzaSyD34908" not in masked_key

    masked_bearer = mask_secrets(text_with_bearer)
    assert "Bearer ***MASKED***" in masked_bearer

    masked_pwd = mask_secrets(text_with_pwd)
    assert "***MASKED***" in masked_pwd
    assert "SuperSecretPassword123!" not in masked_pwd

    # Clean text unchanged
    assert mask_secrets(text_clean) == text_clean

def test_mock_provider_generation_schema_and_confidence():
    provider = MockProvider()
    entities = [
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "name": "UserController",
            "kind": "class",
            "file_path": "src/controllers/UserController.java",
            "line_start": 10,
            "line_end": 50,
            "snippet": "public class UserController { ... }"
        },
        {
            "id": "22222222-2222-2222-2222-222222222222",
            "name": "getUserById",
            "kind": "endpoint",
            "file_path": "src/controllers/UserController.java",
            "line_start": 20,
            "line_end": 35,
            "snippet": "public UserResponse getUserById(UUID id) { ... }"
        }
    ]
    template = {
        "name": "API Reference",
        "doc_type": "API_REFERENCE",
        "sections": [
            {"key": "overview", "title": "Overview", "required": True},
            {"key": "endpoints", "title": "Endpoints", "required": True, "entity_kind": "endpoint"}
        ]
    }
    options = {"commit_sha": "abc123456"}

    draft: DocDraft = provider.generate_doc(entities, template, options)

    assert isinstance(draft, DocDraft)
    assert draft.document_title == "API Reference"
    assert draft.doc_type == "API_REFERENCE"
    assert draft.commit_reference == "abc123456"
    assert len(draft.sections) == 2
    assert draft.overall_confidence > 0.8
    assert "src/controllers/UserController.java" in draft.source_files

    # Check section confidences & evidence
    sec_overview = draft.sections[0]
    assert 0.0 <= sec_overview.confidence <= 1.0
    sec_endpoints = draft.sections[1]
    assert "getUserById" in sec_endpoints.content

def test_mock_provider_deterministic_output():
    provider1 = MockProvider()
    provider2 = MockProvider()

    entities = [
        {"name": "AuthService", "kind": "class", "file_path": "src/services/AuthService.java"}
    ]
    template = {"name": "Module Guide", "doc_type": "MODULE_GUIDE"}

    result1 = provider1.generate_doc(entities, template, {"commit_sha": "def456"})
    result2 = provider2.generate_doc(entities, template, {"commit_sha": "def456"})

    assert result1.markdown_content == result2.markdown_content
    assert result1.overall_confidence == result2.overall_confidence

def test_factory_default_provider():
    provider = get_llm_provider()
    assert isinstance(provider, MockProvider)
    with pytest.raises(ValueError):
        get_llm_provider("unsupported_provider")
