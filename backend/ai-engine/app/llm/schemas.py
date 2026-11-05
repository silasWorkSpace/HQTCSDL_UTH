from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class CodeEntityRef(BaseModel):
    id: Optional[str] = None
    name: str
    kind: str  # class, method, endpoint, parameter, module, file
    file_path: str
    line_start: Optional[int] = None
    line_end: Optional[int] = None

class Evidence(BaseModel):
    source_file: str
    entity_name: Optional[str] = None
    entity_kind: Optional[str] = None
    line_range: Optional[str] = None
    snippet: Optional[str] = None

class SectionDraft(BaseModel):
    section_key: str
    section_title: str
    content: str
    confidence: float = Field(ge=0.0, le=1.0, description="Section confidence score from 0.0 to 1.0")
    evidence: List[Evidence] = Field(default_factory=list)

class DocDraft(BaseModel):
    document_title: str
    doc_type: str = "README"
    markdown_content: str
    sections: List[SectionDraft] = Field(default_factory=list)
    overall_confidence: float = Field(ge=0.0, le=1.0)
    evidence_list: List[Evidence] = Field(default_factory=list)
    source_files: List[str] = Field(default_factory=list)
    code_entity_references: List[CodeEntityRef] = Field(default_factory=list)
    commit_reference: Optional[str] = None

