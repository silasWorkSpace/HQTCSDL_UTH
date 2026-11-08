import os
from typing import Optional
from app.llm.base import LlmProvider
from app.llm.mock_provider import MockProvider

def get_llm_provider(
    provider_name: Optional[str] = None,
    model_name: Optional[str] = None
) -> LlmProvider:
    """
    Factory to retrieve configured LlmProvider.
    Defaults to MockProvider for offline / local testing without external API credentials.
    """
    selected_provider = provider_name or os.getenv("LLM_PROVIDER", "mock").lower()
    selected_model = model_name or os.getenv("LLM_MODEL", "mock-model-v1")

    if selected_provider == "mock":
        return MockProvider(model_name=selected_model)
    
    # Future providers (e.g., gemini, openai) will be plugged here
    raise ValueError(f"Unsupported or unconfigured LLM provider: {selected_provider}. Only 'mock' is active this sprint.")

