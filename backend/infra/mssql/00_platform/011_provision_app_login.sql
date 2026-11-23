:ON ERROR EXIT
SET NOCOUNT ON;
GO

USE [livingdocs];
GO

DECLARE @AppLogin sysname = N'$(AppUser)';
DECLARE @AppPassword nvarchar(128) = N'$(AppPassword)';

IF LEN(@AppLogin) < 3 OR LEN(@AppLogin) > 30
   OR LEFT(@AppLogin, 1) COLLATE Latin1_General_100_BIN2 NOT LIKE N'[A-Za-z]'
   OR @AppLogin COLLATE Latin1_General_100_BIN2 LIKE N'%[^A-Za-z0-9_]%' 
    THROW 51000, 'AppUser must start with a letter and contain only letters, digits, and underscores.', 1;
IF LEN(@AppLogin) > 30 OR LEN(@AppPassword) < 16 OR LEN(@AppPassword) > 128
    THROW 51001, 'AppUser or AppPassword has an invalid length.', 1;
IF SCHEMA_ID(N'platform') IS NULL OR OBJECT_ID(N'platform.workspace', N'U') IS NULL
    THROW 51002, 'Initialize the platform schema before provisioning the application login.', 1;

DECLARE @Sql nvarchar(max);
IF SUSER_ID(@AppLogin) IS NULL
    SET @Sql = N'CREATE LOGIN ' + QUOTENAME(@AppLogin) + N' WITH PASSWORD = '
             + QUOTENAME(@AppPassword, '''') + N', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;';
ELSE
    SET @Sql = N'ALTER LOGIN ' + QUOTENAME(@AppLogin) + N' WITH PASSWORD = '
             + QUOTENAME(@AppPassword, '''') + N', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;';
EXEC sys.sp_executesql @Sql;

IF DATABASE_PRINCIPAL_ID(@AppLogin) IS NULL
BEGIN
    SET @Sql = N'CREATE USER ' + QUOTENAME(@AppLogin) + N' FOR LOGIN ' + QUOTENAME(@AppLogin) + N';';
    EXEC sys.sp_executesql @Sql;
END;

SET @Sql = N'GRANT SELECT ON OBJECT::platform.workspace TO ' + QUOTENAME(@AppLogin) + N';';
EXEC sys.sp_executesql @Sql;

DECLARE @SchemaName sysname;
DECLARE tenant_schemas CURSOR LOCAL FAST_FORWARD FOR
    SELECT name FROM sys.schemas WHERE name LIKE N'ws[_]%' ORDER BY name;
OPEN tenant_schemas;
FETCH NEXT FROM tenant_schemas INTO @SchemaName;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @Sql = N'GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::' + QUOTENAME(@SchemaName)
             + N' TO ' + QUOTENAME(@AppLogin) + N'; GRANT EXECUTE ON SCHEMA::'
             + QUOTENAME(@SchemaName) + N' TO ' + QUOTENAME(@AppLogin) + N';';
    EXEC sys.sp_executesql @Sql;
    FETCH NEXT FROM tenant_schemas INTO @SchemaName;
END;
CLOSE tenant_schemas;
DEALLOCATE tenant_schemas;

PRINT N'Application login provisioned with workspace metadata read access and tenant-schema data/execute grants.';
GO
