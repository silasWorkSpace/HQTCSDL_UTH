SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ---------- Hàm hash ---------- */
CREATE OR ALTER FUNCTION [$(SchemaName)].[fn_document_version_hash] (
    @prev_hash                   VARBINARY(32),
    @document_id                 UNIQUEIDENTIFIER,
    @version_no                  INT,
    @actor_role                  VARCHAR(20),
    @actor_user_id               UNIQUEIDENTIFIER,
    @change_source               VARCHAR(30),
    @status_at_version           VARCHAR(30),
    @source_commit_sha           VARCHAR(64),
    @source_pr_number            INT,
    @source_pr_kind              VARCHAR(10),
    @rolled_back_from_version_no INT,
    @created_at                  DATETIME2(3),
    @content_digest              VARBINARY(32)
)
RETURNS VARBINARY(32)
AS
BEGIN
    RETURN HASHBYTES('SHA2_256', CONCAT(
        CONVERT(VARCHAR(66), @prev_hash, 1), '|',
        CONVERT(VARCHAR(36), @document_id), '|',
        @version_no, '|',
        @actor_role, '|',
        CONVERT(VARCHAR(36), @actor_user_id), '|',
        @change_source, '|',
        @status_at_version, '|',
        @source_commit_sha, '|',
        @source_pr_number, '|',
        @source_pr_kind, '|',
        @rolled_back_from_version_no, '|',
        CONVERT(VARCHAR(23), @created_at, 126), '|',
        CONVERT(VARCHAR(66), @content_digest, 1)));
END
GO

/* ---------- sp_append_document_version ----------
   Khóa dòng document (UPDLOCK, HOLDLOCK) => hai session ghi cùng tài liệu bị tuần tự hóa,
   không bao giờ trùng version_no. Có thể gọi lồng trong transaction của proc khác. */
CREATE OR ALTER PROCEDURE [$(SchemaName)].[sp_append_document_version]
    @document_id                 UNIQUEIDENTIFIER,
    @content                     NVARCHAR(MAX),
    @actor_role                  VARCHAR(20),
    @actor_user_id               UNIQUEIDENTIFIER = NULL,
    @change_source               VARCHAR(30),
    @status_at_version           VARCHAR(30)      = NULL,   -- NULL = lấy doc_status hiện tại của document
    @source_commit_sha           VARCHAR(64)      = NULL,
    @source_pr_number            INT              = NULL,
    @source_pr_kind              VARCHAR(10)      = NULL,   -- SOURCE | DOCS
    @reason                      NVARCHAR(1000)   = NULL,
    @rolled_back_from_version_no INT              = NULL,
    @set_as_current              BIT              = 1,
    @version_id                  UNIQUEIDENTIFIER = NULL OUTPUT,
    @version_no                  INT              = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @content IS NULL THROW 50021, N'content khong duoc NULL (dung chuoi rong neu tai lieu trong).', 1;

    DECLARE @own        BIT = IIF(@@TRANCOUNT = 0, 1, 0);
    DECLARE @doc_status VARCHAR(30);
    DECLARE @prev_hash  VARBINARY(32) = NULL;
    DECLARE @prev_no    INT = NULL;
    DECLARE @now        DATETIME2(3) = SYSUTCDATETIME();
    DECLARE @digest     VARBINARY(32) = HASHBYTES('SHA2_256', @content);
    DECLARE @hash       VARBINARY(32);
    DECLARE @ins TABLE (id UNIQUEIDENTIFIER);

    BEGIN TRY
        IF @own = 1 BEGIN TRAN;

        SELECT @doc_status = d.doc_status
          FROM [$(SchemaName)].[document] d WITH (UPDLOCK, HOLDLOCK)
         WHERE d.id = @document_id;
        IF @@ROWCOUNT = 0 THROW 50020, N'Khong tim thay document.', 1;

        SELECT TOP (1) @prev_no = v.version_no, @prev_hash = v.hash
          FROM [$(SchemaName)].[document_version] v
         WHERE v.document_id = @document_id
         ORDER BY v.version_no DESC;

        SET @version_no = ISNULL(@prev_no, 0) + 1;
        SET @status_at_version = ISNULL(@status_at_version, @doc_status);

        SET @hash = [$(SchemaName)].[fn_document_version_hash](
            @prev_hash, @document_id, @version_no, @actor_role, @actor_user_id, @change_source,
            @status_at_version, @source_commit_sha, @source_pr_number, @source_pr_kind,
            @rolled_back_from_version_no, @now, @digest);

        INSERT INTO [$(SchemaName)].[document_version]
            (document_id, version_no, content, content_digest, content_redacted, actor_role, actor_user_id,
             change_source, status_at_version, source_commit_sha, source_pr_number, source_pr_kind,
             reason, rolled_back_from_version_no, prev_hash, hash, created_at, created_by, updated_at, updated_by)
        OUTPUT inserted.id INTO @ins
        VALUES
            (@document_id, @version_no, @content, @digest, 0, @actor_role, @actor_user_id,
             @change_source, @status_at_version, @source_commit_sha, @source_pr_number, @source_pr_kind,
             @reason, @rolled_back_from_version_no, @prev_hash, @hash, @now, @actor_user_id, @now, @actor_user_id);

        SELECT @version_id = id FROM @ins;

        IF @set_as_current = 1
            UPDATE [$(SchemaName)].[document]
               SET current_version_id = @version_id,
                   updated_at = @now,
                   updated_by = @actor_user_id
             WHERE id = @document_id;

        IF @own = 1 COMMIT;
    END TRY
    BEGIN CATCH
        IF @own = 1 AND @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO

