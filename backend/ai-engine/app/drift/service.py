"""Xử lý job ANALYZE_CHANGE: đọc DB → detect → các message DRIFT_FOUND.

Runner (Hoàng) chỉ cần gọi `analyze_change(...)` rồi gửi từng envelope trả về lên `ld.ai-results`.

Giả định về dữ liệu (cần Hiếu xác nhận, xem README):
  * `ast_analyzer` giữ một bộ dòng `code_entity` cho MỖI commit (cột `commit_hash`), không ghi đè
    dòng của commit cũ. Ảnh chụp "cũ" = dòng của `old_commit` (kể cả dòng đã `removed_at`, vì
    chúng tồn tại ở commit đó); ảnh chụp "mới" = dòng của `new_commit` còn sống (`removed_at` rỗng).
  * `doc_code_link` trỏ tới dòng code_entity (theo id) của commit cũ.
  * `code_entity.signature` là chuỗi ký hiệu gồm tham số và kiểu trả về; các dòng kind='parameter'
    bị bỏ qua vì đã nằm trong chuỗi đó.
"""
from __future__ import annotations

import re
from collections import Counter
from typing import Any, Mapping, Protocol, Sequence

from .detector import detect
from .events import build_drift_found_events
from .models import CodeEntity, DocLink, EntityKind
from .semantic import SemanticProvider

_KINDS = {k.value: k for k in EntityKind}
_TENANT_RE = re.compile(r"^[A-Za-z0-9_]{1,50}$")
_CHUNK = 500  # SQL Server giới hạn ~2100 tham số mỗi câu lệnh


class DriftRepository(Protocol):
    def code_entities(self, repository_id: str, commit_hash: str, *, include_removed: bool) -> list[dict]: ...

    def doc_links(self, entity_ids: Sequence[str]) -> list[dict]: ...


def schema_of(tenant: str) -> str:
    """'acme' hoặc 'ws_acme' → 'ws_acme' (giống TenantSchema phía Java, chống SQL injection)."""
    code = (tenant or "").strip()
    if code[:3].lower() == "ws_":
        code = code[3:]
    if not _TENANT_RE.match(code):
        raise ValueError("Mã tenant không hợp lệ")
    return f"ws_{code}"


class SqlDriftRepository:
    """Truy vấn qua một kết nối DB-API dùng tham số `?` (pyodbc hoặc sqlite3 khi test)."""

    def __init__(self, connection: Any, tenant: str):
        self._conn = connection
        self._schema = schema_of(tenant)

    def _query(self, sql: str, params: Sequence[Any]) -> list[dict]:
        cur = self._conn.cursor()
        try:
            cur.execute(sql, list(params))
            cols = [c[0] for c in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
        finally:
            cur.close()

    def code_entities(self, repository_id: str, commit_hash: str, *, include_removed: bool) -> list[dict]:
        sql = (
            "SELECT id, parent_id, kind, name, signature, file_path, commit_hash, removed_at "
            f"FROM [{self._schema}].[code_entity] WHERE repository_id = ? AND commit_hash = ?"
        )
        if not include_removed:
            sql += " AND removed_at IS NULL"
        return self._query(sql, [repository_id, commit_hash])

    def doc_links(self, entity_ids: Sequence[str]) -> list[dict]:
        rows: list[dict] = []
        ids = list(entity_ids)
        for i in range(0, len(ids), _CHUNK):
            part = ids[i : i + _CHUNK]
            marks = ",".join("?" * len(part))
            rows += self._query(
                "SELECT document_id, code_entity_id "
                f"FROM [{self._schema}].[doc_code_link] "
                f"WHERE link_type = 'CODE_ENTITY' AND code_entity_id IN ({marks})",
                part,
            )
        return rows


def rows_to_entities(rows: Sequence[Mapping[str, Any]]) -> tuple[list[CodeEntity], dict[str, str]]:
    """Dòng code_entity → CodeEntity. Trả thêm map {id dòng: qualified_name}.

    qualified_name = tên các cấp cha nối bằng '.'. Hai thực thể trùng tên khác tệp được phân biệt
    bằng hậu tố '@đường_dẫn_tệp'; còn lại không gắn đường dẫn nên đổi tệp không bị tính là drift.
    """
    usable = {str(r["id"]): r for r in rows if r["kind"] in _KINDS}

    def chain(row: Mapping[str, Any]) -> str:
        names, seen, cur = [], set(), row
        while cur is not None and str(cur["id"]) not in seen:
            seen.add(str(cur["id"]))
            names.append(str(cur["name"]))
            pid = cur.get("parent_id")
            cur = usable.get(str(pid)) if pid is not None else None
        return ".".join(reversed(names))

    base = {rid: chain(r) for rid, r in usable.items()}
    dup = {q for q, n in Counter(base.values()).items() if n > 1}
    qname = {
        rid: (f"{q}@{usable[rid]['file_path']}" if q in dup else q) for rid, q in base.items()
    }

    entities = []
    for rid in sorted(usable, key=lambda x: qname[x]):
        r = usable[rid]
        pid = r.get("parent_id")
        entities.append(
            CodeEntity(
                qualified_name=qname[rid],
                kind=_KINDS[r["kind"]],
                file_path=r.get("file_path") or "",
                parent=qname.get(str(pid)) if pid is not None else None,
                name=str(r["name"]),
                signature=r.get("signature"),
            )
        )
    return entities, qname


def analyze_change(
    repo: DriftRepository,
    *,
    tenant: str,
    repository_id: str,
    old_commit: str,
    new_commit: str,
    source_event_id: str,
    correlation_id: str,
    semantic: SemanticProvider | None = None,
    occurred_at: str | None = None,
) -> list[dict]:
    """Trả về các envelope DRIFT_FOUND (mỗi tài liệu một message); rỗng nếu không có drift."""
    if old_commit == new_commit:
        return []
    old_rows = repo.code_entities(repository_id, old_commit, include_removed=True)
    new_rows = repo.code_entities(repository_id, new_commit, include_removed=False)
    old_entities, old_qnames = rows_to_entities(old_rows)
    new_entities, _ = rows_to_entities(new_rows)

    doc_links = [
        DocLink(doc_id=str(link["document_id"]), entity_qualified_name=old_qnames[str(link["code_entity_id"])])
        for link in repo.doc_links(list(old_qnames))
        if str(link["code_entity_id"]) in old_qnames
    ]
    findings = detect(old_entities, new_entities, doc_links, semantic=semantic)
    return build_drift_found_events(
        findings,
        tenant=tenant,
        correlation_id=correlation_id,
        source_event_id=source_event_id,
        occurred_at=occurred_at,
    )
