-- DỰ ÁN: LivingDocs — AI-Assisted Self-Updating Document System
-- HỌC PHẦN: Hệ Quản trị Cơ sở Dữ liệu (HQTCSDL) — ĐH Giao thông Vận tải TP.HCM (UTH)
-- PHÂN HỆ: 02_integration (GitHub, Code, Job AI)
-- TÁC GIẢ: Hiếu aka silas (Integration Subsystem Lead)



-- 1. BẢNG: github_connection
-- Mô tả: Lưu trữ thông tin kết nối và xác thực GitHub App của Workspace/Tenant
IF OBJECT_ID(N'dbo.github_connection', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.github_connection
    (
        id                  UNIQUEIDENTIFIER    NOT NULL CONSTRAINT df_github_connection_id DEFAULT NEWSEQUENTIALID(),
        installation_id     NVARCHAR(100)       NOT NULL,
        account_login       NVARCHAR(255)       NOT NULL,
        access_token_enc    VARBINARY(MAX)      NOT NULL, -- Mã hóa đối xứng token (NFR-SEC-04)
        token_expires_at    DATETIME2(3)        NULL,
        status              VARCHAR(50)         NOT NULL CONSTRAINT df_github_connection_status DEFAULT 'active',
        connected_by        UNIQUEIDENTIFIER    NOT NULL, -- Người thực hiện liên kết (app_user.id)

        -- Audit columns
        created_at          DATETIME2(3)        NOT NULL CONSTRAINT df_github_connection_created_at DEFAULT SYSUTCDATETIME(),
        created_by          UNIQUEIDENTIFIER    NULL,
        updated_at          DATETIME2(3)        NULL,
        updated_by          UNIQUEIDENTIFIER    NULL,
        row_version         ROWVERSION          NOT NULL,

        -- Constraints
        CONSTRAINT pk_github_connection PRIMARY KEY CLUSTERED (id),
        CONSTRAINT uq_github_connection_installation_id UNIQUE (installation_id),
        CONSTRAINT ck_github_connection_status CHECK (status IN ('active', 'expired', 'revoked', 'suspended'))
    );
END;
GO

-- 2. BẢNG: repository
-- Mô tả: Quản lý danh sách kho mã nguồn GitHub được tích hợp vào Workspace
IF OBJECT_ID(N'dbo.repository', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.repository
    (
        id                  UNIQUEIDENTIFIER    NOT NULL CONSTRAINT df_repository_id DEFAULT NEWSEQUENTIALID(),
        connection_id       UNIQUEIDENTIFIER    NOT NULL,
        github_repo_id      BIGINT              NOT NULL,
        full_name           NVARCHAR(255)       NOT NULL, -- Ví dụ: 'organization/repo-name'
        default_branch      NVARCHAR(100)       NOT NULL CONSTRAINT df_repository_default_branch DEFAULT 'main',
        connection_status   VARCHAR(50)         NOT NULL CONSTRAINT df_repository_connection_status DEFAULT 'connected',
        last_synced_at      DATETIME2(3)        NULL,

        -- Audit columns
        created_at          DATETIME2(3)        NOT NULL CONSTRAINT df_repository_created_at DEFAULT SYSUTCDATETIME(),
        created_by          UNIQUEIDENTIFIER    NULL,
        updated_at          DATETIME2(3)        NULL,
        updated_by          UNIQUEIDENTIFIER    NULL,
        row_version         ROWVERSION          NOT NULL,

        -- Constraints
        CONSTRAINT pk_repository PRIMARY KEY CLUSTERED (id),
        CONSTRAINT uq_repository_connection_github_repo UNIQUE (connection_id, github_repo_id),
        CONSTRAINT fk_repository_connection FOREIGN KEY (connection_id) 
            REFERENCES dbo.github_connection(id) ON DELETE CASCADE,
        CONSTRAINT ck_repository_connection_status CHECK (connection_status IN ('connected', 'disconnected', 'syncing', 'error'))
    );
END;
GO

-- 3. BẢNG: source_event
-- Mô tả: Lưu trữ nhật ký sự kiện mã nguồn (Webhook/Pull Request/Commit) 
-- Có cơ chế correlation_id truy vết và delivery_id khử trùng lặp (Idempotent)
IF OBJECT_ID(N'dbo.source_event', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.source_event
    (
        id                      UNIQUEIDENTIFIER    NOT NULL CONSTRAINT df_source_event_id DEFAULT NEWSEQUENTIALID(),
        repository_id           UNIQUEIDENTIFIER    NOT NULL,
        event_type              VARCHAR(50)         NOT NULL,
        github_ref              NVARCHAR(255)       NOT NULL, 
        state                   VARCHAR(50)         NOT NULL,
        delivery_id             VARCHAR(100)        NOT NULL, -- GitHub Webhook Delivery GUID (NFR-REL-05)
        diff_digest             VARCHAR(64)         NULL,     -- SHA-256 hash của git diff
        created_by_livingdocs   BIT                 NOT NULL CONSTRAINT df_source_event_created_by_livingdocs DEFAULT 0, -- Cờ chặn loop tự sinh PR (FR-DR-14)
        correlation_id          UNIQUEIDENTIFIER    NOT NULL, -- Truy vết luồng sự kiện phân tán (NFR-REL-02)
        received_at             DATETIME2(3)        NOT NULL CONSTRAINT df_source_event_received_at DEFAULT SYSUTCDATETIME(),
        payload                 NVARCHAR(MAX)       NULL,     -- Payload chi tiết dạng JSON

        -- Audit columns
        created_at              DATETIME2(3)        NOT NULL CONSTRAINT df_source_event_created_at DEFAULT SYSUTCDATETIME(),
        created_by              UNIQUEIDENTIFIER    NULL,
        updated_at              DATETIME2(3)        NULL,
        updated_by              UNIQUEIDENTIFIER    NULL,
        row_version             ROWVERSION          NOT NULL,

        -- Constraints
        CONSTRAINT pk_source_event PRIMARY KEY CLUSTERED (id),
        CONSTRAINT uq_source_event_delivery_id UNIQUE (delivery_id),
        CONSTRAINT fk_source_event_repository FOREIGN KEY (repository_id) 
            REFERENCES dbo.repository(id) ON DELETE CASCADE,
        CONSTRAINT ck_source_event_event_type CHECK (event_type IN ('pr', 'commit', 'merge')),
        CONSTRAINT ck_source_event_state CHECK (state IN ('open', 'closed', 'merged')),
        CONSTRAINT ck_source_event_payload_json CHECK (payload IS NULL OR ISJSON(payload) = 1)
    );
END;
GO

-- 4. BẢNG: code_entity
-- Mô tả: Lưu trữ các thực thể mã nguồn bóc tách từ AST (Class, Method, Endpoint, Parameter)
-- Phục vụ liên kết tài liệu và phát hiện Drift
IF OBJECT_ID(N'dbo.code_entity', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.code_entity
    (
        id              UNIQUEIDENTIFIER    NOT NULL CONSTRAINT df_code_entity_id DEFAULT NEWSEQUENTIALID(),
        repository_id   UNIQUEIDENTIFIER    NOT NULL,
        parent_id       UNIQUEIDENTIFIER    NULL,     
        kind            VARCHAR(50)         NOT NULL,
        name            NVARCHAR(255)       NOT NULL,
        signature       NVARCHAR(1000)      NULL,     -- Ký hiệu hàm/endpoint kèm tham số và kiểu trả về
        file_path       NVARCHAR(500)       NOT NULL, -- Đường dẫn tệp trong repository
        commit_hash     VARCHAR(64)         NOT NULL, -- Hash commit ghi nhận thực thể
        removed_at      DATETIME2(3)        NULL,     -- Đánh dấu xóa mềm khi code bị xóa trong commit mới

        -- Audit columns
        created_at      DATETIME2(3)        NOT NULL CONSTRAINT df_code_entity_created_at DEFAULT SYSUTCDATETIME(),
        created_by      UNIQUEIDENTIFIER    NULL,
        updated_at      DATETIME2(3)        NULL,
        updated_by      UNIQUEIDENTIFIER    NULL,
        row_version     ROWVERSION          NOT NULL,

        -- Constraints
        CONSTRAINT pk_code_entity PRIMARY KEY CLUSTERED (id),
        CONSTRAINT fk_code_entity_repository FOREIGN KEY (repository_id) 
            REFERENCES dbo.repository(id) ON DELETE CASCADE,
        CONSTRAINT fk_code_entity_parent FOREIGN KEY (parent_id) 
            REFERENCES dbo.code_entity(id),
        CONSTRAINT ck_code_entity_kind CHECK (kind IN ('class', 'method', 'endpoint', 'parameter'))
    );
END;
GO

-- 5. BẢNG: ai_job
-- Mô tả: Quản lý hàng đợi tác vụ AI (AST parsing, Drift detection, Doc update, Embedding)
-- Hỗ trợ cơ chế Exponential Backoff retry và Dead Letter Queue (DLQ)
IF OBJECT_ID(N'dbo.ai_job', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ai_job
    (
        id                  UNIQUEIDENTIFIER    NOT NULL CONSTRAINT df_ai_job_id DEFAULT NEWSEQUENTIALID(),
        job_type            VARCHAR(50)         NOT NULL,
        status              VARCHAR(50)         NOT NULL CONSTRAINT df_ai_job_status DEFAULT 'pending',
        retry_count         INT                 NOT NULL CONSTRAINT df_ai_job_retry_count DEFAULT 0,
        in_dlq              BIT                 NOT NULL CONSTRAINT df_ai_job_in_dlq DEFAULT 0,
        next_retry_at       DATETIME2(3)        NULL,
        token_used          INT                 NOT NULL CONSTRAINT df_ai_job_token_used DEFAULT 0,
        source_event_id     UNIQUEIDENTIFIER    NULL,
        correlation_id      UNIQUEIDENTIFIER    NOT NULL,
        error_message       NVARCHAR(MAX)       NULL,

        -- Audit columns
        created_at          DATETIME2(3)        NOT NULL CONSTRAINT df_ai_job_created_at DEFAULT SYSUTCDATETIME(),
        created_by          UNIQUEIDENTIFIER    NULL,
        updated_at          DATETIME2(3)        NULL,
        updated_by          UNIQUEIDENTIFIER    NULL,
        row_version         ROWVERSION          NOT NULL,

        -- Constraints
        CONSTRAINT pk_ai_job PRIMARY KEY CLUSTERED (id),
        CONSTRAINT fk_ai_job_source_event FOREIGN KEY (source_event_id) 
            REFERENCES dbo.source_event(id) ON DELETE SET NULL,
        CONSTRAINT ck_ai_job_retry_count CHECK (retry_count >= 0 AND retry_count <= 3),
        CONSTRAINT ck_ai_job_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'retrying', 'cancelled')),
        CONSTRAINT ck_ai_job_job_type CHECK (job_type IN ('ast_parsing', 'drift_detection', 'doc_generation', 'doc_update', 'embedding_indexing'))
    );
END;
GO

-- 6. BẢNG: embedding
-- Mô tả: Lưu trữ metadata và tham chiếu Vector Store cho tìm kiếm ngữ nghĩa RAG
-- (Vector thực tế nằm ở Vector Store chuyên dụng, theo đúng thiết kế SRS)
IF OBJECT_ID(N'dbo.embedding', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.embedding
    (
        id                  UNIQUEIDENTIFIER    NOT NULL CONSTRAINT df_embedding_id DEFAULT NEWSEQUENTIALID(),
        source_type         VARCHAR(50)         NOT NULL,
        source_id           UNIQUEIDENTIFIER    NOT NULL, -- ID của document hoặc code_entity
        chunk_ref           NVARCHAR(255)       NOT NULL, -- Định danh đoạn text/vị trí code
        embedding_version   VARCHAR(50)         NOT NULL CONSTRAINT df_embedding_version DEFAULT 'v1',
        vector_ref          NVARCHAR(500)       NOT NULL, -- Khóa/ID tham chiếu sang Vector Store

        -- Audit columns
        created_at          DATETIME2(3)        NOT NULL CONSTRAINT df_embedding_created_at DEFAULT SYSUTCDATETIME(),
        created_by          UNIQUEIDENTIFIER    NULL,
        updated_at          DATETIME2(3)        NULL,
        updated_by          UNIQUEIDENTIFIER    NULL,
        row_version         ROWVERSION          NOT NULL,

        -- Constraints
        CONSTRAINT pk_embedding PRIMARY KEY CLUSTERED (id),
        CONSTRAINT ck_embedding_source_type CHECK (source_type IN ('document', 'code_chunk'))
    );
END;
GO

-- RÀNG BUỘC NGOẠI KHÁC MODULE
-- Tham chiếu app_user nếu bảng app_user đã được tạo bởi Module 01_identity
IF OBJECT_ID(N'dbo.app_user', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.fk_github_connection_connected_by', N'F') IS NULL
BEGIN
    ALTER TABLE dbo.github_connection
    ADD CONSTRAINT fk_github_connection_connected_by
        FOREIGN KEY (connected_by) REFERENCES dbo.app_user(id);
END;
GO