/* ---------- sp_update_document_state ----------
   Cổng duy nhất ghi ba cột trạng thái (FR-WF-24). sp_transition_document_status của Huy
   kiểm tra chuyển trạng thái hợp lệ rồi GỌI proc này. NULL = giữ nguyên giá trị cũ. */
CREATE OR ALTER PROCEDURE [$(SchemaName)].[sp_update_document_state]
    @document_id     UNIQUEIDENTIFIER,
    @doc_status      VARCHAR(30)      = NULL,
    @publish_status  VARCHAR(30)      = NULL,
    @pr_status       VARCHAR(20)      = NULL,
    @docs_branch     NVARCHAR(255)    = NULL,
    @docs_pr_number  INT              = NULL,
    @clear_docs_pr   BIT              = 0,     -- 1 = xóa docs_branch và docs_pr_number
    @actor_user_id   UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    UPDATE [$(SchemaName)].[document]
       SET doc_status     = ISNULL(@doc_status, doc_status),
           publish_status = ISNULL(@publish_status, publish_status),
           pr_status      = ISNULL(@pr_status, pr_status),
           docs_branch    = CASE WHEN @clear_docs_pr = 1 THEN NULL ELSE ISNULL(@docs_branch, docs_branch) END,
           docs_pr_number = CASE WHEN @clear_docs_pr = 1 THEN NULL ELSE ISNULL(@docs_pr_number, docs_pr_number) END,
           -- Khi chuyển sang PUBLISHED, ghi nhớ bản vừa vào nhánh đích (cho diff FR-AUTO-06)
           published_version_id = CASE WHEN @doc_status = 'PUBLISHED' THEN current_version_id ELSE published_version_id END,
           updated_at     = SYSUTCDATETIME(),
           updated_by     = @actor_user_id
     WHERE id = @document_id;

    IF @@ROWCOUNT = 0 THROW 50020, N'Khong tim thay document.', 1;
END
GO

