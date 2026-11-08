# LivingDocs — AI Engine

AI Engine là phân hệ thông minh của hệ thống **LivingDocs**, chịu trách nhiệm phân tích cú pháp mã nguồn (AST Parsing), nhận diện và bảo vệ thông tin nhạy cảm, đồng thời tích hợp mô hình ngôn ngữ lớn (LLM) để tự động sinh và cập nhật bản thảo tài liệu kỹ thuật (DocDraft) từ các thực thể mã nguồn và tài liệu mẫu (Template).

---

## 1. Cấu trúc và Công nghệ

* **Ngôn ngữ & Môi trường**: Python 3.12+, FastAPI, Uvicorn, Pydantic v2.
* **AST Parsing**: Tree-Sitter (`tree-sitter`, `tree-sitter-java`, `tree-sitter-python`).
* **Kiểm thử**: Pytest, HTTPX.
* **Containerization**: Docker.

---

## 2. Các phân hệ chính

### 2.1. Phân hệ Bóc tách cú pháp mã nguồn (`ast_analyzer`)
**Tác giả phụ trách:** Hiếu aka silas (Integration Subsystem Lead)

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

**Ví dụ sử dụng:**
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

### 2.2. Phân hệ Mô hình ngôn ngữ lớn (`llm`)
Module phụ trách tích hợp và trừu tượng hóa mô hình ngôn ngữ lớn (LLM) để sinh bản thảo tài liệu (DocDraft) tự động từ code entities và template:
* **LlmProvider Interface**: Abstraction chuẩn cho các LLM Provider.
* **MockProvider**: Deterministic Mock Provider phục vụ offline testing, không yêu cầu API key.
* **Secret Masker (NFR-SEC-08)**: Tự động nhận diện và che giấu các sensitive token, API keys, passwords thành `***MASKED***` trước khi sinh tài liệu.
* **DocDraft Schema**: Pydantic schema chuẩn định nghĩa các trường cấu trúc, section, confidence và grounding evidence (source file path, code entity ID, commit SHA).

---

## 3. Biến môi trường

| Biến | Mặc định | Mô tả |
| :--- | :--- | :--- |
| `LLM_PROVIDER` | `mock` | Nhà cung cấp LLM (`mock`, `openai`, `gemini`,...) |
| `LLM_MODEL` | `mock-model-v1` | Tên model sử dụng |
| `PORT` | `8090` | Cổng dịch vụ FastAPI |

---

## 4. Hướng dẫn cài đặt và khởi chạy

### 4.1. Môi trường Local
```bash
cd backend/ai-engine
pip install -r requirements.txt
uvicorn app.main:app --port 8090 --reload
```

### 4.2. Môi trường Docker
```bash
cd backend/ai-engine
docker build -t livingdocs-ai-engine .
docker run -p 8090:8090 livingdocs-ai-engine
```

---

## 5. Chạy Kiểm thử (Unit Tests)

Chạy toàn bộ test suites trong thư mục `tests`:
```bash
cd backend/ai-engine
python -m pytest tests -v
```

Hoặc chạy riêng từng bộ kiểm thử:
* **Kiểm thử AST Analyzer** (12 test cases bao quát Java Spring, Python FastAPI, cây cha-con `parent_id`, tính tất định, xử lý cú pháp lỗi):
  ```bash
  python -m pytest tests/test_ast_analyzer.py -v
  ```
* **Kiểm thử LLM & Secret Masker** (kiểm thử bóc tách/che giấu secret và sinh DocDraft với schema chuẩn):
  ```bash
  python -m pytest tests/test_llm.py -v
  ```
