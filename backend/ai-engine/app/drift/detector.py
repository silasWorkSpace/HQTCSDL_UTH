"""drift.detect(old_entities, new_entities, doc_links) -> list[DriftFinding].

Thuần hàm: không đọc DB, không gọi mạng. Cùng đầu vào cho cùng kết quả,
kể cả khi đổi thứ tự phần tử đầu vào (DR-13).
"""
from __future__ import annotations

import uuid
from collections import defaultdict
from typing import Iterable, Mapping

from . import rules
from .models import (
    CodeEntity,
    DocLink,
    DriftFinding,
    DriftType,
    EntityKind,
    Suggestion,
)
from .semantic import SemanticProvider

_NS = uuid.UUID("6f1d5f3e-2b0a-4a55-9d7e-0c3a8a1e7b11")


def render_signature(e: CodeEntity) -> str:
    if e.kind is EntityKind.CLASS:
        return f"class {e.short_name}"
    if e.signature and not e.params and e.return_type is None and e.route is None:  # MỚI
        return e.signature  # chỉ có chuỗi ký hiệu nguyên bản từ bảng code_entity   # MỚI
    params = ", ".join(f"{n}: {t}" if t else n for n, t in e.params)
    ret = f": {e.return_type}" if e.return_type else ""
    call = f"{e.short_name}({params}){ret}"
    if e.kind is EntityKind.ENDPOINT:
        return f"{e.http_method or '?'} {e.route or '?'} -> {call}"
    return call


def describe_change(old: CodeEntity, new: CodeEntity) -> str:
    parts: list[str] = []
    if old.kind is EntityKind.ENDPOINT and (old.http_method, old.route) != (new.http_method, new.route):
        parts.append(
            f"đường dẫn đổi từ {old.http_method} {old.route} sang {new.http_method} {new.route}"
        )
    od, nd = dict(old.params), dict(new.params)
    for name in sorted(set(od) - set(nd)):
        parts.append(f"bỏ tham số `{name}`")
    for name in sorted(set(nd) - set(od)):
        parts.append(f"thêm tham số `{name}`")
    for name in sorted(set(od) & set(nd)):
        if od[name] != nd[name]:
            parts.append(f"kiểu của `{name}` đổi từ {od[name]} sang {nd[name]}")
    if od == nd and old.params != new.params:
        parts.append("đổi thứ tự tham số")
    if old.return_type != new.return_type:
        parts.append(f"kiểu trả về đổi từ {old.return_type or 'không có'} sang {new.return_type or 'không có'}")
    if not parts and old.signature != new.signature:                                  # MỚI
        parts.append(f"ký hiệu đổi từ `{old.signature}` sang `{new.signature}`")     # MỚI
    return "; ".join(parts) if parts else "chữ ký thay đổi"


def _find_renames(
    old_idx: Mapping[str, CodeEntity], new_idx: Mapping[str, CodeEntity]
) -> dict[str, CodeEntity]:
    """Chỉ coi là đổi tên khi khớp duy nhất và không nhập nhằng."""
    removed = [e for q, e in old_idx.items() if q not in new_idx]
    added = [e for q, e in new_idx.items() if q not in old_idx]
    cands: dict[str, list[CodeEntity]] = {}
    for r in removed:
        cands[r.qualified_name] = [
            a
            for a in added
            if a.signature_key == r.signature_key
            and (r.kind is not EntityKind.CLASS or a.file_path == r.file_path)
        ]
    claimed: dict[str, int] = defaultdict(int)
    for lst in cands.values():
        for a in lst:
            claimed[a.qualified_name] += 1
    return {
        q: lst[0]
        for q, lst in cands.items()
        if len(lst) == 1 and claimed[lst[0].qualified_name] == 1
    }


def _fid(*parts: str) -> str:
    return str(uuid.uuid5(_NS, "|".join(parts)))


def _group_links(links: Iterable[DocLink | Mapping]) -> dict[tuple[str, str], list[str]]:
    groups: dict[tuple[str, str], set[str]] = defaultdict(set)
    for raw in links:
        link = raw if isinstance(raw, DocLink) else DocLink.from_dict(raw)
        sections = groups[(link.doc_id, link.entity_qualified_name)]
        if link.section:
            sections.add(link.section)
    return {k: sorted(v) for k, v in groups.items()}


