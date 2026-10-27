-- Hai job SQL Server Agent. Container chay gio UTC, nen:
--   19:00 UTC = 02:00 gio Viet Nam  -> full backup
--   20:00 UTC = 03:00 gio Viet Nam  -> don audit_log het han
USE msdb;
GO

IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = N'livingdocs_daily_backup')
    EXEC msdb.dbo.sp_delete_job @job_name = N'livingdocs_daily_backup';
IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = N'livingdocs_purge_audit_log')
    EXEC msdb.dbo.sp_delete_job @job_name = N'livingdocs_purge_audit_log';
GO

-- ===== Job 1: full backup hang ngay =====
EXEC msdb.dbo.sp_add_job
    @job_name = N'livingdocs_daily_backup',
    @description = N'Full backup database livingdocs moi ngay (RPO 24 gio)';

EXEC msdb.dbo.sp_add_jobstep
    @job_name = N'livingdocs_daily_backup',
    @step_name = N'backup_full',
    @subsystem = N'TSQL',
    @database_name = N'master',
    @command = N'DECLARE @f NVARCHAR(400) = N''/var/opt/mssql/data/livingdocs_'' + FORMAT(SYSUTCDATETIME(), ''yyyyMMdd_HHmm'') + N''.bak''; BACKUP DATABASE livingdocs TO DISK = @f WITH COMPRESSION, CHECKSUM, INIT;';

EXEC msdb.dbo.sp_add_jobschedule
    @job_name = N'livingdocs_daily_backup',
    @name = N'hang_ngay_19h_utc',
    @freq_type = 4,
    @freq_interval = 1,
    @active_start_time = 190000;

EXEC msdb.dbo.sp_add_jobserver @job_name = N'livingdocs_daily_backup', @server_name = N'(local)';
GO

-- ===== Job 2: don audit_log het han =====
EXEC msdb.dbo.sp_add_job
    @job_name = N'livingdocs_purge_audit_log',
    @description = N'Xoa audit_log qua retention_until o moi workspace';

EXEC msdb.dbo.sp_add_jobstep
    @job_name = N'livingdocs_purge_audit_log',
    @step_name = N'purge',
    @subsystem = N'TSQL',
    @database_name = N'livingdocs',
    @command = N'EXEC platform.sp_purge_expired_audit_log;';

EXEC msdb.dbo.sp_add_jobschedule
    @job_name = N'livingdocs_purge_audit_log',
    @name = N'hang_ngay_20h_utc',
    @freq_type = 4,
    @freq_interval = 1,
    @active_start_time = 200000;

EXEC msdb.dbo.sp_add_jobserver @job_name = N'livingdocs_purge_audit_log', @server_name = N'(local)';
GO

PRINT N'OK: 2 job SQL Server Agent';
GO
