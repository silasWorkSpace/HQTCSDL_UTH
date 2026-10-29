-- Tao mot workspace moi: dang ky vao platform.workspace, tao schema ws_<code>,
-- tao role role_ws_<code> va cap quyen DML tren schema do.
-- Cac bang cua tung module duoc tao boi db.ps1 (lenh `tenant`) ngay sau khi procedure nay chay xong.
USE livingdocs;
GO
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE platform.sp_create_workspace
    @code VARCHAR(30),
    @name NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Kiem tra ky tu truoc khi ghep vao cau lenh dong (chong SQL injection)
    IF @code IS NULL OR LEN(@code) < 2 OR @code COLLATE Latin1_General_100_BIN2 LIKE '%[^a-z0-9_]%'
        THROW 50001, N'Ma workspace chi gom a-z, 0-9, dau gach duoi va dai it nhat 2 ky tu.', 1;

    IF EXISTS (SELECT 1 FROM platform.workspace WHERE code = @code)
        THROW 50002, N'Workspace da ton tai.', 1;

    DECLARE @schema SYSNAME = N'ws_' + @code;
    DECLARE @role   SYSNAME = N'role_ws_' + @code;
    DECLARE @sql    NVARCHAR(MAX);

    BEGIN TRAN;

        INSERT INTO platform.workspace (code, name, schema_name, config)
        VALUES (@code, @name, @schema, N'{"audit_retention_days": 365}');

        SET @sql = N'CREATE SCHEMA ' + QUOTENAME(@schema) + N';';
        EXEC sys.sp_executesql @sql;

        SET @sql = N'CREATE ROLE ' + QUOTENAME(@role) + N';';
        EXEC sys.sp_executesql @sql;

        -- Quyen o muc schema: ap dung cho ca bang tao sau nay
        SET @sql = N'GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::' + QUOTENAME(@schema)
                 + N' TO ' + QUOTENAME(@role) + N';';
        EXEC sys.sp_executesql @sql;

    COMMIT;

    SELECT @schema AS schema_name, @role AS role_name;
END;
GO

PRINT N'OK: procedure platform.sp_create_workspace';
GO
