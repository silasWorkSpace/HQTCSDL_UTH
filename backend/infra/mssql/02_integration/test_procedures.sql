-- DỰ ÁN: LivingDocs — AI-Assisted Self-Updating Document System
-- HỌC PHẦN: Hệ Quản trị Cơ sở Dữ liệu (HQTCSDL) — ĐH Giao thông Vận tải TP.HCM (UTH)
-- PHÂN HỆ: 02_integration (GitHub, Code, Job AI)
-- TÁC GIẢ: Hiếu aka silas (Integration Subsystem Lead)


SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
PRINT N'====================================================================';
PRINT N'BẮT ĐẦU CHUỖI KIỂM THỬ PHÂN HỆ 02_INTEGRATION';
PRINT N'====================================================================';

-- Dữ liệu giả lập
DECLARE @test_conn_id UNIQUEIDENTIFIER = NEWID();
DECLARE @test_repo_id UNIQUEIDENTIFIER = NEWID();
DECLARE @test_user_id UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM [$(SchemaName)].app_user);

IF NOT EXISTS (SELECT 1 FROM [$(SchemaName)].github_connection WHERE installation_id = N'inst_test_001')
BEGIN
    INSERT INTO [$(SchemaName)].github_connection 
    (id, installation_id, account_login, access_token_enc, status, connected_by)
    VALUES 
    (@test_conn_id, N'inst_test_001', N'tester_hieu', 0xDEADBEEF, 'active', ISNULL(@test_user_id, NEWID()));

    INSERT INTO [$(SchemaName)].repository 
    (id, connection_id, github_repo_id, full_name, default_branch, connection_status)
    VALUES 
    (@test_repo_id, @test_conn_id, 12345678, N'tester_hieu/demo-repo', N'main', 'connected');
END
ELSE
BEGIN
    SELECT @test_conn_id = id FROM [$(SchemaName)].github_connection WHERE installation_id = N'inst_test_001';
    IF NOT EXISTS (SELECT 1 FROM [$(SchemaName)].repository WHERE github_repo_id = 12345678)
    BEGIN
        INSERT INTO [$(SchemaName)].repository 
        (id, connection_id, github_repo_id, full_name, default_branch, connection_status)
        VALUES 
        (@test_repo_id, @test_conn_id, 12345678, N'tester_hieu/demo-repo', N'main', 'connected');
    END
    ELSE
    BEGIN
        SELECT @test_repo_id = id FROM [$(SchemaName)].repository WHERE github_repo_id = 12345678;
        UPDATE [$(SchemaName)].repository SET connection_status = 'connected' WHERE id = @test_repo_id;
        UPDATE [$(SchemaName)].github_connection SET status = 'active', access_token_enc = 0xDEADBEEF WHERE id = @test_conn_id;
    END;
END;

PRINT N'>> [Setup] Đã sẵn sàng connection và repository kiểm thử.';
GO

-- TEST CASE 1: Kiểm thử Idempotency của sp_ingest_source_event (NFR-REL-05)
PRINT N'--------------------------------------------------------------------';
PRINT N'TEST 1: sp_ingest_source_event - Kiểm thử tính Idempotency';
PRINT N'--------------------------------------------------------------------';

DECLARE @repo_id UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM [$(SchemaName)].repository WHERE github_repo_id = 12345678);
DECLARE @delivery_guid VARCHAR(100) = CAST(NEWID() AS VARCHAR(100));
DECLARE @ev_id_1 UNIQUEIDENTIFIER, @ev_id_2 UNIQUEIDENTIFIER;
DECLARE @dup_1 BIT, @dup_2 BIT;

-- Lần 1: Nhận sự kiện mới
EXEC [$(SchemaName)].sp_ingest_source_event
    @repository_id          = @repo_id,
    @event_type             = 'pr',
    @github_ref             = N'refs/pull/1/head',
    @state                  = 'open',
    @delivery_id            = @delivery_guid,
    @diff_digest            = 'a1b2c3d4e5f6',
    @created_by_livingdocs  = 0,
    @event_id               = @ev_id_1 OUTPUT,
    @is_duplicate           = @dup_1 OUTPUT;

