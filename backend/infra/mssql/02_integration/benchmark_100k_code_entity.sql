-- DỰ ÁN: LivingDocs — AI-Assisted Self-Updating Document System
-- HỌC PHẦN: Hệ Quản trị Cơ sở Dữ liệu (HQTCSDL) — ĐH Giao thông Vận tải TP.HCM (UTH)
-- PHÂN HỆ: 02_integration (GitHub, Code, Job AI)
-- TÁC GIẢ: Hiếu aka silas (Integration Subsystem Lead)


SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

-- 1. Chuẩn bị dữ liệu mẫu ban đầu: 1 Connection và 1 Repository
DECLARE @conn_id UNIQUEIDENTIFIER = NEWID();
DECLARE @repo_id UNIQUEIDENTIFIER = NEWID();
DECLARE @bench_user_id UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM [$(SchemaName)].app_user);

IF NOT EXISTS (SELECT 1 FROM [$(SchemaName)].github_connection WHERE installation_id = N'inst_benchmark_test')
BEGIN
    INSERT INTO [$(SchemaName)].github_connection 
    (id, installation_id, account_login, access_token_enc, status, connected_by)
    VALUES 
    (@conn_id, N'inst_benchmark_test', N'org_livingdocs_bench', 0x0123456789ABCDEF, 'active', ISNULL(@bench_user_id, NEWID()));
END
ELSE
BEGIN
    SELECT @conn_id = id FROM [$(SchemaName)].github_connection WHERE installation_id = N'inst_benchmark_test';
END;

IF NOT EXISTS (SELECT 1 FROM [$(SchemaName)].repository WHERE github_repo_id = 99999999)
BEGIN
    INSERT INTO [$(SchemaName)].repository 
    (id, connection_id, github_repo_id, full_name, default_branch, connection_status)
    VALUES 
    (@repo_id, @conn_id, 99999999, N'livingdocs/core-monolith', N'main', 'connected');
END
ELSE
BEGIN
    SELECT @repo_id = id FROM [$(SchemaName)].repository WHERE github_repo_id = 99999999;
END;

PRINT N'>> Bắt đầu sinh 100.000 dòng dữ liệu giả cho bảng code_entity...';

-- 2. Sinh 100.000 dòng bằng T-SQL CTE đệ quy chéo (Nhanh vượt trội so với vòng lặp WHILE)
;WITH T10 AS (
    SELECT n FROM (VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10)) AS v(n)
),
T100K AS (
    -- Tích Descartes: 10 * 10 * 10 * 10 * 10 = 100.000 dòng
    SELECT ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS idx
    FROM T10 a CROSS JOIN T10 b CROSS JOIN T10 c CROSS JOIN T10 d CROSS JOIN T10 e
)
INSERT INTO [$(SchemaName)].code_entity
(
    id,
    repository_id,
    parent_id,
    kind,
    name,
    signature,
    file_path,
    commit_hash,
    removed_at,
    created_at
)
SELECT 
    NEWID(),
    @repo_id,
    NULL,
    CASE (idx % 4)
        WHEN 0 THEN 'class'
        WHEN 1 THEN 'method'
        WHEN 2 THEN 'endpoint'
        ELSE 'parameter'
    END,
    CONCAT(
        CASE (idx % 4)
            WHEN 0 THEN N'ServiceController_'
            WHEN 1 THEN N'processDataAction_'
            WHEN 2 THEN N'/api/v1/resource_'
            ELSE N'param_query_'
        END,
        idx
    ),
    CONCAT(N'public async Task<Result> ExecuteAsync(int id_', idx, N', string token)'),
    CONCAT(N'src/services/module_', (idx % 500), N'/handler_', (idx % 50), N'.ts'),
    CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', CAST(idx AS VARCHAR(20))), 2),
    CASE WHEN (idx % 20 = 0) THEN SYSUTCDATETIME() ELSE NULL END, -- 5% là thực thể đã bị xóa
    DATEADD(MINUTE, -idx, SYSUTCDATETIME())
FROM T100K;

DECLARE @total_rows INT;
SELECT @total_rows = COUNT(1) FROM [$(SchemaName)].code_entity WHERE repository_id = @repo_id;
PRINT CONCAT(N'>> Sinh dữ liệu hoàn tất! Tổng số dòng hiện tại trong code_entity: ', @total_rows);
GO

-- 3. KỊCH BẢN ĐO LƯỜNG HIỆU NĂNG & EXECUTION PLAN
-- Hướng dẫn: Bật 'Include Actual Execution Plan' (Ctrl + M) trong SSMS/Azure Data Studio để so sánh Table Scan vs Index Seek

PRINT N'====================================================================';
PRINT N'BẮT ĐẦU TEST 1: Tìm kiếm theo (repository_id, file_path)';
PRINT N'====================================================================';

SET STATISTICS IO ON;
SET STATISTICS TIME ON;

-- TRƯỜNG HỢP A: Ép buộc Clustered Index Scan (Mô phỏng khi KHÔNG CÓ Index ix_code_entity_repo_file)
SELECT id, name, kind, signature, commit_hash
FROM [$(SchemaName)].code_entity WITH (INDEX(0))
WHERE repository_id = (SELECT TOP 1 id FROM [$(SchemaName)].repository WHERE github_repo_id = 99999999)
  AND file_path = N'src/services/module_125/handler_25.ts';

-- TRƯỜNG HỢP B: Tự động dùng Non-Clustered Index Seek (ix_code_entity_repo_file)
SELECT id, name, kind, signature, commit_hash
FROM [$(SchemaName)].code_entity
WHERE repository_id = (SELECT TOP 1 id FROM [$(SchemaName)].repository WHERE github_repo_id = 99999999)
  AND file_path = N'src/services/module_125/handler_25.ts';

SET STATISTICS IO OFF;
SET STATISTICS TIME OFF;
GO

PRINT N'====================================================================';
PRINT N'BẮT ĐẦU TEST 2: Tìm kiếm theo Entity Name (RAG / Drift Detector)';
PRINT N'====================================================================';

SET STATISTICS IO ON;
SET STATISTICS TIME ON;

-- TRƯỜNG HỢP A: Ép Clustered Scan (Không Index)
SELECT id, kind, file_path, signature
FROM [$(SchemaName)].code_entity WITH (INDEX(0))
WHERE repository_id = (SELECT TOP 1 id FROM [$(SchemaName)].repository WHERE github_repo_id = 99999999)
  AND name = N'ServiceController_50000';

-- TRƯỜNG HỢP B: Tối ưu với Index Seek (ix_code_entity_repo_name)
SELECT id, kind, file_path, signature
FROM [$(SchemaName)].code_entity
WHERE repository_id = (SELECT TOP 1 id FROM [$(SchemaName)].repository WHERE github_repo_id = 99999999)
  AND name = N'ServiceController_50000';

SET STATISTICS IO OFF;
SET STATISTICS TIME OFF;
GO
