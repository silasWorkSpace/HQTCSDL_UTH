-- File: 008_document_transition.sql
-- Người phụ trách: Huy (cụm 04 — Duyệt, drift, thông báo)
-- Mô tả: Cổng duy nhất đổi trạng thái tài liệu (sp_transition_document_status),
--        hợp nhất gợi ý cũ (sp_supersede_stale_suggestions) và tạo gợi ý mới
--        (sp_create_update_suggestion). sp_transition_document_status kiểm tra
--        quy tắc trong document_status_transition rồi GỌI sp_update_document_state
--        của cụm 03_document (FR-WF-24: ba trạng thái ghi qua một cổng duy nhất).

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ---------- seed document_status_transition ----------
   Ma trận chuyển trạng thái theo Bảng 15 SRS. allowed_role = 'system' cho
   các bước do hệ thống thực hiện (publish giả lập, supersede theo FR-WF-25/23). */
MERGE INTO [$(SchemaName)].[document_status_transition] AS t
USING (VALUES
    -- Developer nộp bản (FR-GEN-10); mọi vai trò soạn thảo đều nộp được
    (N'DRAFT',                     N'IN_REVIEW_STAFF',          N'Developer'),
    (N'DRAFT',                     N'IN_REVIEW_STAFF',          N'Staff'),
    (N'DRAFT',                     N'IN_REVIEW_STAFF',          N'Manager'),
    (N'DRAFT',                     N'IN_REVIEW_STAFF',          N'Technical Lead'),
    (N'DRAFT',                     N'IN_REVIEW_STAFF',          N'Administrator'),
    -- Developer xử lý gợi ý drift / auto-update (FR-AUTO-07, 08, 09)
    (N'PENDING_DEVELOPER_ACTION',  N'IN_REVIEW_STAFF',          N'Developer'),
    (N'PENDING_DEVELOPER_ACTION',  N'DISMISSED',                N'Developer'),
    -- Duyệt cấp 1 (UC-11: FR-WF-09, 10, 15)
    (N'IN_REVIEW_STAFF',           N'IN_REVIEW_MANAGER',        N'Staff'),
    (N'IN_REVIEW_STAFF',           N'CHANGES_REQUESTED',        N'Staff'),
    (N'IN_REVIEW_STAFF',           N'REJECTED',                 N'Staff'),
    -- Duyệt cuối (UC-12: FR-WF-14, 15) và trả lại Staff
    (N'IN_REVIEW_MANAGER',         N'APPROVED',                 N'Manager'),
    (N'IN_REVIEW_MANAGER',         N'CHANGES_REQUESTED',        N'Manager'),
    (N'IN_REVIEW_MANAGER',         N'REJECTED',                 N'Manager'),
    (N'IN_REVIEW_MANAGER',         N'IN_REVIEW_STAFF',          N'Manager'),
    -- Developer nộp lại sau khi sửa (Bảng 15)
    (N'CHANGES_REQUESTED',         N'IN_REVIEW_STAFF',          N'Developer'),
    -- Publish giả lập tuần này (FR-WF-16, 23, 24); publish thật làm tuần sau
    (N'APPROVED',                  N'PENDING_MERGE',            N'system'),
    (N'APPROVED',                  N'SUPERSEDED',               N'system'),
    (N'PENDING_MERGE',             N'PUBLISHED',                N'system'),
    (N'PENDING_MERGE',             N'APPROVED',                 N'system'),
    (N'PENDING_MERGE',             N'SUPERSEDED',               N'system'),
    -- Lỗi thời theo FR-WF-25 / PR nguồn bị đóng (FR-AUTO-14)
    (N'IN_REVIEW_STAFF',           N'SUPERSEDED',               N'system'),
    (N'IN_REVIEW_MANAGER',         N'SUPERSEDED',               N'system')
) AS s (from_status, to_status, allowed_role)
ON  t.from_status = s.from_status
AND t.to_status   = s.to_status
AND t.allowed_role = s.allowed_role
WHEN NOT MATCHED THEN
    INSERT (from_status, to_status, allowed_role) VALUES (s.from_status, s.to_status, s.allowed_role);
GO

/* ---------- sp_transition_document_status ----------
   Đầu vào: document_id, trạng thái đích, vai trò tác nhân (hoặc 'system').
   Đầu ra:  RAISERROR/THROW nếu quy tắc không cho phép (Java map thành 409).
   Đảm bảo CHECK liên kết ba trạng thái (ck_document_state_published, ...)
   luôn được thỏa: chỉ ghi ba cột trạng thái qua đây, không UPDATE trực tiếp. */
