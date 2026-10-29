-- Xoa cac dong audit_log da qua retention_until o MOI workspace dang active (FR-ADM-07).
-- audit_log bi DENY DELETE voi role cua ung dung, nen chi job (chay bang sa/dbo) moi xoa duoc.
USE livingdocs;
GO
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE platform.sp_purge_expired_audit_log
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @schema SYSNAME, @sql NVARCHAR(MAX);

    DECLARE c CURSOR LOCAL FAST_FORWARD FOR
        SELECT schema_name FROM platform.workspace WHERE status = 'active';

    OPEN c;
    FETCH NEXT FROM c INTO @schema;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF OBJECT_ID(QUOTENAME(@schema) + N'.audit_log', N'U') IS NOT NULL
        BEGIN
            SET @sql = N'DELETE FROM ' + QUOTENAME(@schema)
                     + N'.audit_log WHERE retention_until < SYSUTCDATETIME();';
            EXEC sys.sp_executesql @sql;
        END;
        FETCH NEXT FROM c INTO @schema;
    END;
    CLOSE c;
    DEALLOCATE c;
END;
GO

PRINT N'OK: procedure platform.sp_purge_expired_audit_log';
GO
