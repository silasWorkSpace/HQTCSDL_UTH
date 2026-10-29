SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ---------- document_version: chặn DELETE ---------- */
CREATE OR ALTER TRIGGER [$(SchemaName)].[trg_document_version_instead_of_delete]
ON [$(SchemaName)].[document_version]
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50011, N'document_version la change log bat bien: khong duoc xoa (FR-VER-08).', 1;
END
GO

CREATE OR ALTER TRIGGER [$(SchemaName)].[trg_document_version_instead_of_update]
ON [$(SchemaName)].[document_version]
INSTEAD OF UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF ISNULL(CONVERT(INT, SESSION_CONTEXT(N'ld_allow_redact')), 0) <> 1
        THROW 50010, N'document_version la change log bat bien: chi duoc che noi dung qua sp_redact_document_content.', 1;

    -- Không cho đổi khóa chính
    IF (SELECT COUNT(*) FROM inserted) <> (SELECT COUNT(*) FROM inserted i JOIN deleted d ON d.id = i.id)
        THROW 50013, N'Khong duoc thay doi id cua document_version.', 1;

    -- Chỉ chấp nhận thao tác che
    IF EXISTS (SELECT 1 FROM inserted WHERE content_redacted <> 1 OR content IS NOT NULL)
        THROW 50012, N'Chi cho phep che noi dung (content = NULL, content_redacted = 1).', 1;

    -- Mọi cột bất biến phải giữ nguyên
    IF EXISTS (
        SELECT 1 FROM inserted i JOIN deleted d ON d.id = i.id
        WHERE EXISTS (
            SELECT i.document_id, i.version_no, i.content_digest, i.actor_role, i.actor_user_id,
                   i.change_source, i.status_at_version, i.source_commit_sha, i.source_pr_number,
                   i.source_pr_kind, i.rolled_back_from_version_no, i.prev_hash, i.hash,
                   i.created_at, i.created_by
            EXCEPT
            SELECT d.document_id, d.version_no, d.content_digest, d.actor_role, d.actor_user_id,
                   d.change_source, d.status_at_version, d.source_commit_sha, d.source_pr_number,
                   d.source_pr_kind, d.rolled_back_from_version_no, d.prev_hash, d.hash,
                   d.created_at, d.created_by))
        THROW 50013, N'Khong duoc thay doi metadata/hash cua document_version.', 1;

    UPDATE t
       SET content          = NULL,
           content_redacted = 1,
           reason           = NULL,                     -- lý do có thể chứa code => che luôn
           updated_at       = SYSUTCDATETIME(),
           updated_by       = i.updated_by
      FROM [$(SchemaName)].[document_version] t
      JOIN inserted i ON i.id = t.id;
END
GO

/* ---------- Tự cập nhật updated_at (chỉ khi câu lệnh không tự đặt updated_at) ---------- */
CREATE OR ALTER TRIGGER [$(SchemaName)].[trg_document_touch]
ON [$(SchemaName)].[document] AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF UPDATE(updated_at) RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
      FROM [$(SchemaName)].[document] t JOIN inserted i ON i.id = t.id;
END
GO

CREATE OR ALTER TRIGGER [$(SchemaName)].[trg_template_touch]
ON [$(SchemaName)].[template] AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF UPDATE(updated_at) RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
      FROM [$(SchemaName)].[template] t JOIN inserted i ON i.id = t.id;
END
GO

CREATE OR ALTER TRIGGER [$(SchemaName)].[trg_template_version_touch]
ON [$(SchemaName)].[template_version] AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF UPDATE(updated_at) RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
      FROM [$(SchemaName)].[template_version] t JOIN inserted i ON i.id = t.id;
END
GO

CREATE OR ALTER TRIGGER [$(SchemaName)].[trg_collection_touch]
ON [$(SchemaName)].[collection] AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF UPDATE(updated_at) RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
      FROM [$(SchemaName)].[collection] t JOIN inserted i ON i.id = t.id;
END
GO