/* ---------- sp_create_document ---------- */
CREATE OR ALTER PROCEDURE [$(SchemaName)].[sp_create_document]
    @repository_id       UNIQUEIDENTIFIER,
    @doc_type            VARCHAR(30),
    @title               NVARCHAR(500),
    @path_in_repo        NVARCHAR(450),
    @owner_id            UNIQUEIDENTIFIER,
    @content             NVARCHAR(MAX),
    @actor_role          VARCHAR(20)      = 'AI',
    @actor_user_id       UNIQUEIDENTIFIER = NULL,
    @change_source       VARCHAR(30)      = 'AI_GENERATION',
    @initial_doc_status  VARCHAR(30)      = 'DRAFT',     -- ví dụ IN_REVIEW_STAFF cho chỉnh sửa ngoài hệ thống (FR-GH-12)
    @template_id         UNIQUEIDENTIFIER = NULL,
    @collection_id       UNIQUEIDENTIFIER = NULL,
    @source_commit_sha   VARCHAR(64)      = NULL,
    @source_pr_number    INT              = NULL,
    @source_pr_kind      VARCHAR(10)      = NULL,
    @auto_update_enabled BIT              = 1,
    @document_id         UNIQUEIDENTIFIER = NULL OUTPUT,
    @version_id          UNIQUEIDENTIFIER = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @own BIT = IIF(@@TRANCOUNT = 0, 1, 0);
    DECLARE @ins TABLE (id UNIQUEIDENTIFIER);

    BEGIN TRY
        IF @own = 1 BEGIN TRAN;

        INSERT INTO [$(SchemaName)].[document]
            (repository_id, doc_type, template_id, collection_id, owner_id, title, path_in_repo,
             auto_update_enabled, doc_status, created_by, updated_by)
        OUTPUT inserted.id INTO @ins
        VALUES
            (@repository_id, @doc_type, @template_id, @collection_id, @owner_id, @title, @path_in_repo,
             @auto_update_enabled, @initial_doc_status, @actor_user_id, @actor_user_id);

        SELECT @document_id = id FROM @ins;

        EXEC [$(SchemaName)].[sp_append_document_version]
            @document_id       = @document_id,
            @content           = @content,
            @actor_role        = @actor_role,
            @actor_user_id     = @actor_user_id,
            @change_source     = @change_source,
            @status_at_version = @initial_doc_status,
            @source_commit_sha = @source_commit_sha,
            @source_pr_number  = @source_pr_number,
            @source_pr_kind    = @source_pr_kind,
            @version_id        = @version_id OUTPUT;

        IF @own = 1 COMMIT;
    END TRY
    BEGIN CATCH
        IF @own = 1 AND @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO

/* ---------- sp_verify_version_chain ----------
   Trả về result set các bản ghi có vấn đề (rỗng = chuỗi sạch) và @is_valid.
   problem: HASH_MISMATCH  hash lưu khác hash tính lại (metadata/digest bị sửa)
            BROKEN_LINK    prev_hash không bằng hash của version liền trước
            VERSION_GAP    version_no không liên tục từ 1
            DIGEST_MISMATCH content không còn khớp content_digest (chỉ kiểm khi chưa bị che) */
CREATE OR ALTER PROCEDURE [$(SchemaName)].[sp_verify_version_chain]
    @document_id UNIQUEIDENTIFIER,
    @is_valid    BIT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM [$(SchemaName)].[document] WHERE id = @document_id)
        THROW 50020, N'Khong tim thay document.', 1;

    DECLARE @problems TABLE (document_version_id UNIQUEIDENTIFIER, version_no INT, problem VARCHAR(20));

    ;WITH v AS (
        SELECT dv.*,
               LAG(dv.hash) OVER (ORDER BY dv.version_no) AS lag_hash,
               ROW_NUMBER() OVER (ORDER BY dv.version_no) AS rn,
               [$(SchemaName)].[fn_document_version_hash](
                   dv.prev_hash, dv.document_id, dv.version_no, dv.actor_role, dv.actor_user_id,
                   dv.change_source, dv.status_at_version, dv.source_commit_sha, dv.source_pr_number,
                   dv.source_pr_kind, dv.rolled_back_from_version_no, dv.created_at, dv.content_digest) AS expected_hash
          FROM [$(SchemaName)].[document_version] dv
         WHERE dv.document_id = @document_id
    )
    INSERT INTO @problems (document_version_id, version_no, problem)
    SELECT v.id, v.version_no, p.problem
      FROM v
     CROSS APPLY (VALUES
         (CASE WHEN v.hash <> v.expected_hash THEN 'HASH_MISMATCH' END),
         (CASE WHEN ISNULL(v.prev_hash, 0x) <> ISNULL(v.lag_hash, 0x) THEN 'BROKEN_LINK' END),
         (CASE WHEN v.version_no <> v.rn THEN 'VERSION_GAP' END),
         (CASE WHEN v.content_redacted = 0 AND v.content_digest <> HASHBYTES('SHA2_256', v.content)
               THEN 'DIGEST_MISMATCH' END)
     ) p(problem)
     WHERE p.problem IS NOT NULL;

    SET @is_valid = IIF(EXISTS (SELECT 1 FROM @problems), 0, 1);

    SELECT document_version_id, version_no, problem
      FROM @problems
     ORDER BY version_no, problem;
END
GO

/* ---------- sp_redact_document_content ----------
   Che nội dung (mục 4.8): content = NULL, content_redacted = 1, xóa reason.
   Giữ digest/hash => sp_verify_version_chain vẫn sạch.
   Hiếu gọi từ sp_disconnect_repository:
       EXEC sp_redact_document_content @repository_id = @repo_id, @redacted_by = @user_id;
   Truyền đúng MỘT trong @repository_id hoặc @document_id. */
