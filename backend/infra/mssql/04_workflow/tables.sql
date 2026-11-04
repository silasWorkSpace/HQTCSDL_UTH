-- DỰ ÁN: LivingDocs — AI-Assisted Self-Updating Document System
-- HỌC PHẦN: Hệ Quản trị Cơ sở Dữ liệu (HQTCSDL) — ĐH Giao thông Vận tải TP.HCM (UTH)
-- PHÂN HỆ: 04_workflow (Policy, Drift Alert, Review & Workflow)

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- 1. BẢNG: policy
IF OBJECT_ID(N'[$(SchemaName)].policy', N'U') IS NULL
BEGIN
    CREATE TABLE [$(SchemaName)].policy (
        id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_policy_id DEFAULT NEWSEQUENTIALID(),
        policy_type     VARCHAR(50)      NOT NULL,
        scope_level     VARCHAR(50)      NOT NULL,
        scope_id        UNIQUEIDENTIFIER NULL,
        config_level    VARCHAR(50)      NOT NULL,
        config          NVARCHAR(MAX)    NOT NULL,
        approved_by     UNIQUEIDENTIFIER NULL,
        effective_from  DATETIME2(3)     NOT NULL,
        effective_to    DATETIME2(3)     NULL,
        created_at      DATETIME2(3)     NOT NULL CONSTRAINT df_policy_created_at DEFAULT SYSUTCDATETIME(),
        created_by      UNIQUEIDENTIFIER NULL,
        updated_at      DATETIME2(3)     NOT NULL CONSTRAINT df_policy_updated_at DEFAULT SYSUTCDATETIME(),
        updated_by      UNIQUEIDENTIFIER NULL,
        row_version     ROWVERSION       NOT NULL,
        CONSTRAINT pk_policy PRIMARY KEY (id),
        CONSTRAINT ck_policy_type CHECK (policy_type IN ('drift', 'auto_update', 'auto_apply', 'merge', 'manager_required_type')),
        CONSTRAINT ck_policy_config_level CHECK (config_level IN ('Administrator', 'TechLead', 'Manager', 'Developer')),
        CONSTRAINT ck_policy_config_json CHECK (ISJSON(config) = 1)
    );
END;
GO

-- 2. BẢNG: drift_alert
IF OBJECT_ID(N'[$(SchemaName)].drift_alert', N'U') IS NULL
BEGIN
    CREATE TABLE [$(SchemaName)].drift_alert (
        id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_drift_alert_id DEFAULT NEWSEQUENTIALID(),
        source_event_id UNIQUEIDENTIFIER NOT NULL,
        document_id     UNIQUEIDENTIFIER NOT NULL,
        drift_type      VARCHAR(50)      NOT NULL,
        severity        VARCHAR(50)      NOT NULL,
        evidence        NVARCHAR(MAX)    NOT NULL,
        handling_status VARCHAR(50)      NOT NULL,
        created_at      DATETIME2(3)     NOT NULL CONSTRAINT df_drift_alert_created_at DEFAULT SYSUTCDATETIME(),
        updated_at      DATETIME2(3)     NOT NULL CONSTRAINT df_drift_alert_updated_at DEFAULT SYSUTCDATETIME(),
        row_version     ROWVERSION       NOT NULL,
        CONSTRAINT pk_drift_alert PRIMARY KEY (id),
        CONSTRAINT ck_drift_alert_type CHECK (drift_type IN ('Referential', 'Signature', 'Semantic')),
        CONSTRAINT ck_drift_alert_severity CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
        CONSTRAINT ck_drift_alert_evidence_json CHECK (ISJSON(evidence) = 1),
        CONSTRAINT uq_drift_alert_source_doc_type UNIQUE (source_event_id, document_id, drift_type)
    );
END;
GO

-- 3. BẢNG: update_suggestion
IF OBJECT_ID(N'[$(SchemaName)].update_suggestion', N'U') IS NULL
BEGIN
    CREATE TABLE [$(SchemaName)].update_suggestion (
        id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_update_suggestion_id DEFAULT NEWSEQUENTIALID(),
        document_id         UNIQUEIDENTIFIER NOT NULL,
        drift_alert_id      UNIQUEIDENTIFIER NULL,
        origin              VARCHAR(50)      NOT NULL,
        content             NVARCHAR(MAX)    NOT NULL,
        confidence_score    DECIMAL(3,2)     NOT NULL,
        evidence            NVARCHAR(MAX)    NULL,
        status              VARCHAR(50)      NOT NULL,
        dismiss_reason      NVARCHAR(MAX)    NULL,
        auto_apply_eligible BIT              NOT NULL CONSTRAINT df_update_suggestion_auto_apply DEFAULT 0,
        created_at          DATETIME2(3)     NOT NULL CONSTRAINT df_update_suggestion_created_at DEFAULT SYSUTCDATETIME(),
        updated_at          DATETIME2(3)     NOT NULL CONSTRAINT df_update_suggestion_updated_at DEFAULT SYSUTCDATETIME(),
        row_version         ROWVERSION       NOT NULL,
        CONSTRAINT pk_update_suggestion PRIMARY KEY (id),
        CONSTRAINT ck_update_suggestion_confidence CHECK (confidence_score BETWEEN 0.00 AND 1.00),
        CONSTRAINT ck_update_suggestion_evidence CHECK (evidence IS NULL OR ISJSON(evidence) = 1),
        CONSTRAINT ck_update_suggestion_status CHECK (status IN ('Pending Developer Action', 'Accepted', 'Dismissed', 'Superseded'))
    );
