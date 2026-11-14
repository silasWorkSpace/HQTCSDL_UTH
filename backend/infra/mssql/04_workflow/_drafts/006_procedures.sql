-- File: 006_procedures.sql
-- Mô tả: Tổng hợp các Stored Procedures cho cụm Workflow, Policy & Drift[cite: 1]

-- 1. Stored Procedure thêm mới một Policy
CREATE OR ALTER PROCEDURE sp_create_policy
    @policy_type VARCHAR(50),
    @scope_level VARCHAR(50),
    @scope_id UNIQUEIDENTIFIER = NULL,
    @config_level VARCHAR(50),
    @config NVARCHAR(MAX),
    @approved_by UNIQUEIDENTIFIER = NULL,
    @effective_from DATETIME2(3),
    @effective_to DATETIME2(3) = NULL,
    @created_by UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO policy (
        policy_type, scope_level, scope_id, config_level, config,
        approved_by, effective_from, effective_to, created_by
    )
    OUTPUT INSERTED.id
    VALUES (
        @policy_type, @scope_level, @scope_id, @config_level, @config,
        @approved_by, @effective_from, @effective_to, @created_by
    );
END;
GO

-- 2. Stored Procedure tạo cảnh báo Drift Alert mới
CREATE OR ALTER PROCEDURE sp_create_drift_alert
    @source_event_id UNIQUEIDENTIFIER,
    @document_id UNIQUEIDENTIFIER,
    @drift_type VARCHAR(50),
    @severity VARCHAR(50),
    @evidence NVARCHAR(MAX),
    @handling_status VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO drift_alert (
        source_event_id, document_id, drift_type, severity, evidence, handling_status
    )
    OUTPUT INSERTED.id
    VALUES (
        @source_event_id, @document_id, @drift_type, @severity, @evidence, @handling_status
    );
END;
GO