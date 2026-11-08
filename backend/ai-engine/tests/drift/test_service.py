import sqlite3
import uuid

from app.drift import SqlDriftRepository, analyze_change, rows_to_entities
from app.drift.service import schema_of

REPO = str(uuid.uuid4())
DOC1 = "11111111-1111-1111-1111-111111111111"
SRC = "99999999-9999-9999-9999-999999999999"
CORR = "33333333-3333-3333-3333-333333333333"
OLD, NEW = "c_old", "c_new"


def make_db():
    """SQLite cho phép ATTACH một 'schema' tên ws_demo và dùng [ws_demo].[bảng] như SQL Server."""
    conn = sqlite3.connect(":memory:")
    conn.execute("ATTACH DATABASE ':memory:' AS ws_demo")
    conn.execute("""CREATE TABLE ws_demo.code_entity (
        id TEXT PRIMARY KEY, repository_id TEXT, parent_id TEXT, kind TEXT, name TEXT,
        signature TEXT, file_path TEXT, commit_hash TEXT, removed_at TEXT)""")
    conn.execute("""CREATE TABLE ws_demo.doc_code_link (
        id TEXT PRIMARY KEY, document_id TEXT, link_type TEXT, code_entity_id TEXT, external_ref TEXT)""")
    return conn


def add(conn, kind, name, sig, commit, parent=None, path="UserService.java", removed=None):
    rid = str(uuid.uuid4())
    conn.execute("INSERT INTO ws_demo.code_entity VALUES (?,?,?,?,?,?,?,?,?)",
                 (rid, REPO, parent, kind, name, sig, path, commit, removed))
    return rid


def link(conn, entity_id, doc=DOC1, link_type="CODE_ENTITY"):
    conn.execute("INSERT INTO ws_demo.doc_code_link VALUES (?,?,?,?,?)",
                 (str(uuid.uuid4()), doc, link_type, entity_id, None))


def run(conn):
    return analyze_change(SqlDriftRepository(conn, "demo"), tenant="demo", repository_id=REPO,
                          old_commit=OLD, new_commit=NEW, source_event_id=SRC,
                          correlation_id=CORR, occurred_at="2026-11-07T00:00:00Z")


def class_with_method(conn, commit, sig, method="save"):
    c = add(conn, "class", "UserService", None, commit)
    m = add(conn, "method", method, sig, commit, parent=c)
    return c, m


def test_signature_change_detected_through_db_rows_and_links():
    conn = make_db()
    _, old_m = class_with_method(conn, OLD, "save(User u): void")
    class_with_method(conn, NEW, "save(User u, boolean force): void")
    link(conn, old_m)

    events = run(conn)

    assert len(events) == 1
    p = events[0]["payload"]
    assert p["documentId"] == DOC1 and p["sourceEventId"] == SRC
    f = p["findings"][0]
    assert f["driftType"] == "Signature" and f["severity"] == "High"
    ent = f["evidence"]["entities"][0]
    assert ent["entity"] == "UserService.save"
    assert ent["old"] == "save(User u): void" and ent["new"] == "save(User u, boolean force): void"
    assert "`save(User u): void`" in ent["message"]
    assert f["suggestion"]["confidence"] == 0.90


def test_deleted_method_is_referential_high():
    conn = make_db()
    _, old_m = class_with_method(conn, OLD, "save(User u): void")
    add(conn, "class", "UserService", None, NEW)  # method không còn ở commit mới
    link(conn, old_m)

    f = run(conn)[0]["payload"]["findings"][0]
    assert f["driftType"] == "Referential" and f["severity"] == "High"


def test_method_soft_removed_in_old_snapshot_still_counts_as_existing_then():
    conn = make_db()
    c = add(conn, "class", "UserService", None, OLD)
    m = add(conn, "method", "save", "save(): void", OLD, parent=c, removed="2026-11-07")
    add(conn, "class", "UserService", None, NEW)
    link(conn, m)

    assert run(conn)[0]["payload"]["findings"][0]["driftType"] == "Referential"


def test_unique_rename_between_commits():
    conn = make_db()
    _, old_m = class_with_method(conn, OLD, "calc(int a): int", method="calc")
    class_with_method(conn, NEW, "calc(int a): int", method="compute")
    link(conn, old_m)

    f = run(conn)[0]["payload"]["findings"][0]
    assert f["severity"] == "Medium" and "compute" in f["evidence"]["entities"][0]["message"]


def test_no_change_and_same_commit_yield_nothing():
    conn = make_db()
    _, old_m = class_with_method(conn, OLD, "save(): void")
    class_with_method(conn, NEW, "save(): void")
    link(conn, old_m)
    assert run(conn) == []
    assert analyze_change(SqlDriftRepository(conn, "demo"), tenant="demo", repository_id=REPO,
                          old_commit=OLD, new_commit=OLD, source_event_id=SRC,
                          correlation_id=CORR) == []


def test_non_code_entity_links_and_unlinked_entities_are_ignored():
    conn = make_db()
    _, old_m = class_with_method(conn, OLD, "save(): void")
    class_with_method(conn, NEW, "save(int x): void")
    link(conn, old_m, link_type="PR")  # không phải CODE_ENTITY
    assert run(conn) == []  # chưa có tài liệu nào liên kết → không cảnh báo


def test_each_document_gets_its_own_event():
    conn = make_db()
    _, old_m = class_with_method(conn, OLD, "save(): void")
    class_with_method(conn, NEW, "save(int x): void")
    link(conn, old_m, doc=DOC1)
    link(conn, old_m, doc="22222222-2222-2222-2222-222222222222")
    assert len(run(conn)) == 2


def test_parameter_rows_are_ignored_and_parents_form_qualified_names():
    rows = [
        {"id": "c", "parent_id": None, "kind": "class", "name": "A", "signature": None,
         "file_path": "A.java", "commit_hash": "x", "removed_at": None},
        {"id": "m", "parent_id": "c", "kind": "method", "name": "f", "signature": "f(int p)",
         "file_path": "A.java", "commit_hash": "x", "removed_at": None},
        {"id": "p", "parent_id": "m", "kind": "parameter", "name": "p", "signature": "int",
         "file_path": "A.java", "commit_hash": "x", "removed_at": None},
    ]
    entities, q = rows_to_entities(rows)
    assert [e.qualified_name for e in entities] == ["A", "A.f"]
    assert "p" not in q and entities[1].parent == "A" and entities[1].short_name == "f"


def test_same_name_in_different_files_is_disambiguated_by_path():
    rows = [
        {"id": "1", "parent_id": None, "kind": "class", "name": "Config", "signature": None,
         "file_path": "a/Config.java", "commit_hash": "x", "removed_at": None},
        {"id": "2", "parent_id": None, "kind": "class", "name": "Config", "signature": None,
         "file_path": "b/Config.java", "commit_hash": "x", "removed_at": None},
    ]
    entities, _ = rows_to_entities(rows)
    names = sorted(e.qualified_name for e in entities)
    assert names == ["Config@a/Config.java", "Config@b/Config.java"]
    assert all(e.short_name == "Config" for e in entities)


def test_tenant_schema_validation():
    assert schema_of("acme") == "ws_acme" and schema_of("WS_acme") == "ws_acme"
    for bad in ["", "a;drop", "a b", "x" * 60]:
        try:
            schema_of(bad)
            assert False, f"phải từ chối {bad!r}"
        except ValueError:
            pass