END;
GO

-- 4. BẢNG: review_task
IF OBJECT_ID(N'[$(SchemaName)].review_task', N'U') IS NULL
BEGIN
    CREATE TABLE [$(SchemaName)].review_task (
        id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_review_task_id DEFAULT NEWSEQUENTIALID(),
        document_id         UNIQUEIDENTIFIER NOT NULL,
        document_version_id UNIQUEIDENTIFIER NOT NULL,
        level               VARCHAR(50)      NOT NULL,
        submitter_id        UNIQUEIDENTIFIER NOT NULL,
        assignee_id         UNIQUEIDENTIFIER NULL,
        status              VARCHAR(50)      NOT NULL,
        created_at          DATETIME2(3)     NOT NULL CONSTRAINT df_review_task_created_at DEFAULT SYSUTCDATETIME(),
        updated_at          DATETIME2(3)     NOT NULL CONSTRAINT df_review_task_updated_at DEFAULT SYSUTCDATETIME(),
        row_version         ROWVERSION       NOT NULL,
        CONSTRAINT pk_review_task PRIMARY KEY (id),
        CONSTRAINT ck_review_task_level CHECK (level IN ('Staff', 'Manager'))
    );
END;
GO

-- 5. BẢNG: review_decision
IF OBJECT_ID(N'[$(SchemaName)].review_decision', N'U') IS NULL
BEGIN
    CREATE TABLE [$(SchemaName)].review_decision (
        id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_review_decision_id DEFAULT NEWSEQUENTIALID(),
        review_task_id  UNIQUEIDENTIFIER NOT NULL,
        reviewer_id     UNIQUEIDENTIFIER NOT NULL,
        decision        VARCHAR(50)      NOT NULL,
        reason          NVARCHAR(MAX)    NULL,
        decided_at      DATETIME2(3)     NOT NULL CONSTRAINT df_review_decision_decided_at DEFAULT SYSUTCDATETIME(),
        row_version     ROWVERSION       NOT NULL,
        CONSTRAINT pk_review_decision PRIMARY KEY (id),
        CONSTRAINT fk_review_decision_task FOREIGN KEY (review_task_id) REFERENCES [$(SchemaName)].review_task(id) ON DELETE CASCADE
    );
END;
GO

-- 6. BẢNG: review_comment
IF OBJECT_ID(N'[$(SchemaName)].review_comment', N'U') IS NULL
BEGIN
    CREATE TABLE [$(SchemaName)].review_comment (
        id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_review_comment_id DEFAULT NEWSEQUENTIALID(),
        review_task_id  UNIQUEIDENTIFIER NOT NULL,
        user_id         UNIQUEIDENTIFIER NOT NULL,
        content         NVARCHAR(MAX)    NOT NULL,
        line_number     INT              NULL,
        created_at      DATETIME2(3)     NOT NULL CONSTRAINT df_review_comment_created_at DEFAULT SYSUTCDATETIME(),
        updated_at      DATETIME2(3)     NOT NULL CONSTRAINT df_review_comment_updated_at DEFAULT SYSUTCDATETIME(),
        row_version     ROWVERSION       NOT NULL,
        CONSTRAINT pk_review_comment PRIMARY KEY (id),
        CONSTRAINT fk_review_comment_task FOREIGN KEY (review_task_id) REFERENCES [$(SchemaName)].review_task(id) ON DELETE CASCADE
    );
END;
GO

-- 7. BẢNG: document_status_transition
IF OBJECT_ID(N'[$(SchemaName)].document_status_transition', N'U') IS NULL
BEGIN
    CREATE TABLE [$(SchemaName)].document_status_transition (
        id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_doc_status_trans_id DEFAULT NEWSEQUENTIALID(),
        from_status     VARCHAR(100)     NOT NULL,
        to_status       VARCHAR(100)     NOT NULL,
        allowed_role    VARCHAR(100)     NOT NULL,
        CONSTRAINT pk_doc_status_transition PRIMARY KEY (id),
        CONSTRAINT uq_status_transition UNIQUE (from_status, to_status, allowed_role)
    );
END;
GO

PRINT N'OK: 04_workflow tables.sql cho schema $(SchemaName)';
GO
