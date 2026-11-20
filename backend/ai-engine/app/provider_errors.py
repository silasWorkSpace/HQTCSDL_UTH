from fastapi import HTTPException

from app.llm.base import LlmProviderError


def provider_http_exception(error: LlmProviderError) -> HTTPException:
    """Map a sanitized upstream provider failure to a gateway response."""
    return HTTPException(status_code=502, detail=str(error))
