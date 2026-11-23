-- Upgrade existing tenant schemas for pollable analysis and durable document generation.
-- Safe to run repeatedly. SchemaName is supplied by db.ps1/db-compose.sh.
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF SCHEMA_ID(N'$(SchemaName)') IS NULL
    THROW 51001, N'Tenant schema does not exist.', 1;

IF NOT EXISTS (
    SELECT 1 FROM platform.workspace
    WHERE schema_name = N'$(SchemaName)'
)
    THROW 51002, N'Tenant workspace is not registered.', 1;

IF OBJECT_ID(N'[$(SchemaName)].repository', N'U') IS NULL
   OR OBJECT_ID(N'[$(SchemaName)].source_event', N'U') IS NULL
   OR OBJECT_ID(N'[$(SchemaName)].ai_job', N'U') IS NULL
    THROW 51003, N'Integration base tables are missing; provision the tenant schema before migrating it.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'[$(SchemaName)].analysis_run', N'U') IS NULL
    BEGIN
        CREATE TABLE [$(SchemaName)].analysis_run
        (
            id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_analysis_run_id DEFAULT NEWSEQUENTIALID(),
            repository_id       UNIQUEIDENTIFIER NOT NULL,
            source_event_id     UNIQUEIDENTIFIER NULL,
            correlation_id      UNIQUEIDENTIFIER NOT NULL,
            trigger_type        VARCHAR(30) NOT NULL,
            base_commit_sha     VARCHAR(64) NULL,
            head_commit_sha     VARCHAR(64) NOT NULL,
            status              VARCHAR(20) NOT NULL CONSTRAINT df_analysis_run_status DEFAULT 'queued',
            files_indexed       INT NOT NULL CONSTRAINT df_analysis_run_files DEFAULT 0,
            entities_indexed    INT NOT NULL CONSTRAINT df_analysis_run_entities DEFAULT 0,
            error_message       NVARCHAR(2000) NULL,
            created_at          DATETIME2(3) NOT NULL CONSTRAINT df_analysis_run_created DEFAULT SYSUTCDATETIME(),
            started_at          DATETIME2(3) NULL,
            completed_at        DATETIME2(3) NULL,
            CONSTRAINT pk_analysis_run PRIMARY KEY (id),
            CONSTRAINT ck_analysis_run_status CHECK (status IN ('queued','running','completed','failed')),
            CONSTRAINT ck_analysis_run_trigger CHECK (trigger_type IN ('repository_connected','pull_request','push')),
            CONSTRAINT ck_analysis_run_files CHECK (files_indexed >= 0 AND entities_indexed >= 0)
        );
    END;

    IF COL_LENGTH('[$(SchemaName)].ai_job', 'request_payload') IS NULL
        ALTER TABLE [$(SchemaName)].ai_job ADD request_payload NVARCHAR(MAX) NULL;
    IF COL_LENGTH('[$(SchemaName)].ai_job', 'result_document_id') IS NULL
        ALTER TABLE [$(SchemaName)].ai_job ADD result_document_id UNIQUEIDENTIFIER NULL;

    IF EXISTS (
        SELECT 1 FROM [$(SchemaName)].analysis_run ar
        LEFT JOIN [$(SchemaName)].repository r ON r.id = ar.repository_id
        WHERE r.id IS NULL
    )
        THROW 51004, N'analysis_run contains repository references that cannot be migrated.', 1;

    IF EXISTS (
        SELECT 1 FROM [$(SchemaName)].analysis_run ar
        LEFT JOIN [$(SchemaName)].source_event se ON se.id = ar.source_event_id
        WHERE ar.source_event_id IS NOT NULL AND se.id IS NULL
    )
        THROW 51005, N'analysis_run contains source-event references that cannot be migrated.', 1;

    IF EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE parent_object_id = OBJECT_ID(N'[$(SchemaName)].analysis_run')
          AND name = N'fk_analysis_run_repository'
          AND (referenced_object_id <> OBJECT_ID(N'[$(SchemaName)].repository')
               OR delete_referential_action_desc <> N'CASCADE')
    )
        ALTER TABLE [$(SchemaName)].analysis_run DROP CONSTRAINT fk_analysis_run_repository;

    IF NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE parent_object_id = OBJECT_ID(N'[$(SchemaName)].analysis_run')
          AND name = N'fk_analysis_run_repository'
    )
        ALTER TABLE [$(SchemaName)].analysis_run WITH CHECK
        ADD CONSTRAINT fk_analysis_run_repository FOREIGN KEY (repository_id)
            REFERENCES [$(SchemaName)].repository(id) ON DELETE CASCADE;

    IF EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE parent_object_id = OBJECT_ID(N'[$(SchemaName)].analysis_run')
          AND name = N'fk_analysis_run_source_event'
          AND (referenced_object_id <> OBJECT_ID(N'[$(SchemaName)].source_event')
               OR delete_referential_action_desc <> N'NO_ACTION')
    )
        ALTER TABLE [$(SchemaName)].analysis_run DROP CONSTRAINT fk_analysis_run_source_event;

    IF NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE parent_object_id = OBJECT_ID(N'[$(SchemaName)].analysis_run')
          AND name = N'fk_analysis_run_source_event'
    )
        ALTER TABLE [$(SchemaName)].analysis_run WITH CHECK
        ADD CONSTRAINT fk_analysis_run_source_event FOREIGN KEY (source_event_id)
            REFERENCES [$(SchemaName)].source_event(id) ON DELETE NO ACTION;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'[$(SchemaName)].analysis_run')
          AND name = N'ix_analysis_run_repository_created'
    )
        CREATE INDEX ix_analysis_run_repository_created
            ON [$(SchemaName)].analysis_run(repository_id, created_at DESC);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

PRINT N'OK: analysis_run and durable generation job schema are current for $(SchemaName)';