CREATE OR ALTER PROCEDURE [$(SchemaName)].[sp_transition_document_status]
    @document_id   UNIQUEIDENTIFIER,
    @to_status     VARCHAR(30),
    @actor_role    VARCHAR(50),          -- 5 vai trò hoặc 'system'
    @actor_user_id UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @from_status     VARCHAR(30);
    DECLARE @publish_status  VARCHAR(30) = NULL;
    DECLARE @pr_status       VARCHAR(20) = NULL;

    SELECT @from_status = doc_status
      FROM [$(SchemaName)].[document]
     WHERE id = @document_id;
    IF @@ROWCOUNT = 0 THROW 50020, N'Khong tim thay document.', 1;

    -- Tách biệt nhiệm vụ và ma trận Bảng 15: chỉ cho phép cặp (from, to, role) đã seed
    IF NOT EXISTS (
        SELECT 1 FROM [$(SchemaName)].[document_status_transition]
         WHERE from_status = @from_status
           AND to_status   = @to_status
           AND allowed_role = @actor_role
    )
        THROW 50030, N'Chuyen trang thai khong hop le cho vai tro nay.', 1;

    -- Đồng bộ ba trạng thái theo Bảng 14 SRS (FR-WF-24)
    SELECT @publish_status =
        CASE @to_status
            WHEN N'PENDING_MERGE' THEN N'COMMITTED_TO_DOCS_BRANCH'
            WHEN N'PUBLISHED'     THEN N'IN_TARGET_BRANCH'
            WHEN N'APPROVED'      THEN N'FAILED'   -- PR tài liệu bị đóng không merge (FR-WF-23)
            ELSE NULL
        END,
        @pr_status =
        CASE @to_status
            WHEN N'PENDING_MERGE' THEN N'PENDING_MERGE'
            WHEN N'PUBLISHED'     THEN N'MERGED'
            WHEN N'APPROVED'      THEN N'CLOSED_UNMERGED'
            ELSE NULL
        END;

    EXEC [$(SchemaName)].[sp_update_document_state]
        @document_id    = @document_id,
        @doc_status     = @to_status,
        @publish_status = @publish_status,
        @pr_status      = @pr_status,
        @actor_user_id  = @actor_user_id;
END
GO

/* ---------- sp_create_update_suggestion ----------
   Tạo gợi ý cập nhật (DR-08). Gọi trong cùng transaction với sp_create_drift_alert
   khi DRIFT_FOUND đến để drift_alert_id trỏ đúng bản ghi gốc. */
CREATE OR ALTER PROCEDURE [$(SchemaName)].[sp_create_update_suggestion]
    @document_id         UNIQUEIDENTIFIER,
    @drift_alert_id      UNIQUEIDENTIFIER = NULL,
    @origin              VARCHAR(50),          -- 'drift' | 'generate' | 'auto_update'
    @content             NVARCHAR(MAX),
    @confidence_score    DECIMAL(3,2),
    @evidence            NVARCHAR(MAX) = NULL,
    @auto_apply_eligible BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO [$(SchemaName)].[update_suggestion]
        (document_id, drift_alert_id, origin, content, confidence_score,
         evidence, status, auto_apply_eligible)
    OUTPUT INSERTED.id
    VALUES
        (@document_id, @drift_alert_id, @origin, @content, @confidence_score,
         @evidence, N'Pending Developer Action', @auto_apply_eligible);
END
GO

/* ---------- sp_supersede_stale_suggestions ----------
   Hợp nhất và hủy gợi ý lỗi thời: khi cùng một tài liệu sinh bản mới (FR-DR-17)
   hoặc bản bị thay thế (FR-AUTO-16), các bản chờ xử lý cũ chuyển Superseded.
   @keep_suggestion_id = bản gợi ý mới giữ lại; NULL = supersede hết. */
CREATE OR ALTER PROCEDURE [$(SchemaName)].[sp_supersede_stale_suggestions]
    @document_id         UNIQUEIDENTIFIER,
    @keep_suggestion_id  UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE [$(SchemaName)].[update_suggestion]
       SET status     = N'Superseded',
           updated_at = SYSUTCDATETIME()
     WHERE document_id = @document_id
       AND status IN (N'Pending Developer Action', N'Accepted')
       AND (@keep_suggestion_id IS NULL OR id <> @keep_suggestion_id);

    SELECT @@ROWCOUNT AS superseded_count;
END
GO

PRINT N'OK: 04_workflow 008_document_transition.sql cho schema $(SchemaName)';
GO