def detect(
    old_entities: Iterable[CodeEntity | Mapping],
    new_entities: Iterable[CodeEntity | Mapping],
    doc_links: Iterable[DocLink | Mapping],
    *,
    semantic: SemanticProvider | None = None,
) -> list[DriftFinding]:
    def norm(es):
        return [e if isinstance(e, CodeEntity) else CodeEntity.from_dict(e) for e in es]

    old_idx = {e.qualified_name: e for e in norm(old_entities)}
    new_idx = {e.qualified_name: e for e in norm(new_entities)}
    renames = _find_renames(old_idx, new_idx)

    findings: list[DriftFinding] = []
    for (doc_id, q), sections in sorted(_group_links(doc_links).items()):
        old, new = old_idx.get(q), new_idx.get(q)
        if old is None:
            continue  # liên kết tới thực thể chưa từng có: không phải drift do thay đổi này
        secs = tuple(sections)

        if new is None:
            target = renames.get(q)
            if target is not None:
                findings.append(
                    DriftFinding(
                        finding_id=_fid(doc_id, "referential", q, "renamed", target.qualified_name),
                        doc_id=doc_id,
                        drift_type=DriftType.REFERENTIAL,
                        severity=rules.severity_renamed(old),
                        entity=q,
                        kind=old.kind,
                        sections=secs,
                        message=f"`{old.short_name}` đã được đổi tên thành `{target.short_name}`, tài liệu vẫn tham chiếu tên cũ.",
                        evidence={"old": render_signature(old), "new": render_signature(target)},
                        suggestion=Suggestion(
                            f"Đổi tham chiếu `{old.short_name}` thành `{target.short_name}` trong tài liệu.",
                            rules.CONF_RENAMED,
                        ),
                    )
                )
            else:
                findings.append(
                    DriftFinding(
                        finding_id=_fid(doc_id, "referential", q, "deleted"),
                        doc_id=doc_id,
                        drift_type=DriftType.REFERENTIAL,
                        severity=rules.severity_deleted(old),
                        entity=q,
                        kind=old.kind,
                        sections=secs,
                        message=f"`{old.short_name}` đã bị xóa khỏi mã nguồn nhưng tài liệu vẫn tham chiếu.",
                        evidence={"old": render_signature(old), "new": None},
                        suggestion=Suggestion(
                            f"Gỡ hoặc đánh dấu lỗi thời phần mô tả `{old.short_name}` trong tài liệu.",
                            rules.CONF_DELETED,
                        ),
                    )
                )
        elif old.signature_key != new.signature_key:
            change = describe_change(old, new)
            findings.append(
                DriftFinding(
                    finding_id=_fid(doc_id, "signature", q, repr(old.signature_key), repr(new.signature_key)),
                    doc_id=doc_id,
                    drift_type=DriftType.SIGNATURE,
                    severity=rules.severity_signature(old, new),
                    entity=q,
                    kind=old.kind,
                    sections=secs,
                    message=f"Chữ ký `{old.short_name}` đã thay đổi: {change}.",
                    evidence={"old": render_signature(old), "new": render_signature(new)},
                    suggestion=Suggestion(
                        f"Cập nhật mô tả `{old.short_name}` theo chữ ký mới: {render_signature(new)}.",
                        rules.CONF_SIGNATURE,
                    ),
                )
            )
        elif semantic is not None:
            verdict = semantic.assess(old, new)
            if verdict is not None:
                findings.append(
                    DriftFinding(
                        finding_id=_fid(doc_id, "semantic", q, old.body_hash or "", new.body_hash or ""),
                        doc_id=doc_id,
                        drift_type=DriftType.SEMANTIC,
                        severity=rules.severity_semantic(old),
                        entity=q,
                        kind=old.kind,
                        sections=secs,
                        message=verdict.reason,
                        evidence={"old": render_signature(old), "new": render_signature(new)},
                        suggestion=Suggestion(
                            f"Đọc lại phần thân `{new.short_name}` và kiểm tra mô tả còn đúng không.",
                            verdict.confidence,
                        ),
                    )
                )

    findings.sort(key=lambda f: (-f.severity.rank, f.doc_id, f.entity, f.drift_type.value))
    return findings
