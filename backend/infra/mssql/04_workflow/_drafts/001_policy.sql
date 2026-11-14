-- File: 001_policy.sql
-- Mô tả: Tạo bảng policy trong cụm Workflow quản lý chính sách hệ thống

CREATE TABLE policy (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    
    -- Các cột chính của bảng policy
    policy_type VARCHAR(50) NOT NULL CHECK (policy_type IN ('drift', 'auto_update', 'auto_apply', 'merge', 'manager_required_type')),
    scope_level VARCHAR(50) NOT NULL,
    scope_id UNIQUEIDENTIFIER NULL,
    config_level VARCHAR(50) NOT NULL CHECK (config_level IN ('Administrator', 'TechLead', 'Manager', 'Developer')),
    config NVARCHAR(MAX) NOT NULL CHECK (ISJSON(config) = 1), -- Lưu cấu hình dạng JSON và kiểm tra tính hợp lệ
    
    approved_by UNIQUEIDENTIFIER NULL,
    effective_from DATETIME2(3) NOT NULL,
    effective_to DATETIME2(3) NULL,
    
    -- Các cột chuẩn theo quy ước chung của nhóm
    created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    created_by UNIQUEIDENTIFIER NULL,
    updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_by UNIQUEIDENTIFIER NULL,
    row_version ROWVERSION
);