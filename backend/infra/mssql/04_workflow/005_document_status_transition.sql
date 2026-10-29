-- File: 005_document_status_transition.sql
-- Mô tả: Tạo bảng document_status_transition định nghĩa các quy tắc chuyển đổi trạng thái tài liệu[cite: 1]

CREATE TABLE document_status_transition (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    from_status VARCHAR(100) NOT NULL,
    to_status VARCHAR(100) NOT NULL,
    allowed_role VARCHAR(100) NOT NULL,
    CONSTRAINT uq_status_transition UNIQUE (from_status, to_status, allowed_role)
);