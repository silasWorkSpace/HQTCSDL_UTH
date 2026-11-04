-- DỰ ÁN: LivingDocs — AI-Assisted Self-Updating Document System
-- HỌC PHẦN: Hệ Quản trị Cơ sở Dữ liệu (HQTCSDL) — ĐH Giao thông Vận tải TP.HCM (UTH)
-- PHÂN HỆ: 02_integration (GitHub, Code, Job AI)
-- TÁC GIẢ: Hiếu aka silas (Integration Subsystem Lead)

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO


-- 1. PROCEDURE: sp_ingest_source_event
-- Mô tả: Tiếp nhận sự kiện mã nguồn (PR, Commit, Merge) từ GitHub Webhook.
-- Đảm bảo tính Idempotent qua delivery_id (NFR-REL-05).
CREATE OR ALTER PROCEDURE [$(SchemaName)].sp_ingest_source_event
    @repository_id          UNIQUEIDENTIFIER,
    @event_type             VARCHAR(50),
    @github_ref             NVARCHAR(255),
    @state                  VARCHAR(50),
    @delivery_id            VARCHAR(100),
    @diff_digest            VARCHAR(64)         = NULL,
    @created_by_livingdocs  BIT                 = 0,
    @correlation_id         UNIQUEIDENTIFIER    = NULL,
    @payload                NVARCHAR(MAX)       = NULL,
    @event_id               UNIQUEIDENTIFIER    = NULL OUTPUT,
    @is_duplicate           BIT                 = 0    OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Tự sinh correlation_id nếu chưa có để đảm bảo phân tán truy vết
    IF @correlation_id IS NULL
        SET @correlation_id = NEWID();

    -- 1. Kiểm tra trùng lặp theo delivery_id (GitHub Webhook Idempotency)
    SELECT 
        @event_id = id,
        @is_duplicate = 1
    FROM [$(SchemaName)].source_event
    WHERE delivery_id = @delivery_id;

    IF @is_duplicate = 1
    BEGIN
        -- Trả về dữ liệu bản ghi đã tồn tại
        SELECT 
            id, repository_id, event_type, github_ref, state, delivery_id, 
            diff_digest, created_by_livingdocs, correlation_id, received_at, payload,
            @is_duplicate AS is_duplicate
        FROM [$(SchemaName)].source_event
        WHERE id = @event_id;
        RETURN 0;
    END;

    -- 2. Thêm mới sự kiện nếu chưa từng nhận
    BEGIN TRANSACTION;
    BEGIN TRY
        -- Đảm bảo repository tồn tại
        IF NOT EXISTS (SELECT 1 FROM [$(SchemaName)].repository WHERE id = @repository_id)
        BEGIN
            DECLARE @repo_err_msg NVARCHAR(100) = CAST(@repository_id AS NVARCHAR(36));
            RAISERROR(N'Repository với ID %s không tồn tại trong hệ thống.', 16, 1, @repo_err_msg);
        END;

        DECLARE @new_id TABLE (id UNIQUEIDENTIFIER);

        INSERT INTO [$(SchemaName)].source_event
        (
            repository_id,
            event_type,
            github_ref,
            state,
            delivery_id,
            diff_digest,
            created_by_livingdocs,
            correlation_id,
            payload
        )
        OUTPUT INSERTED.id INTO @new_id
        VALUES
        (
            @repository_id,
            @event_type,
            @github_ref,
            @state,
            @delivery_id,
            @diff_digest,
            @created_by_livingdocs,
            @correlation_id,
            @payload
        );

        SELECT TOP 1 @event_id = id FROM @new_id;
        SET @is_duplicate = 0;

        -- Cập nhật thời điểm đồng bộ gần nhất của Repository
        UPDATE [$(SchemaName)].repository
        SET last_synced_at = SYSUTCDATETIME(),
            updated_at = SYSUTCDATETIME()
        WHERE id = @repository_id;

        COMMIT TRANSACTION;

        -- Trả kết quả bản ghi vừa thêm
        SELECT 
            id, repository_id, event_type, github_ref, state, delivery_id, 
            diff_digest, created_by_livingdocs, correlation_id, received_at, payload,
            @is_duplicate AS is_duplicate
        FROM [$(SchemaName)].source_event
        WHERE id = @event_id;

        RETURN 0;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- 2. PROCEDURE: sp_fail_ai_job
