SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ---------- template / collection ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_template_doc_type' AND object_id = OBJECT_ID(N'[$(SchemaName)].[template]'))
    CREATE INDEX ix_template_doc_type ON [$(SchemaName)].[template] (doc_type, status);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_collection_owner' AND object_id = OBJECT_ID(N'[$(SchemaName)].[collection]'))
    CREATE INDEX ix_collection_owner ON [$(SchemaName)].[collection] (owner_id) WHERE owner_id IS NOT NULL;
GO

/* ---------- document ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_document_repository_status' AND object_id = OBJECT_ID(N'[$(SchemaName)].[document]'))
    CREATE INDEX ix_document_repository_status ON [$(SchemaName)].[document] (repository_id, doc_status)
        INCLUDE (doc_type, collection_id, publish_status, pr_status);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_document_collection' AND object_id = OBJECT_ID(N'[$(SchemaName)].[document]'))
    CREATE INDEX ix_document_collection ON [$(SchemaName)].[document] (collection_id) INCLUDE (doc_status)
        WHERE collection_id IS NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_document_owner' AND object_id = OBJECT_ID(N'[$(SchemaName)].[document]'))
    CREATE INDEX ix_document_owner ON [$(SchemaName)].[document] (owner_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_document_template' AND object_id = OBJECT_ID(N'[$(SchemaName)].[document]'))
    CREATE INDEX ix_document_template ON [$(SchemaName)].[document] (template_id) WHERE template_id IS NOT NULL;
GO
-- Tra tài liệu theo PR tài liệu khi nhận webhook merge/close (FR-WF-26)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_document_docs_pr' AND object_id = OBJECT_ID(N'[$(SchemaName)].[document]'))
    CREATE INDEX ix_document_docs_pr ON [$(SchemaName)].[document] (repository_id, docs_pr_number)
        WHERE docs_pr_number IS NOT NULL;
GO

/* ---------- document_version ---------- */
-- (document_id, version_no) đã có qua uq_document_version
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_document_version_actor' AND object_id = OBJECT_ID(N'[$(SchemaName)].[document_version]'))
    CREATE INDEX ix_document_version_actor ON [$(SchemaName)].[document_version] (actor_role, created_at DESC)
        INCLUDE (document_id, change_source);   -- lọc change log theo vai trò + thời gian (FR-VER-06)
GO
-- Tra "bản này từng được duyệt chưa" cho rollback (FR-VER-09)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_document_version_digest' AND object_id = OBJECT_ID(N'[$(SchemaName)].[document_version]'))
    CREATE INDEX ix_document_version_digest ON [$(SchemaName)].[document_version] (document_id, content_digest)
        INCLUDE (status_at_version);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_document_version_source_pr' AND object_id = OBJECT_ID(N'[$(SchemaName)].[document_version]'))
    CREATE INDEX ix_document_version_source_pr ON [$(SchemaName)].[document_version] (source_pr_number, source_pr_kind)
        WHERE source_pr_number IS NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_document_version_actor_user' AND object_id = OBJECT_ID(N'[$(SchemaName)].[document_version]'))
    CREATE INDEX ix_document_version_actor_user ON [$(SchemaName)].[document_version] (actor_user_id)
        WHERE actor_user_id IS NOT NULL;
GO

/* ---------- doc_code_link: tra cứu hai chiều ---------- */
-- tài liệu -> code
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_doc_code_link_doc' AND object_id = OBJECT_ID(N'[$(SchemaName)].[doc_code_link]'))
    CREATE INDEX ix_doc_code_link_doc ON [$(SchemaName)].[doc_code_link] (document_id, link_type)
        INCLUDE (code_entity_id, external_ref);
GO
-- code -> tài liệu (phân tích tác động khi code đổi)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_doc_code_link_code' AND object_id = OBJECT_ID(N'[$(SchemaName)].[doc_code_link]'))
    CREATE INDEX ix_doc_code_link_code ON [$(SchemaName)].[doc_code_link] (code_entity_id, document_id)
        WHERE code_entity_id IS NOT NULL;
GO
-- commit / PR / ticket -> tài liệu
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_doc_code_link_external' AND object_id = OBJECT_ID(N'[$(SchemaName)].[doc_code_link]'))
    CREATE INDEX ix_doc_code_link_external ON [$(SchemaName)].[doc_code_link] (link_type, external_ref)
        INCLUDE (document_id) WHERE external_ref IS NOT NULL;
GO

/* ---------- Full-Text Index (đóng vai SearchIndex, FR-KB-01) ----------
   Cần Full-Text Search đã cài trên instance (Docker: gói mssql-server-fts).
   LANGUAGE 0 = neutral vì SQL Server không có word breaker tiếng Việt.
   Full-Text chỉ index từng bảng nên có hai index: tiêu đề (document), nội dung (document_version).
   Dòng version bị che (content = NULL) tự rời khỏi index nhờ CHANGE_TRACKING AUTO. */
IF SERVERPROPERTY('IsFullTextInstalled') = 1
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.fulltext_catalogs WHERE name = N'ft_$(SchemaName)')
        CREATE FULLTEXT CATALOG [ft_$(SchemaName)];

    IF NOT EXISTS (SELECT 1 FROM sys.fulltext_indexes WHERE object_id = OBJECT_ID(N'[$(SchemaName)].[document]'))
        CREATE FULLTEXT INDEX ON [$(SchemaName)].[document] (title LANGUAGE 0)
            KEY INDEX pk_document ON [ft_$(SchemaName)] WITH CHANGE_TRACKING AUTO;

    IF NOT EXISTS (SELECT 1 FROM sys.fulltext_indexes WHERE object_id = OBJECT_ID(N'[$(SchemaName)].[document_version]'))
        CREATE FULLTEXT INDEX ON [$(SchemaName)].[document_version] (content LANGUAGE 0)
            KEY INDEX pk_document_version ON [ft_$(SchemaName)] WITH CHANGE_TRACKING AUTO;
END
ELSE
    PRINT N'CANH BAO: Full-Text Search chua duoc cai tren instance nay, bo qua Full-Text Index.';
GO
