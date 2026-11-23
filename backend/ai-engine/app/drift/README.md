# ai-engine/drift

Hàm chính: `detect(old_entities, new_entities, doc_links, *, semantic=None) -> list[DriftFinding]`

- Đầu vào nhận `CodeEntity`/`DocLink` hoặc dict JSON (snake_case hoặc camelCase).
- Referential: tài liệu tham chiếu code đã xóa hoặc đổi tên (đổi tên chỉ khi khớp duy nhất).
- Signature: đổi tham số, kiểu trả về, đường dẫn / HTTP method của endpoint.
- Semantic: chỉ chạy khi truyền `semantic=` (tuần này dùng `MockSemanticProvider`).
- Cùng đầu vào cho cùng kết quả và cùng `finding_id` (uuid5), không phụ thuộc thứ tự đầu vào.
- Quy tắc mức nghiêm trọng và confidence: xem `rules.py`.
- `build_drift_found_events(...)` dựng các envelope DRIFT_FOUND cho `ld.ai-results`, khớp `AiResultsConsumer` (mỗi tài liệu một message, gộp finding cùng loại, một gợi ý gộp cho mỗi tài liệu).

Chạy test (từ thư mục `ai-engine`): `python -m pytest tests/drift`