-- Mô tả: Xử lý khi AI Job gặp lỗi với Exponential Backoff (10s/30s/90s) & Dead Letter Queue (NFR-AVAIL-03)
CREATE OR ALTER PROCEDURE [$(SchemaName)].sp_fail_ai_job
    @job_id         UNIQUEIDENTIFIER,
    @error_message  NVARCHAR(MAX),
    @new_status     VARCHAR(50)         = NULL OUTPUT,
    @in_dlq         BIT                 = NULL OUTPUT,
    @next_retry_at  DATETIME2(3)        = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @current_retry_count INT;
        DECLARE @new_retry_count INT;

        -- Khóa dòng để cập nhật an toàn
        SELECT 
            @current_retry_count = retry_count
        FROM [$(SchemaName)].ai_job WITH (UPDLOCK, ROWLOCK)
        WHERE id = @job_id;

        IF @current_retry_count IS NULL
        BEGIN
            DECLARE @job_err_msg NVARCHAR(100) = CAST(@job_id AS NVARCHAR(36));
            RAISERROR(N'Không tìm thấy AI Job với ID %s.', 16, 1, @job_err_msg);
        END;

        SET @new_retry_count = @current_retry_count + 1;

        -- Xác định mốc thời gian retry theo lũy tiến (Exponential Backoff)
        IF @new_retry_count = 1
        BEGIN
            SET @new_status = 'retrying';
            SET @in_dlq = 0;
            SET @next_retry_at = DATEADD(SECOND, 10, SYSUTCDATETIME()); -- Lần 1: +10s
        END
        ELSE IF @new_retry_count = 2
        BEGIN
            SET @new_status = 'retrying';
            SET @in_dlq = 0;
            SET @next_retry_at = DATEADD(SECOND, 30, SYSUTCDATETIME()); -- Lần 2: +30s
        END
        ELSE IF @new_retry_count = 3
        BEGIN
            SET @new_status = 'retrying';
            SET @in_dlq = 0;
            SET @next_retry_at = DATEADD(SECOND, 90, SYSUTCDATETIME()); -- Lần 3: +90s
        END
        ELSE
        BEGIN
            -- Quá 3 lần retry -> Chuyển vào DLQ
            SET @new_status = 'failed';
            SET @in_dlq = 1;
            SET @next_retry_at = NULL;
            SET @new_retry_count = 3; -- Giữ mức trần CHECK (0 đến 3)
        END;

        -- Cập nhật thông tin Job
        UPDATE [$(SchemaName)].ai_job
        SET retry_count   = @new_retry_count,
            status        = @new_status,
            in_dlq        = @in_dlq,
            next_retry_at = @next_retry_at,
            error_message = @error_message,
            updated_at    = SYSUTCDATETIME()
        WHERE id = @job_id;

        COMMIT TRANSACTION;

        -- Trả về trạng thái sau cập nhật
        SELECT 
            id, job_type, status, retry_count, in_dlq, next_retry_at, error_message, updated_at
        FROM [$(SchemaName)].ai_job
        WHERE id = @job_id;

        RETURN 0;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- 3. PROCEDURE: sp_disconnect_repository
