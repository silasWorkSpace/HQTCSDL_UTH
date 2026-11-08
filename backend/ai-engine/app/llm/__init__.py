from app.llm.base import LlmProvider
from app.llm.mock_provider import MockProvider
from app.llm.schemas import DocDraft, SectionDraft, Evidence, CodeEntityRef
from app.llm.secret_masker import mask_secrets, contains_secret
from app.llm.factory import get_llm_provider

def generate_doc(
    entities: list,
    template: dict,
    options: dict = None
) -> DocDraft:
    """
    Standard top-level contract function for document generation (SRS contract).
    Usage: llm.generate_doc(entities, template, options) -> DocDraft
    """
    provider = get_llm_provider()
    return provider.generate_doc(entities, template, options)

__all__ = [
    "LlmProvider",
    "MockProvider",
    "DocDraft",
    "SectionDraft",
    "Evidence",
    "CodeEntityRef",
    "mask_secrets",
    "contains_secret",
    "get_llm_provider",
    "generate_doc"
]

