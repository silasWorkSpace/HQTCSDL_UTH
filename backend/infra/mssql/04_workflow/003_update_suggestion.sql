-- File: 003_update_suggestion.sql
-- Mô tả: Tạo bảng update_suggestion để lưu trữ các gợi ý cập nhật tài liệu[cite: 1]

CREATE TABLE update_suggestion (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    
    -- Các cột liên kết và thông tin gợi ý
    document_id UNIQUEIDENTIFIER NOT NULL,
    drift_alert_id UNIQUEIDENTIFIER NULL,
    origin VARCHAR(50) NOT NULL,
    content NVARCHAR(MAX) NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score BETWEEN 0.00 AND 1.00),
    evidence NVARCHAR(MAX) NULL CHECK (evidence IS NULL OR ISJSON(evidence) = 1),
    status VARCHAR(50) NOT NULL CHECK (status IN ('Pending Developer Action', 'Accepted', 'Dismissed', 'Superseded')),
    dismiss_reason NVARCHAR(MAX) NULL,
    auto_apply_eligible BIT NOT NULL DEFAULT 0,
    
    -- Các cột chuẩn theo quy ước chung
    created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    row_version ROWVERSION
);
