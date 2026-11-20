-- Keep source events append-only while allowing the configured repository cascade.
-- AFTER triggers run after referential cascade actions; during a repository cascade,
-- the parent repository is no longer present in the deleted source-event set.
CREATE OR ALTER TRIGGER [$(SchemaName)].trg_source_event_immutable
ON [$(SchemaName)].source_event
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM inserted)
       OR EXISTS (
            SELECT 1
            FROM deleted d
            JOIN [$(SchemaName)].repository r ON r.id = d.repository_id
       )
    BEGIN
        RAISERROR(N'Bảng source_event là nhật ký bất biến. Chỉ được xóa theo cascade khi repository bị xóa.', 16, 1);
        ROLLBACK TRANSACTION;
    END;
END;
GO
