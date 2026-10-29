-- Chay tren database master.
-- Tao database livingdocs va schema dung chung `platform`.

IF DB_ID(N'livingdocs') IS NULL
    CREATE DATABASE livingdocs COLLATE Vietnamese_CI_AS;
GO

-- Moi truong dev: SIMPLE de file log khong phinh to.
-- RPO 24 gio dua vao ban full backup hang ngay (xem 005_agent_jobs.sql).
ALTER DATABASE livingdocs SET RECOVERY SIMPLE;
GO

USE livingdocs;
GO

IF SCHEMA_ID(N'platform') IS NULL
    EXEC (N'CREATE SCHEMA platform');
GO

PRINT N'OK: database livingdocs va schema platform da san sang';
GO
