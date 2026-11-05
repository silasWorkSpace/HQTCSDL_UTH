from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal, Optional


EntityKind = Literal["class", "method", "endpoint", "parameter"]


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