-- Lần 2: Nhận lại đúng delivery_id đó (mô phỏng GitHub Webhook Redelivery)
EXEC [$(SchemaName)].sp_ingest_source_event
    @repository_id          = @repo_id,
    @event_type             = 'pr',
    @github_ref             = N'refs/pull/1/head',
    @state                  = 'open',
    @delivery_id            = @delivery_guid,
    @diff_digest            = 'a1b2c3d4e5f6',
    @created_by_livingdocs  = 0,
    @event_id               = @ev_id_2 OUTPUT,
    @is_duplicate           = @dup_2 OUTPUT;

IF (@ev_id_1 = @ev_id_2 AND @dup_1 = 0 AND @dup_2 = 1)
    PRINT N'>> [PASS] TEST 1 THÀNH CÔNG: Lần 1 insert mới (@is_dup=0), lần 2 trả bản ghi cũ (@is_dup=1).';
ELSE
    PRINT N'>> [FAIL] TEST 1 THẤT BẠI: Cơ chế Idempotency chưa hoạt động đúng!';
GO

-- TEST CASE 2: Kiểm thử Exponential Backoff & DLQ của sp_fail_ai_job (NFR-AVAIL-03)
PRINT N'--------------------------------------------------------------------';
PRINT N'TEST 2: sp_fail_ai_job - Kiểm thử Retry lũy tiến (10s, 30s, 90s) & DLQ';
PRINT N'--------------------------------------------------------------------';

DECLARE @job_id UNIQUEIDENTIFIER = NEWID();
INSERT INTO [$(SchemaName)].ai_job 
(id, job_type, status, retry_count, in_dlq, correlation_id)
VALUES 
(@job_id, 'drift_detection', 'running', 0, 0, NEWID());

DECLARE @status VARCHAR(50), @in_dlq BIT, @retry_at DATETIME2(3);

-- Fail lần 1 -> Phải lùi ~10s
EXEC [$(SchemaName)].sp_fail_ai_job @job_id = @job_id, @error_message = N'Lỗi kết nối LLM lần 1',
    @new_status = @status OUTPUT, @in_dlq = @in_dlq OUTPUT, @next_retry_at = @retry_at OUTPUT;
PRINT CONCAT(N'>> Lần 1 thất bại -> status=', @status, N', in_dlq=', @in_dlq, N', next_retry_at=', @retry_at);

-- Fail lần 2 -> Phải lùi ~30s
EXEC [$(SchemaName)].sp_fail_ai_job @job_id = @job_id, @error_message = N'Lỗi kết nối LLM lần 2',
    @new_status = @status OUTPUT, @in_dlq = @in_dlq OUTPUT, @next_retry_at = @retry_at OUTPUT;
PRINT CONCAT(N'>> Lần 2 thất bại -> status=', @status, N', in_dlq=', @in_dlq, N', next_retry_at=', @retry_at);

-- Fail lần 3 -> Phải lùi ~90s
EXEC [$(SchemaName)].sp_fail_ai_job @job_id = @job_id, @error_message = N'Lỗi kết nối LLM lần 3',
    @new_status = @status OUTPUT, @in_dlq = @in_dlq OUTPUT, @next_retry_at = @retry_at OUTPUT;
PRINT CONCAT(N'>> Lần 3 thất bại -> status=', @status, N', in_dlq=', @in_dlq, N', next_retry_at=', @retry_at);

-- Fail lần 4 -> Vượt quá 3 lần -> Chuyển vào DLQ (in_dlq = 1, status = 'failed')
EXEC [$(SchemaName)].sp_fail_ai_job @job_id = @job_id, @error_message = N'Lỗi kiệt quệ tài nguyên',
    @new_status = @status OUTPUT, @in_dlq = @in_dlq OUTPUT, @next_retry_at = @retry_at OUTPUT;
PRINT CONCAT(N'>> Lần 4 thất bại -> status=', @status, N', in_dlq=', @in_dlq, N', next_retry_at=', @retry_at);

