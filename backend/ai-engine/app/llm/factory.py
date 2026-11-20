import os
from typing import Optional
from app.llm.base import LlmProvider
from app.llm.mock_provider import MockProvider
from app.llm.gemini_provider import GeminiProvider

def get_llm_provider(
    provider_name: Optional[str] = None,
    model_name: Optional[str] = None
) -> LlmProvider:
    """
    Factory to retrieve configured LlmProvider.
    Mock generation is available only when explicitly selected for tests.
    """
    selected_provider = (provider_name or os.getenv("LLM_PROVIDER", "gemini")).lower()
    selected_model = model_name or os.getenv("GEMINI_MODEL", os.getenv("LLM_MODEL", "gemini-3.5-flash-lite"))

    if selected_provider == "mock":
        return MockProvider(model_name=selected_model)
    
    if selected_provider == "gemini":
        return GeminiProvider(model_name=selected_model)
    raise ValueError(f"Unsupported LLM provider: {selected_provider}")

