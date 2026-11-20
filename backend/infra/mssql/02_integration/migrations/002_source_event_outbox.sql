-- Durable source-event delivery. Safe to apply repeatedly to existing tenant schemas.
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF SCHEMA_ID(N'$(SchemaName)') IS NULL
    THROW 51020, N'Tenant schema does not exist.', 1;
IF OBJECT_ID(N'[$(SchemaName)].analysis_run', N'U') IS NULL
   OR OBJECT_ID(N'[$(SchemaName)].source_event', N'U') IS NULL
    THROW 51021, N'Integration tables must be provisioned before the source-event outbox migration.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'[$(SchemaName)].event_outbox', N'U') IS NULL
    BEGIN
        CREATE TABLE [$(SchemaName)].event_outbox
        (
            id                  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_event_outbox PRIMARY KEY,
            event_id            UNIQUEIDENTIFIER NOT NULL,
            analysis_run_id     UNIQUEIDENTIFIER NULL,
            correlation_id      UNIQUEIDENTIFIER NOT NULL,
            payload             NVARCHAR(MAX) NOT NULL,
            status              VARCHAR(20) NOT NULL CONSTRAINT df_event_outbox_status DEFAULT 'pending',
            attempts            INT NOT NULL CONSTRAINT df_event_outbox_attempts DEFAULT 0,
            next_attempt_at     DATETIME2(3) NOT NULL CONSTRAINT df_event_outbox_next DEFAULT SYSUTCDATETIME(),
            locked_until        DATETIME2(3) NULL,
            lock_token          UNIQUEIDENTIFIER NULL,
            last_error          NVARCHAR(2000) NULL,
            created_at          DATETIME2(3) NOT NULL CONSTRAINT df_event_outbox_created DEFAULT SYSUTCDATETIME(),
            sent_at             DATETIME2(3) NULL,
            CONSTRAINT uq_event_outbox_event UNIQUE (event_id),
            CONSTRAINT ck_event_outbox_status CHECK (status IN ('pending','processing','sent')),
            CONSTRAINT ck_event_outbox_attempts CHECK (attempts >= 0),
            CONSTRAINT ck_event_outbox_payload CHECK (ISJSON(payload) = 1)
        );
        CREATE INDEX ix_event_outbox_dispatch
            ON [$(SchemaName)].event_outbox(status, next_attempt_at, locked_until, id)
            INCLUDE (event_id, correlation_id);
    END;

    -- Replay only the explicitly identified stuck baseline SHA. The run rows remain untouched.
    ;WITH target_runs AS (
        SELECT TOP (2) *
        FROM [$(SchemaName)].analysis_run
        WHERE status = 'queued'
          AND trigger_type = 'repository_connected'
          AND head_commit_sha = '608976fc6c56713a496c2efed2019583492523f1'
        ORDER BY created_at, id
    )
    INSERT INTO [$(SchemaName)].event_outbox (event_id, analysis_run_id, correlation_id, payload)
    SELECT ar.id, ar.id, ar.correlation_id,
        (SELECT ar.id AS eventId,
                N'SOURCE_EVENT_RECEIVED' AS [type],
                w.code AS tenant,
                ar.correlation_id AS correlationId,
                ar.created_at AS occurredAt,
                JSON_QUERY((SELECT ar.id AS id,
                                   ar.repository_id AS repositoryId,
                                   N'commit' AS eventType,
                                   CONCAT(N'refs/heads/', r.default_branch) AS githubRef,
                                   N'closed' AS [state],
                                   CONCAT(N'backfill-', CONVERT(NVARCHAR(36), ar.id)) AS deliveryId,
                                   NULL AS diffDigest,
                                   CAST(0 AS bit) AS createdByLivingDocs,
                                   ar.correlation_id AS correlationId,
                                   ar.created_at AS receivedAt,
                                   CONCAT(N'{"after":"', ar.head_commit_sha, N'","analysisRunId":"', CONVERT(NVARCHAR(36), ar.id), N'"}') AS [payload],
                                   ar.id AS analysisRunId
                            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES)) AS [payload]
         FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM target_runs ar
    JOIN [$(SchemaName)].repository r ON r.id = ar.repository_id
    JOIN platform.workspace w ON w.schema_name = N'$(SchemaName)' AND w.status = 'active'
    WHERE NOT EXISTS (SELECT 1 FROM [$(SchemaName)].event_outbox o WHERE o.event_id = ar.id);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

PRINT N'OK: source-event outbox is current for $(SchemaName)';