CREATE OR ALTER PROCEDURE [$(SchemaName)].[sp_redact_document_content]
    @repository_id  UNIQUEIDENTIFIER = NULL,
    @document_id    UNIQUEIDENTIFIER = NULL,
    @redacted_by    UNIQUEIDENTIFIER = NULL,
    @redacted_count INT              = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF (@repository_id IS NULL AND @document_id IS NULL) OR (@repository_id IS NOT NULL AND @document_id IS NOT NULL)
        THROW 50027, N'Truyen dung mot trong @repository_id hoac @document_id.', 1;

    DECLARE @own BIT = IIF(@@TRANCOUNT = 0, 1, 0);

    BEGIN TRY
        IF @own = 1 BEGIN TRAN;

        SELECT @redacted_count = COUNT(*)
          FROM [$(SchemaName)].[document_version] v
          JOIN [$(SchemaName)].[document] d ON d.id = v.document_id
         WHERE v.content_redacted = 0
           AND ((@document_id IS NOT NULL AND d.id = @document_id)
             OR (@repository_id IS NOT NULL AND d.repository_id = @repository_id));

        EXEC sys.sp_set_session_context @key = N'ld_allow_redact', @value = 1;

        UPDATE v
           SET content = NULL, content_redacted = 1, reason = NULL, updated_by = @redacted_by
          FROM [$(SchemaName)].[document_version] v
          JOIN [$(SchemaName)].[document] d ON d.id = v.document_id
         WHERE v.content_redacted = 0
           AND ((@document_id IS NOT NULL AND d.id = @document_id)
             OR (@repository_id IS NOT NULL AND d.repository_id = @repository_id));

        EXEC sys.sp_set_session_context @key = N'ld_allow_redact', @value = 0;

        IF @own = 1 COMMIT;
    END TRY
    BEGIN CATCH
        EXEC sys.sp_set_session_context @key = N'ld_allow_redact', @value = 0;
        IF @own = 1 AND @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO

/* ---------- sp_rollback_document ----------
   - Chỉ Developer / Manager / Technical Lead (FR-VER-05); bắt buộc có lý do.
   - Luôn tạo version MỚI, không xóa lịch sử (FR-VER-09).
   - "Từng được duyệt" = tồn tại version cùng content_digest có status_at_version
     thuộc APPROVED / PENDING_MERGE / PUBLISHED.
       + từng duyệt  : doc_status -> APPROVED, @requires_review = 0 (hiệu lực ngay)
       + chưa duyệt  : doc_status -> IN_REVIEW_STAFF, @requires_review = 1
   - Việc publish thật (kiểm tra FR-WF-25, tạo PR tài liệu) và việc tạo review_task do
     service workflow làm dựa trên @requires_review; proc này chỉ ghi dữ liệu. */
