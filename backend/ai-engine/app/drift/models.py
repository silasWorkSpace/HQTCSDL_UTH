"""Kiểu dữ liệu của module drift (DR-02, 03, 05, 06, 08, 13).

Đây là hợp đồng với `ast_analyzer` (đầu vào CodeEntity) và với workflow-service
(đầu ra DriftFinding trong message DRIFT_FOUND).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Mapping


class EntityKind(str, Enum):
    CLASS = "class"
    METHOD = "method"
    ENDPOINT = "endpoint"


class DriftType(str, Enum):
    REFERENTIAL = "referential"
    SIGNATURE = "signature"
    SEMANTIC = "semantic"


class Severity(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"

    @property
    def rank(self) -> int:
        return _ORDER.index(self)

    def lowered(self) -> "Severity":
        return _ORDER[max(0, self.rank - 1)]


_ORDER = [Severity.LOW, Severity.MEDIUM, Severity.HIGH, Severity.CRITICAL]


def _get(d: Mapping[str, Any], *keys: str, default: Any = None) -> Any:
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return default


@dataclass(frozen=True)
class CodeEntity:
    """Một thực thể mã (class, method, endpoint) do ast_analyzer trả về."""

    qualified_name: str
    kind: EntityKind
    file_path: str = ""
    params: tuple[tuple[str, str], ...] = ()
    return_type: str | None = None
    parent: str | None = None
    is_public: bool = True
    http_method: str | None = None
    route: str | None = None
    body_hash: str | None = None  # chỉ cần cho kiểm tra Semantic
    # Hai trường lấy trực tiếp từ bảng code_entity (name, signature):
    name: str | None = None        # tên ngắn; nếu thiếu thì lấy phần cuối của qualified_name
    signature: str | None = None   # chuỗi ký hiệu nguyên bản, dùng khi chưa có params/return_type

    @property
    def short_name(self) -> str:
        return self.name or self.qualified_name.rsplit(".", 1)[-1]

    @property
    def signature_key(self) -> tuple:
        """Phần quyết định chữ ký công khai. Đổi file không tính là drift."""
        return (
            self.kind.value,
            self.parent,
            self.params,
            self.return_type,
            self.http_method,
            self.route,
            self.signature,
        )

    @classmethod
    def from_dict(cls, d: Mapping[str, Any]) -> "CodeEntity":
        raw_params = _get(d, "params", "parameters", default=[])
        params = []
        for p in raw_params:
            if isinstance(p, Mapping):
                params.append((str(p.get("name", "")), str(p.get("type", ""))))
            else:
                params.append((str(p[0]), str(p[1])))
        return cls(
            qualified_name=_get(d, "qualified_name", "qualifiedName"),
            kind=EntityKind(_get(d, "kind")),
            file_path=_get(d, "file_path", "filePath", default=""),
            params=tuple(params),
            return_type=_get(d, "return_type", "returnType"),
            parent=_get(d, "parent", "parent_name", "parentName"),
            is_public=bool(_get(d, "is_public", "isPublic", default=True)),
            http_method=_get(d, "http_method", "httpMethod"),
            route=_get(d, "route", "path"),
            body_hash=_get(d, "body_hash", "bodyHash"),
            name=_get(d, "name"),
            signature=_get(d, "signature"),
        )


@dataclass(frozen=True)
class DocLink:
    """Liên kết tài liệu với thực thể code (bảng doc_code_link)."""

    doc_id: str
    entity_qualified_name: str
    section: str | None = None

    @classmethod
    def from_dict(cls, d: Mapping[str, Any]) -> "DocLink":
        return cls(
            doc_id=str(_get(d, "doc_id", "docId")),
            entity_qualified_name=_get(
                d, "entity_qualified_name", "entityQualifiedName", "qualified_name", "qualifiedName"
            ),
            section=_get(d, "section"),
        )


@dataclass(frozen=True)
class Suggestion:
    text: str
    confidence: float  # 0..1 (DR-08)


@dataclass(frozen=True)
class DriftFinding:
    finding_id: str
    doc_id: str
    drift_type: DriftType
    severity: Severity
    entity: str
    kind: EntityKind
    sections: tuple[str, ...]
    message: str
    evidence: dict = field(default_factory=dict)  # {"old": str|None, "new": str|None}
    suggestion: Suggestion | None = None

    def to_payload(self) -> dict:
        """Dạng JSON (camelCase) đưa vào payload của DRIFT_FOUND."""
        return {
            "findingId": self.finding_id,
            "docId": self.doc_id,
            "driftType": self.drift_type.value,
            "severity": self.severity.value,
            "entity": self.entity,
            "kind": self.kind.value,
            "sections": list(self.sections),
            "message": self.message,
            "evidence": dict(self.evidence),
            "suggestion": (
                {"text": self.suggestion.text, "confidence": self.suggestion.confidence}
                if self.suggestion
                else None
            ),
        }
