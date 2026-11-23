-- Verify durable source-event delivery schema and report only the approved baseline SHA.
SET NOCOUNT ON;

IF OBJECT_ID(N'[$(SchemaName)].event_outbox', N'U') IS NULL
    THROW 59200, N'FAIL: event_outbox table is missing.', 1;
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[$(SchemaName)].event_outbox')
      AND name = N'ix_event_outbox_dispatch'
)
    THROW 59201, N'FAIL: event_outbox dispatch index is missing.', 1;
IF EXISTS (SELECT 1 FROM [$(SchemaName)].event_outbox WHERE ISJSON(payload) <> 1)
    THROW 59202, N'FAIL: event_outbox contains invalid JSON.', 1;
IF EXISTS (
    SELECT 1
    FROM [$(SchemaName)].event_outbox
    WHERE analysis_run_id IS NOT NULL
      AND JSON_VALUE(payload, '$.eventId') <> CONVERT(NVARCHAR(36), event_id)
)
    THROW 59203, N'FAIL: outbox envelope event id does not match its row.', 1;

SELECT ar.id AS analysis_run_id,
       ar.repository_id,
       ar.status AS run_status,
       ar.started_at,
       ar.completed_at,
       o.status AS outbox_status,
       o.attempts,
       LEFT(o.last_error, 120) AS last_error,
       o.sent_at
FROM [$(SchemaName)].analysis_run ar
LEFT JOIN [$(SchemaName)].event_outbox o ON o.analysis_run_id = ar.id
WHERE ar.status IN ('queued','running','completed','failed')
  AND ar.trigger_type = 'repository_connected'
  AND ar.head_commit_sha = '608976fc6c56713a496c2efed2019583492523f1'
ORDER BY ar.created_at, ar.id;

PRINT N'PASS: source-event outbox schema and envelope integrity';
