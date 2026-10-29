-- File: 002_drift_alert.sql
-- Mô tả: Tạo bảng drift_alert để lưu trữ các cảnh báo lệch pha giữa mã nguồn và tài liệu

CREATE TABLE drift_alert (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    
    -- Các cột liên kết và thông tin cảnh báo
    source_event_id UNIQUEIDENTIFIER NOT NULL,
    document_id UNIQUEIDENTIFIER NOT NULL,
    drift_type VARCHAR(50) NOT NULL CHECK (drift_type IN ('Referential', 'Signature', 'Semantic')),
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    evidence NVARCHAR(MAX) NOT NULL CHECK (ISJSON(evidence) = 1), -- Lưu bằng chứng dạng JSON
    handling_status VARCHAR(50) NOT NULL,
    
    -- Các cột chuẩn theo quy ước chung
    created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    row_version ROWVERSION,
    
    -- Ràng buộc duy nhất theo phân công
    CONSTRAINT uq_drift_alert_source_doc_type UNIQUE (source_event_id, document_id, drift_type)
);