import sys
from pathlib import Path
import pytest

# Ensure app is on sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.ast_analyzer import analyze, get_java_parser, get_python_parser, CodeEntity


FIXTURES_DIR = BASE_DIR / "fixtures"
JAVA_FIXTURES = FIXTURES_DIR / "sample_java_repo"
PYTHON_FIXTURES = FIXTURES_DIR / "sample_python_repo"


def test_java_extracts_classes():
    order_controller_path = JAVA_FIXTURES / "OrderController.java"
    entities = analyze([order_controller_path], language="java", commit="a1b2c3d")

    classes = [e for e in entities if e.kind == "class"]
    assert len(classes) == 1
    assert classes[0].name == "OrderController"
    assert "class OrderController" in classes[0].signature


def test_java_extracts_methods():
    order_service_path = JAVA_FIXTURES / "OrderService.java"
    entities = analyze([order_service_path], language="java", commit="a1b2c3d")

    methods = [e for e in entities if e.kind == "method"]
    method_names = {m.name for m in methods}
    assert "findOrders" in method_names
    assert "getOrder" in method_names
    assert "create" in method_names
    assert "cancel" in method_names


def test_java_parameter_parent_id():
    order_controller_path = JAVA_FIXTURES / "OrderController.java"
    entities = analyze([order_controller_path], language="java", commit="a1b2c3d")

    methods = {e.id: e for e in entities if e.kind == "method"}
    params = [e for e in entities if e.kind == "parameter"]

    assert len(params) > 0
    for p in params:
        assert p.parent_id in methods
        assert p.signature is not None


def test_java_extracts_spring_endpoints():
    order_controller_path = JAVA_FIXTURES / "OrderController.java"
    entities = analyze([order_controller_path], language="java", commit="a1b2c3d")

    endpoints = [e for e in entities if e.kind == "endpoint"]
    endpoint_names = [e.name for e in endpoints]

    assert any(name.startswith("GET /api/v1/orders") for name in endpoint_names)
    assert any("GET /api/v1/orders/{orderId}" in name for name in endpoint_names)
    assert any("POST /api/v1/orders" in name for name in endpoint_names)
    assert any("DELETE /api/v1/orders/{orderId}" in name for name in endpoint_names)


def test_python_extracts_classes():
    models_path = PYTHON_FIXTURES / "models.py"
    entities = analyze([models_path], language="python", commit="commit_py_1")

    classes = [e for e in entities if e.kind == "class"]
    class_names = {c.name for c in classes}
    assert "UserDto" in class_names
    assert "CreateUserRequest" in class_names


def test_python_extracts_functions():
    user_router_path = PYTHON_FIXTURES / "user_router.py"
    entities = analyze([user_router_path], language="python", commit="commit_py_1")

    functions = [e for e in entities if e.kind == "method"]
    func_names = {f.name for f in functions}
    assert "list_users" in func_names
    assert "get_user" in func_names
    assert "create_user" in func_names
    assert "delete_user" in func_names


def test_python_parameter_parent_id():
    user_router_path = PYTHON_FIXTURES / "user_router.py"
    entities = analyze([user_router_path], language="python", commit="commit_py_1")

    func_map = {e.id: e for e in entities if e.kind == "method"}
    params = [e for e in entities if e.kind == "parameter"]

    assert len(params) > 0
    for p in params:
        assert p.parent_id in func_map
        assert p.name != "self"


def test_python_extracts_fastapi_endpoints():
    user_router_path = PYTHON_FIXTURES / "user_router.py"
    entities = analyze([user_router_path], language="python", commit="commit_py_1")

    endpoints = [e for e in entities if e.kind == "endpoint"]
    endpoint_names = [e.name for e in endpoints]

    assert any("GET /api/v1/users" in name or name == "GET /" for name in endpoint_names)
    assert any("GET /{user_id}" in name or "GET /api/v1/users/{user_id}" in name for name in endpoint_names)
    assert any("POST" in name for name in endpoint_names)
    assert any("DELETE" in name for name in endpoint_names)


def test_ast_analyzer_idempotence():
    """FR-DR-13: Cùng đầu vào thì cùng kết quả, chạy lại không sinh trùng."""
    user_router_path = PYTHON_FIXTURES / "user_router.py"
    run1 = analyze([user_router_path], language="python", commit="c123")
    run2 = analyze([user_router_path], language="python", commit="c123")

    assert len(run1) == len(run2)
    names1 = [e.name for e in run1]
    names2 = [e.name for e in run2]
    assert names1 == names2

    kinds1 = [e.kind for e in run1]
    kinds2 = [e.kind for e in run2]
    assert kinds1 == kinds2


def test_ast_analyzer_syntax_error_graceful(tmp_path):
    broken_java = tmp_path / "Broken.java"
    broken_java.write_text("public class Broken { void missingBrace() ", encoding="utf-8")

    # Should not crash
    entities = analyze([broken_java], language="java", commit="err_commit")
    assert isinstance(entities, list)


def test_ast_analyzer_empty_file(tmp_path):
    empty_py = tmp_path / "empty.py"
    empty_py.write_text("", encoding="utf-8")

    entities = analyze([empty_py], language="python", commit="empty_commit")
    assert len(entities) == 0


def test_ast_analyzer_unsupported_language():
    with pytest.raises(ValueError, match="chưa được hỗ trợ"):
        analyze(["some/file.rb"], language="ruby", commit="rb_commit")
