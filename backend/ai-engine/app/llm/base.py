from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from app.llm.schemas import DocDraft

class LlmProvider(ABC):
    """
    Unified abstract interface for LLM providers.
    Supports swap-in of real LLMs (Gemini, OpenAI, etc.) in the future without changing business logic.
    """

    @abstractmethod
    def generate_doc(
        self,
        entities: List[Dict[str, Any]],
        template: Dict[str, Any],
        options: Optional[Dict[str, Any]] = None
    ) -> DocDraft:
        """
        Generates a document draft based on code entities, template structure, and generation options.
        """
        pass