-- Mô tả: Hủy kết nối kho mã nguồn, dọn dẹp code_entity, embedding và thu hồi token (FR-VER-10)
CREATE OR ALTER PROCEDURE [$(SchemaName)].sp_disconnect_repository
    @repository_id      UNIQUEIDENTIFIER,
    @actor_user_id      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @connection_id UNIQUEIDENTIFIER;
        DECLARE @repo_name NVARCHAR(255);

        SELECT 
            @connection_id = connection_id,
            @repo_name = full_name
        FROM [$(SchemaName)].repository WITH (UPDLOCK, ROWLOCK)
        WHERE id = @repository_id;

        IF @connection_id IS NULL
        BEGIN
            DECLARE @disco_repo_err NVARCHAR(100) = CAST(@repository_id AS NVARCHAR(36));
            RAISERROR(N'Không tìm thấy repository với ID %s.', 16, 1, @disco_repo_err);
        END;

        -- 1. Xóa các embeddings thuộc các code_entity của repository này
        DELETE emb
        FROM [$(SchemaName)].embedding emb
        INNER JOIN [$(SchemaName)].code_entity ce ON emb.source_id = ce.id
        WHERE ce.repository_id = @repository_id 
          AND emb.source_type = 'code_chunk';

        -- 2. Dọn dẹp code_entity (Gỡ bỏ liên kết cây parent_id trước để tránh lỗi FK tự tham chiếu)
        UPDATE [$(SchemaName)].code_entity
        SET parent_id = NULL
        WHERE repository_id = @repository_id;

        DELETE FROM [$(SchemaName)].code_entity
        WHERE repository_id = @repository_id;

        -- 3. Cập nhật trạng thái Repository thành 'disconnected'
        UPDATE [$(SchemaName)].repository
        SET connection_status = 'disconnected',
            updated_at = SYSUTCDATETIME(),
            updated_by = @actor_user_id
        WHERE id = @repository_id;

        -- 4. Nếu không còn repository nào đang kết nối thuộc github_connection này, xóa token (an toàn bảo mật)
        IF NOT EXISTS (
            SELECT 1 FROM [$(SchemaName)].repository
            WHERE connection_id = @connection_id 
              AND id <> @repository_id 
              AND connection_status = 'connected'
        )
        BEGIN
            UPDATE [$(SchemaName)].github_connection
            SET access_token_enc = 0x, -- Thu hồi/xóa token mã hóa
                status = 'revoked',
                updated_at = SYSUTCDATETIME(),
                updated_by = @actor_user_id
            WHERE id = @connection_id;
        END;

        COMMIT TRANSACTION;

        SELECT 
            @repository_id AS repository_id,
            @repo_name AS repository_name,
            'disconnected' AS new_status,
            SYSUTCDATETIME() AS disconnected_at;

        RETURN 0;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- 4. PROCEDURE: sp_fetch_next_ai_job
-- Mô tả: Cung cấp hàng đợi cạnh tranh cao cho AI Worker với WITH (ROWLOCK, READPAST, UPDLOCK)
CREATE OR ALTER PROCEDURE [$(SchemaName)].sp_fetch_next_ai_job
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @selected_job TABLE (id UNIQUEIDENTIFIER);

    ;WITH NextJobCTE AS (
        SELECT TOP(1) id, status, updated_at
        FROM [$(SchemaName)].ai_job WITH (ROWLOCK, READPAST, UPDLOCK)
        WHERE in_dlq = 0
          AND (
              status = 'pending'
              OR (status = 'retrying' AND next_retry_at <= SYSUTCDATETIME())
          )
        ORDER BY created_at ASC
    )
    UPDATE NextJobCTE
    SET status = 'running',
        updated_at = SYSUTCDATETIME()
    OUTPUT INSERTED.id INTO @selected_job;

    -- Trả thông tin chi tiết của Job vừa bốc được để AI Engine xử lý
    SELECT 
        j.id,
        j.job_type,
        j.status,
        j.retry_count,
        j.in_dlq,
        j.token_used,
        j.source_event_id,
        j.correlation_id,
        j.error_message,
        j.created_at,
        se.github_ref,
        se.diff_digest,
        se.payload AS event_payload,
        r.full_name AS repo_full_name,
        r.default_branch
    FROM [$(SchemaName)].ai_job j
    INNER JOIN @selected_job sj ON j.id = sj.id
    LEFT JOIN [$(SchemaName)].source_event se ON j.source_event_id = se.id
    LEFT JOIN [$(SchemaName)].repository r ON se.repository_id = r.id;
END;
GO
