-- DỰ ÁN: LivingDocs — AI-Assisted Self-Updating Document System
-- HỌC PHẦN: Hệ Quản trị Cơ sở Dữ liệu (HQTCSDL) — ĐH Giao thông Vận tải TP.HCM (UTH)
-- PHÂN HỆ: 02_integration Seed Data
-- TÁC GIẢ: Hiếu aka silas (Integration Subsystem Lead)

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

DECLARE @admin_id UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM [$(SchemaName)].app_user WHERE email LIKE N'admin%');
IF @admin_id IS NULL
    SET @admin_id = (SELECT TOP 1 id FROM [$(SchemaName)].app_user);

IF @admin_id IS NOT NULL
BEGIN
    DECLARE @conn_id UNIQUEIDENTIFIER;
    SELECT @conn_id = id FROM [$(SchemaName)].github_connection WHERE installation_id = N'inst_' + N'$(SchemaName)';

    IF @conn_id IS NULL
    BEGIN
        SET @conn_id = NEWID();
        INSERT INTO [$(SchemaName)].github_connection 
        (id, installation_id, account_login, access_token_enc, status, connected_by)
        VALUES 
        (@conn_id, N'inst_' + N'$(SchemaName)', N'livingdocs_org', 0xDEADBEEF, 'active', @admin_id);
    END;

    DECLARE @repo_id UNIQUEIDENTIFIER;
    SELECT @repo_id = id FROM [$(SchemaName)].repository WHERE full_name = N'livingdocs/' + N'$(SchemaName)' + N'-core';

    IF @repo_id IS NULL
    BEGIN
        SET @repo_id = NEWID();
        INSERT INTO [$(SchemaName)].repository 
        (id, connection_id, github_repo_id, full_name, default_branch, connection_status)
        VALUES 
        (@repo_id, @conn_id, 10001, N'livingdocs/' + N'$(SchemaName)' + N'-core', N'main', 'connected');
    END;

    -- Seed 2 code entities cơ bản
    IF NOT EXISTS (SELECT 1 FROM [$(SchemaName)].code_entity WHERE repository_id = @repo_id)
    BEGIN
        DECLARE @c1 UNIQUEIDENTIFIER = NEWID();
        INSERT INTO [$(SchemaName)].code_entity (id, repository_id, parent_id, kind, name, signature, file_path, commit_hash)
        VALUES 
        (@c1, @repo_id, NULL, 'class', N'DocumentController', N'public class DocumentController', N'src/controllers/DocumentController.ts', 'hash_seed_001'),
        (NEWID(), @repo_id, @c1, 'endpoint', N'/api/v1/documents', N'public async Task<IActionResult> GetDocuments()', N'src/controllers/DocumentController.ts', 'hash_seed_001');
    END;
END;
GO

PRINT N'OK: seed 02_integration cho schema $(SchemaName)';
GO
