-- Restore ban backup thu cong thanh database tam, so sanh so dong voi database goc, roi xoa database tam.
IF DB_ID(N'livingdocs_restore_test') IS NOT NULL
BEGIN
    ALTER DATABASE livingdocs_restore_test SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE livingdocs_restore_test;
END;
GO

RESTORE DATABASE livingdocs_restore_test
    FROM DISK = N'/var/opt/mssql/data/livingdocs_manual.bak'
    WITH MOVE N'livingdocs'     TO N'/var/opt/mssql/data/livingdocs_restore_test.mdf',
         MOVE N'livingdocs_log' TO N'/var/opt/mssql/data/livingdocs_restore_test.ldf',
         REPLACE, STATS = 25;
GO

SELECT N'platform.workspace' AS bang,
       (SELECT COUNT(*) FROM livingdocs.platform.workspace)              AS goc,
       (SELECT COUNT(*) FROM livingdocs_restore_test.platform.workspace) AS ban_restore
UNION ALL
SELECT N'ws_demo.app_user',
       (SELECT COUNT(*) FROM livingdocs.ws_demo.app_user),
       (SELECT COUNT(*) FROM livingdocs_restore_test.ws_demo.app_user)
UNION ALL
SELECT N'ws_demo.audit_log',
       (SELECT COUNT(*) FROM livingdocs.ws_demo.audit_log),
       (SELECT COUNT(*) FROM livingdocs_restore_test.ws_demo.audit_log);
GO

DROP DATABASE livingdocs_restore_test;
GO
PRINT N'OK: restore thanh cong, da xoa database tam';
GO
