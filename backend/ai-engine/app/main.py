from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.llm.factory import get_llm_provider
from app.llm.schemas import DocDraft

app = FastAPI(title="LivingDocs AI Engine", version="1.0.0")

class GenerateRequest(BaseModel):
    entities: List[Dict[str, Any]]
    template: Dict[str, Any]
    options: Optional[Dict[str, Any]] = None

@app.get("/health")
def health():
    return {"status": "UP", "service": "ai-engine"}

@app.post("/api/v1/llm/generate", response_model=DocDraft)
def generate_document(req: GenerateRequest):
    provider = get_llm_provider()
    return provider.generate_doc(req.entities, req.template, req.options)

