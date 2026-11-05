# LivingDocs — AI Engine (AST Analyzer)

**Tác giả phụ trách:** Hiếu aka silas (Integration Subsystem Lead)  
**Công nghệ:** Python 3.12+, Tree-Sitter (`tree-sitter`, `tree-sitter-java`, `tree-sitter-python`), Pytest.

---

## 1. Giới thiệu chức năng

Module `ast_analyzer` chịu trách nhiệm bóc tách cú pháp mã nguồn (Abstract Syntax Tree - AST) cho cả 2 ngôn ngữ **Java** và **Python**:
* **Bóc tách thực thể mã nguồn (FR-GEN-01)**:
  * `class`: Class, Interface, Record, Enum.
  * `method`: Methods, Constructors, Functions, Async Functions.
  * `parameter`: Formal parameters, Typed parameters, Default values (gắn `parent_id` tới method).
  * `endpoint`:
    * Java: Spring `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`, `@RequestMapping` (kết hợp base route class và sub-path method).
    * Python: FastAPI `@router.get`, `@router.post`, `@router.delete`, `@app.get`, v.v.
* **Tính tất định (Deterministic - FR-DR-13)**: Cùng danh sách tệp và commit hash luôn trả về kết quả giống hệt nhau 100%, không sinh trùng thực thể khi chạy lại.
* **Lưu trữ CSDL SQL Server**: Cung cấp `CodeEntityDbSaver` lưu vào bảng `code_entity` trong schema tenant theo đúng thứ tự phân cấp khóa ngoại `parent_id`.

---

## 2. Chữ ký hàm chuẩn hóa

```python
from app.ast_analyzer import analyze, CodeEntity

entities: list[CodeEntity] = analyze(
    files=["fixtures/sample_java_repo/OrderController.java"],
    language="java",
    commit="a1b2c3d4",
    repository_id="optional-uuid"
)
```

---

## 3. Chạy Unit Tests

```bash
python -m pytest backend/ai-engine/tests/test_ast_analyzer.py -v
```

Bộ kiểm thử gồm 12 test cases bao quát:
- Nhận diện class, method, parameters, endpoint Java (Spring Boot)
- Nhận diện class, function, parameters, endpoint Python (FastAPI)
- Cây phân cấp cha-con `parent_id`
- Kiểm tra tính tất định (Idempotence)
- Khả năng xử lý tệp cú pháp lỗi / tệp rỗng mà không crash
- Kiểm tra ngoại lệ ngôn ngữ không hỗ trợ
