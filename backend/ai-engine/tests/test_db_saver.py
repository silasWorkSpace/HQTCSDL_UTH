from app.ast_analyzer.db_saver import CodeEntityDbSaver
from app.ast_analyzer.models import CodeEntity


class Cursor:
    def __init__(self):
        self.calls = []

    def execute(self, statement, params):
        self.calls.append((statement, params))

    def close(self):
        pass


def test_saver_uses_dbapi_parameter_sequence_for_each_entity():
    cursor = Cursor()
    entity = CodeEntity(
        id="e1", repository_id="r1", name="Service", kind="class",
        file_path="src/Service.java", commit_hash="a" * 40,
    )

    saved = CodeEntityDbSaver().save_entities([entity], tenant_schema="ws_demo", cursor=cursor)

    assert saved == 1
    assert len(cursor.calls) == 1
    sql, params = cursor.calls[0]
    assert "MERGE [ws_demo].[code_entity]" in sql
    assert sql.count("%s") == 8
    assert "?" not in sql
    assert params == ["e1", "r1", None, "class", "Service", None, "src/Service.java", "a" * 40]


def test_saver_orders_hierarchy_and_handles_overloaded_methods():
    cursor = Cursor()
    cls_entity = CodeEntity(id="c1", repository_id="r1", name="MyClass", kind="class", file_path="f.java", commit_hash="c1")
    # Overloaded methods with same name
    m1 = CodeEntity(id="m1", repository_id="r1", name="doIt", kind="method", file_path="f.java", commit_hash="c1", parent_id="c1", signature="void doIt()")
    m2 = CodeEntity(id="m2", repository_id="r1", name="doIt", kind="method", file_path="f.java", commit_hash="c1", parent_id="c1", signature="void doIt(int x)")
    # Duplicate parameter name in both methods
    p1 = CodeEntity(id="p1", repository_id="r1", name="x", kind="parameter", file_path="f.java", commit_hash="c1", parent_id="m1")
    p2 = CodeEntity(id="p2", repository_id="r1", name="x", kind="parameter", file_path="f.java", commit_hash="c1", parent_id="m2")

    # Pass in scrambled order
    saved = CodeEntityDbSaver().save_entities([p2, m2, cls_entity, p1, m1], tenant_schema="ws_demo", cursor=cursor)

    assert saved == 5
    executed_ids = [call[1][0] for call in cursor.calls]
    # Class must be first
    assert executed_ids[0] == "c1"
    # Methods before parameters
    assert set(executed_ids[1:3]) == {"m1", "m2"}
    assert set(executed_ids[3:5]) == {"p1", "p2"}
