-- DỰ ÁN: LivingDocs — AI-Assisted Self-Updating Document System
-- HỌC PHẦN: Hệ Quản trị Cơ sở Dữ liệu (HQTCSDL) — ĐH Giao thông Vận tải TP.HCM (UTH)
-- PHÂN HỆ: 02_integration (GitHub, Code, Job AI)
-- TÁC GIẢ: Hiếu aka silas (Integration Subsystem Lead)

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO


-- 1. INDEXES CHO BẢNG: code_entity

-- Index 1.1: Tìm kiếm các code entity thuộc 1 file cụ thể trong repo (khi file bị sửa trong PR/commit)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_code_entity_repo_file' 
    AND object_id = OBJECT_ID(N'dbo.code_entity'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_code_entity_repo_file
    ON dbo.code_entity (repository_id, file_path)
    INCLUDE (name, kind, signature, commit_hash, removed_at);
END;
GO

-- Index 1.2: Tìm kiếm code entity theo tên (Class, Method, Endpoint) trong repo (phục vụ RAG & Drift Detector)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_code_entity_repo_name' 
    AND object_id = OBJECT_ID(N'dbo.code_entity'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_code_entity_repo_name
    ON dbo.code_entity (repository_id, name)
    INCLUDE (kind, file_path, signature, removed_at);
END;
GO

-- Index 1.3: Hỗ trợ duyệt cây phân cấp AST tự tham chiếu (parameter -> method -> class)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_code_entity_parent_id' 
    AND object_id = OBJECT_ID(N'dbo.code_entity'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_code_entity_parent_id
    ON dbo.code_entity (parent_id)
    WHERE parent_id IS NOT NULL;
END;
GO

-- Index 1.4: Filtered index tối ưu tìm kiếm các thực thể đang hoạt động (chưa bị xóa)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_code_entity_active' 
    AND object_id = OBJECT_ID(N'dbo.code_entity'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_code_entity_active
    ON dbo.code_entity (repository_id, kind)
    INCLUDE (name, file_path)
    WHERE removed_at IS NULL;
END;
GO

-- 2. INDEXES CHO BẢNG: source_event

-- Index 2.1: Lấy danh sách sự kiện gần nhất theo Repository phục vụ hiển thị Timeline và Polling
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_source_event_repo_received' 
    AND object_id = OBJECT_ID(N'dbo.source_event'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_source_event_repo_received
    ON dbo.source_event (repository_id, received_at DESC)
    INCLUDE (event_type, github_ref, state, delivery_id, created_by_livingdocs);
END;
GO

-- Index 2.2: Truy vết sự kiện theo correlation_id phân tán (NFR-REL-02)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_source_event_correlation_id' 
    AND object_id = OBJECT_ID(N'dbo.source_event'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_source_event_correlation_id
    ON dbo.source_event (correlation_id)
    INCLUDE (repository_id, event_type, state, received_at);
END;
GO

-- 3. INDEXES CHO BẢNG: ai_job

-- Index 3.1: Hàng đợi tác vụ cần xử lý (Worker Polling Queue)
-- Worker quét job có status 'pending' hoặc job 'retrying' đã đến hạn next_retry_at và chưa vào DLQ
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_ai_job_polling_queue' 
    AND object_id = OBJECT_ID(N'dbo.ai_job'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_ai_job_polling_queue
    ON dbo.ai_job (status, next_retry_at, in_dlq)
    INCLUDE (job_type, retry_count, source_event_id, correlation_id)
    WHERE status IN ('pending', 'retrying') AND in_dlq = 0;
END;
GO

-- Index 3.2: Lọc các job thất bại trong Dead Letter Queue (DLQ) phục vụ giám sát và can thiệp thủ công
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_ai_job_dlq' 
    AND object_id = OBJECT_ID(N'dbo.ai_job'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_ai_job_dlq
    ON dbo.ai_job (in_dlq, created_at DESC)
    INCLUDE (job_type, retry_count, error_message, correlation_id)
    WHERE in_dlq = 1;
END;
GO

-- Index 3.3: Truy vết AI Job theo correlation_id
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_ai_job_correlation_id' 
    AND object_id = OBJECT_ID(N'dbo.ai_job'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_ai_job_correlation_id
    ON dbo.ai_job (correlation_id);
END;
GO

-- 4. INDEXES CHO BẢNG: embedding

-- Index 4.1: Tra cứu embedding metadata theo nguồn (document hoặc code_entity)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_embedding_source' 
    AND object_id = OBJECT_ID(N'dbo.embedding'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_embedding_source
    ON dbo.embedding (source_type, source_id)
    INCLUDE (chunk_ref, vector_ref, embedding_version);
END;
GO
