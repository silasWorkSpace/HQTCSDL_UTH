-- DỰ ÁN: LivingDocs — AI-Assisted Self-Updating Document System
-- HỌC PHẦN: Hệ Quản trị Cơ sở Dữ liệu (HQTCSDL) — ĐH Giao thông Vận tải TP.HCM (UTH)
-- PHÂN HỆ: 02_integration (GitHub, Code, Job AI)
-- TÁC GIẢ: Hiếu aka silas (Integration Subsystem Lead)

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. TRIGGER: trg_source_event_immutable
-- Mô tả: Ngăn chặn sửa/xóa nhật ký sự kiện nguồn (Tamper-proof event log - Append only)
CREATE OR ALTER TRIGGER dbo.trg_source_event_immutable
ON dbo.source_event
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    RAISERROR(N'Bảng source_event là nhật ký sự kiện bất biến (Append-only). Không được phép UPDATE hoặc DELETE.', 16, 1);
    ROLLBACK TRANSACTION;
END;
GO

-- 2. TRIGGER: trg_ai_job_dlq_consistency
-- Mô tả: Ràng buộc nhất quán giữa cờ in_dlq và trạng thái job (DLQ consistency)
CREATE OR ALTER TRIGGER dbo.trg_ai_job_dlq_consistency
ON dbo.ai_job
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Kiểm tra nếu có bản ghi in_dlq = 1 nhưng status khác 'failed' hoặc next_retry_at vẫn còn giá trị
    IF EXISTS (
        SELECT 1 
        FROM inserted
        WHERE in_dlq = 1 AND (status <> 'failed' OR next_retry_at IS NOT NULL)
    )
    BEGIN
        UPDATE j
        SET status = 'failed',
            next_retry_at = NULL,
            updated_at = SYSUTCDATETIME()
        FROM dbo.ai_job j
        INNER JOIN inserted i ON j.id = i.id
        WHERE i.in_dlq = 1 AND (i.status <> 'failed' OR i.next_retry_at IS NOT NULL);
    END;
END;
GO

-- 3. TRIGGER: trg_code_entity_touch_audit
-- Mô tả: Tự động cập nhật updated_at khi code_entity thay đổi
CREATE OR ALTER TRIGGER dbo.trg_code_entity_touch_audit
ON dbo.code_entity
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Tránh vòng lặp kích hoạt đệ quy nếu chỉ update cột audit
    IF NOT UPDATE(updated_at)
    BEGIN
        UPDATE ce
        SET updated_at = SYSUTCDATETIME()
        FROM dbo.code_entity ce
        INNER JOIN inserted i ON ce.id = i.id;
    END;
END;
GO

-- 4. TRIGGER: trg_repository_touch_audit
-- Mô tả: Tự động cập nhật updated_at khi repository thay đổi
CREATE OR ALTER TRIGGER dbo.trg_repository_touch_audit
ON dbo.repository
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT UPDATE(updated_at)
    BEGIN
        UPDATE r
        SET updated_at = SYSUTCDATETIME()
        FROM dbo.repository r
        INNER JOIN inserted i ON r.id = i.id;
    END;
END;
GO