IF (@status = 'failed' AND @in_dlq = 1 AND @retry_at IS NULL)
    PRINT N'>> [PASS] TEST 2 THÀNH CÔNG: Đã chuyển vào Dead Letter Queue (in_dlq=1) sau lần retry thứ 3.';
ELSE
    PRINT N'>> [FAIL] TEST 2 THẤT BẠI: Logic Dead Letter Queue chưa đúng!';
GO

-- TEST CASE 3: Kiểm thử tính bất biến của source_event (trg_source_event_immutable)
PRINT N'--------------------------------------------------------------------';
PRINT N'TEST 3: trg_source_event_immutable - Kiểm thử cấm UPDATE / DELETE';
PRINT N'--------------------------------------------------------------------';

DECLARE @sample_ev_id UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM [$(SchemaName)].source_event);

BEGIN TRY
    UPDATE [$(SchemaName)].source_event
    SET state = 'closed'
    WHERE id = @sample_ev_id;

    PRINT N'>> [FAIL] TEST 3 THẤT BẠI: Lệnh UPDATE đã thực hiện được trong khi trigger phải ngăn chặn!';
END TRY
BEGIN CATCH
    PRINT CONCAT(N'>> [PASS] TEST 3 THÀNH CÔNG: Trigger đã chặn lệnh UPDATE chính xác với thông báo: ', ERROR_MESSAGE());
END CATCH;
GO

-- TEST CASE 4: Kiểm thử ngắt kết nối repository (sp_disconnect_repository)
PRINT N'--------------------------------------------------------------------';
PRINT N'TEST 4: sp_disconnect_repository - Kiểm thử gỡ bỏ repo và thu hồi token';
PRINT N'--------------------------------------------------------------------';

DECLARE @repo_id UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM [$(SchemaName)].repository WHERE github_repo_id = 12345678);

-- Thêm 1 entity và 1 embedding thử nghiệm
DECLARE @entity_id UNIQUEIDENTIFIER = NEWID();
INSERT INTO [$(SchemaName)].code_entity (id, repository_id, kind, name, file_path, commit_hash)
VALUES (@entity_id, @repo_id, 'class', N'TestController', N'src/test.ts', 'hash123');

INSERT INTO [$(SchemaName)].embedding (source_type, source_id, chunk_ref, vector_ref)
VALUES ('code_chunk', @entity_id, N'test.ts:1-50', N'qdrant-vec-001');

-- Thực hiện ngắt kết nối
EXEC [$(SchemaName)].sp_disconnect_repository @repository_id = @repo_id;

-- Kiểm tra lại: entity và embedding phải bị xóa, repo status = 'disconnected', connection token bị xóa
DECLARE @rem_entities INT = (SELECT COUNT(1) FROM [$(SchemaName)].code_entity WHERE repository_id = @repo_id);
DECLARE @rem_embeddings INT = (SELECT COUNT(1) FROM [$(SchemaName)].embedding WHERE source_id = @entity_id);
DECLARE @repo_status VARCHAR(50) = (SELECT connection_status FROM [$(SchemaName)].repository WHERE id = @repo_id);
DECLARE @conn_status VARCHAR(50) = (SELECT status FROM [$(SchemaName)].github_connection WHERE installation_id = N'inst_test_001');

IF (@rem_entities = 0 AND @rem_embeddings = 0 AND @repo_status = 'disconnected' AND @conn_status = 'revoked')
    PRINT N'>> [PASS] TEST 4 THÀNH CÔNG: Đã dọn sạch code_entity, embedding và thu hồi token kết nối an toàn.';
ELSE
    PRINT CONCAT(N'>> [FAIL] TEST 4 THẤT BẠI: Entities còn=', @rem_entities, N', Embeddings còn=', @rem_embeddings, N', Status=', @repo_status);
GO

PRINT N'====================================================================';
PRINT N'HOÀN TẤT CHUỖI KIỂM THỬ PHÂN HỆ 02_INTEGRATION';
PRINT N'====================================================================';
GO
