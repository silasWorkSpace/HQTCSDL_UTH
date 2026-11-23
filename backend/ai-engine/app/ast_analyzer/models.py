from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal, Optional


EntityKind = Literal["class", "method", "endpoint", "parameter"]

UUID_NAMESPACE_CODE_ENTITY = uuid.UUID("a3b8c2d1-4e5f-6a7b-8c9d-0e1f2a3b4c5d")


def generate_entity_id(
    repository_id: Optional[str],
    commit_hash: str,
    file_path: str,
    kind: str,
    name: str,
    signature: Optional[str] = None,
    parent_id: Optional[str] = None,
    index: Optional[int] = None,
) -> str:
    """Sinh UUIDv5 xác định (deterministic) từ thuộc tính đặc trưng của thực thể mã nguồn."""
    parts = [
        str(repository_id or ""),
        str(commit_hash or ""),
        str(file_path or ""),
        str(parent_id or ""),
        str(kind or ""),
        str(name or ""),
        str(signature or ""),
    ]
    if index is not None:
        parts.append(str(index))
    return str(uuid.uuid5(UUID_NAMESPACE_CODE_ENTITY, ":".join(parts)))


@dataclass
class CodeEntity:
    name: str
    kind: EntityKind
    file_path: str
    commit_hash: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    repository_id: Optional[str] = None
    parent_id: Optional[str] = None
    signature: Optional[str] = None
    removed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "repository_id": self.repository_id,
            "parent_id": self.parent_id,
            "kind": self.kind,
            "name": self.name,
            "signature": self.signature,
            "file_path": self.file_path,
            "commit_hash": self.commit_hash,
            "removed_at": self.removed_at.isoformat() if self.removed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
