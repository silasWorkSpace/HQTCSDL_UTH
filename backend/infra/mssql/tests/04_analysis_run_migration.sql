-- Verify analysis_run migration metadata and the selected delete semantics.
SET NOCOUNT ON;
SET XACT_ABORT OFF;

IF OBJECT_ID(N'[$(SchemaName)].analysis_run', N'U') IS NULL
    THROW 59100, N'FAIL: analysis_run table is missing.', 1;
IF COL_LENGTH('[$(SchemaName)].ai_job', 'request_payload') IS NULL
   OR COL_LENGTH('[$(SchemaName)].ai_job', 'result_document_id') IS NULL
    THROW 59101, N'FAIL: durable generation job columns are missing.', 1;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID(N'[$(SchemaName)].analysis_run')
      AND name = N'fk_analysis_run_repository'
      AND delete_referential_action_desc = N'CASCADE'
) THROW 59102, N'FAIL: repository cascade action is not configured.', 1;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID(N'[$(SchemaName)].analysis_run')
      AND name = N'fk_analysis_run_source_event'
      AND delete_referential_action_desc = N'NO_ACTION'
) THROW 59103, N'FAIL: source-event reference must use NO ACTION.', 1;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[$(SchemaName)].analysis_run')
      AND name = N'ix_analysis_run_repository_created'
) THROW 59104, N'FAIL: analysis_run repository index is missing.', 1;

DECLARE @user_id UNIQUEIDENTIFIER = (SELECT TOP (1) id FROM [$(SchemaName)].app_user ORDER BY created_at);
IF @user_id IS NULL
    THROW 59105, N'Cannot test delete semantics: seed at least one app_user first.', 1;

DECLARE @connection_id UNIQUEIDENTIFIER = NEWID();
DECLARE @repository_id UNIQUEIDENTIFIER = NEWID();
DECLARE @source_event_id UNIQUEIDENTIFIER = NEWID();
DECLARE @analysis_run_id UNIQUEIDENTIFIER = NEWID();
DECLARE @blocked BIT = 0;
DECLARE @error_number INT;

BEGIN TRY
    BEGIN TRANSACTION;
    INSERT INTO [$(SchemaName)].github_connection
        (id, installation_id, account_login, access_token_enc, status, connected_by)
    VALUES
        (@connection_id, N'migration-test-' + CONVERT(NVARCHAR(36), @connection_id),
         N'migration-test', 0x01, 'active', @user_id);

    INSERT INTO [$(SchemaName)].repository
        (id, connection_id, github_repo_id, full_name, default_branch, connection_status)
    VALUES
        (@repository_id, @connection_id, 1, N'migration-test/repo', N'main', 'connected');

    INSERT INTO [$(SchemaName)].source_event
        (id, repository_id, event_type, github_ref, state, delivery_id, correlation_id)
    VALUES
        (@source_event_id, @repository_id, 'pr', N'refs/pull/1/head', 'open',
         CONVERT(VARCHAR(36), NEWID()), NEWID());

    INSERT INTO [$(SchemaName)].analysis_run
        (id, repository_id, source_event_id, correlation_id, trigger_type, head_commit_sha)
    VALUES
        (@analysis_run_id, @repository_id, @source_event_id, NEWID(), 'pull_request', REPLICATE('a', 40));
    COMMIT TRANSACTION;

    -- Run this in autocommit mode because the append-only trigger intentionally
    -- rolls back a transaction that attempts to delete a source event directly.
    BEGIN TRY
        DELETE FROM [$(SchemaName)].source_event WHERE id = @source_event_id;
    END TRY
    BEGIN CATCH
        SET @error_number = ERROR_NUMBER();
        IF @error_number IN (547, 50000) SET @blocked = 1;
        ELSE THROW;
    END CATCH;

    IF @blocked = 0
        THROW 59106, N'FAIL: deleting a source event referenced by analysis_run was not blocked.', 1;
    IF NOT EXISTS (SELECT 1 FROM [$(SchemaName)].source_event WHERE id = @source_event_id)
       OR NOT EXISTS (SELECT 1 FROM [$(SchemaName)].analysis_run WHERE id = @analysis_run_id)
        THROW 59108, N'FAIL: direct source-event deletion changed the protected event/run.', 1;

    DELETE FROM [$(SchemaName)].repository WHERE id = @repository_id;
    IF EXISTS (SELECT 1 FROM [$(SchemaName)].analysis_run WHERE id = @analysis_run_id)
       OR EXISTS (SELECT 1 FROM [$(SchemaName)].source_event WHERE id = @source_event_id)
        THROW 59107, N'FAIL: deleting a repository did not cascade to analysis_run and source_event.', 1;

    DELETE FROM [$(SchemaName)].github_connection WHERE id = @connection_id;
    PRINT N'PASS: analysis_run migration schema and delete semantics';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