CREATE OR ALTER PROCEDURE [$(SchemaName)].[sp_rollback_document]
    @document_id       UNIQUEIDENTIFIER,
    @target_version_no INT,
    @actor_role        VARCHAR(20),
    @actor_user_id     UNIQUEIDENTIFIER = NULL,
    @reason            NVARCHAR(1000),
    @new_version_id    UNIQUEIDENTIFIER = NULL OUTPUT,
    @new_version_no    INT              = NULL OUTPUT,
    @requires_review   BIT              = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @actor_role NOT IN ('Developer', 'Manager', 'Technical Lead')
        THROW 50026, N'Chi Developer, Manager, Technical Lead duoc rollback.', 1;
    IF NULLIF(LTRIM(RTRIM(@reason)), N'') IS NULL
        THROW 50023, N'Rollback bat buoc co ly do.', 1;

    DECLARE @own      BIT = IIF(@@TRANCOUNT = 0, 1, 0);
    DECLARE @content  NVARCHAR(MAX), @digest VARBINARY(32), @redacted BIT;
    DECLARE @approved BIT, @new_status VARCHAR(30);

    BEGIN TRY
        IF @own = 1 BEGIN TRAN;

        -- Khóa document trước để kiểm tra "từng duyệt" không bị chen ngang
        IF NOT EXISTS (SELECT 1 FROM [$(SchemaName)].[document] WITH (UPDLOCK, HOLDLOCK) WHERE id = @document_id)
            THROW 50020, N'Khong tim thay document.', 1;

        SELECT @content = v.content, @digest = v.content_digest, @redacted = v.content_redacted
          FROM [$(SchemaName)].[document_version] v
         WHERE v.document_id = @document_id AND v.version_no = @target_version_no;
        IF @@ROWCOUNT = 0 THROW 50024, N'Khong tim thay version dich.', 1;
        IF @redacted = 1 THROW 50025, N'Version dich da bi che noi dung, khong the rollback.', 1;

        SET @approved = IIF(EXISTS (
            SELECT 1 FROM [$(SchemaName)].[document_version] v
             WHERE v.document_id = @document_id
               AND v.content_digest = @digest
               AND v.status_at_version IN ('APPROVED', 'PENDING_MERGE', 'PUBLISHED')), 1, 0);

        SET @new_status = IIF(@approved = 1, 'APPROVED', 'IN_REVIEW_STAFF');

        EXEC [$(SchemaName)].[sp_append_document_version]
            @document_id                 = @document_id,
            @content                     = @content,
            @actor_role                  = @actor_role,
            @actor_user_id               = @actor_user_id,
            @change_source               = 'ROLLBACK',
            @status_at_version           = @new_status,
            @reason                      = @reason,
            @rolled_back_from_version_no = @target_version_no,
            @version_id                  = @new_version_id OUTPUT,
            @version_no                  = @new_version_no OUTPUT;

        EXEC [$(SchemaName)].[sp_update_document_state]
            @document_id    = @document_id,
            @doc_status     = @new_status,
            @publish_status = 'NOT_PUBLISHED',
            @pr_status      = 'NONE',
            @actor_user_id  = @actor_user_id;

        SET @requires_review = IIF(@approved = 1, 0, 1);

        IF @own = 1 COMMIT;
    END TRY
    BEGIN CATCH
        IF @own = 1 AND @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO

/* ---------- sp_rollback_collection (FR-VER-07, giai đoạn 2) ----------
   Đưa mọi tài liệu của bộ sưu tập về version mới nhất có created_at <= @as_of.
   Bỏ qua tài liệu: chưa có version nào trước @as_of, đang đúng ở version đó, hoặc version đích đã bị che.
   Atomic: một tài liệu lỗi thì cả lô bị hủy. */
CREATE OR ALTER PROCEDURE [$(SchemaName)].[sp_rollback_collection]
    @collection_id     UNIQUEIDENTIFIER,
    @as_of             DATETIME2(3),
    @actor_user_id     UNIQUEIDENTIFIER = NULL,
    @reason            NVARCHAR(1000),
    @rolled_back_count INT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NULLIF(LTRIM(RTRIM(@reason)), N'') IS NULL
        THROW 50023, N'Rollback bat buoc co ly do.', 1;

    DECLARE @own BIT = IIF(@@TRANCOUNT = 0, 1, 0);
    DECLARE @targets TABLE (seq INT IDENTITY(1,1), document_id UNIQUEIDENTIFIER, target_version_no INT);
    DECLARE @i INT = 1, @n INT, @doc UNIQUEIDENTIFIER, @tv INT;

    BEGIN TRY
        IF @own = 1 BEGIN TRAN;

        INSERT INTO @targets (document_id, target_version_no)
        SELECT d.id, t.version_no
          FROM [$(SchemaName)].[document] d
          JOIN [$(SchemaName)].[document_version] cur ON cur.id = d.current_version_id
         CROSS APPLY (SELECT TOP (1) v.version_no
                        FROM [$(SchemaName)].[document_version] v
                       WHERE v.document_id = d.id AND v.created_at <= @as_of AND v.content_redacted = 0
                       ORDER BY v.version_no DESC) t
         WHERE d.collection_id = @collection_id
           AND t.version_no <> cur.version_no;

        SELECT @n = COUNT(*) FROM @targets;

        WHILE @i <= @n
        BEGIN
            SELECT @doc = document_id, @tv = target_version_no FROM @targets WHERE seq = @i;

            EXEC [$(SchemaName)].[sp_rollback_document]
                @document_id       = @doc,
                @target_version_no = @tv,
                @actor_role        = 'Technical Lead',
                @actor_user_id     = @actor_user_id,
                @reason            = @reason;

            SET @i += 1;
        END

        SET @rolled_back_count = @n;
        IF @own = 1 COMMIT;
    END TRY
    BEGIN CATCH
        IF @own = 1 AND @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
