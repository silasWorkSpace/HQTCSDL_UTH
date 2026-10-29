SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ---------- 1. template ---------- */
IF OBJECT_ID(N'[$(SchemaName)].[template]', N'U') IS NULL
BEGIN
    CREATE TABLE [$(SchemaName)].[template] (
        id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_template_id DEFAULT NEWSEQUENTIALID(),
        name                NVARCHAR(200)    NOT NULL,
        doc_type            VARCHAR(30)      NOT NULL,
        description         NVARCHAR(1000)   NULL,
        current_version_id  UNIQUEIDENTIFIER NULL,      -- FK thêm sau (vòng với template_version)
        status              VARCHAR(20)      NOT NULL CONSTRAINT df_template_status DEFAULT 'DRAFT',
        created_at          DATETIME2(3)     NOT NULL CONSTRAINT df_template_created_at DEFAULT SYSUTCDATETIME(),
        created_by          UNIQUEIDENTIFIER NULL,
        updated_at          DATETIME2(3)     NOT NULL CONSTRAINT df_template_updated_at DEFAULT SYSUTCDATETIME(),
        updated_by          UNIQUEIDENTIFIER NULL,
        row_version         ROWVERSION       NOT NULL,
        CONSTRAINT pk_template PRIMARY KEY (id),
        CONSTRAINT uq_template_name UNIQUE (name),
        CONSTRAINT ck_template_doc_type CHECK (doc_type IN ('API_REFERENCE','README','MODULE_GUIDE','ONBOARDING_GUIDE','ADR','OTHER')),
        CONSTRAINT ck_template_status CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED'))
    );
END
GO

/* ---------- 2. template_version ---------- */
IF OBJECT_ID(N'[$(SchemaName)].[template_version]', N'U') IS NULL
BEGIN
    CREATE TABLE [$(SchemaName)].[template_version] (
        id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_template_version_id DEFAULT NEWSEQUENTIALID(),
        template_id   UNIQUEIDENTIFIER NOT NULL,
        version_no    INT              NOT NULL,
        sections      NVARCHAR(MAX)    NOT NULL,   -- JSON: mục, tiêu đề, placeholder gắn code entity
        format_rules  NVARCHAR(MAX)    NULL,       -- JSON: quy tắc định dạng/đầu ra cho AI (FR-TPL-06)
        change_note   NVARCHAR(500)    NULL,
        created_at    DATETIME2(3)     NOT NULL CONSTRAINT df_template_version_created_at DEFAULT SYSUTCDATETIME(),
        created_by    UNIQUEIDENTIFIER NULL,
        updated_at    DATETIME2(3)     NOT NULL CONSTRAINT df_template_version_updated_at DEFAULT SYSUTCDATETIME(),
        updated_by    UNIQUEIDENTIFIER NULL,
        row_version   ROWVERSION       NOT NULL,
        CONSTRAINT pk_template_version PRIMARY KEY (id),
        CONSTRAINT fk_template_version_template FOREIGN KEY (template_id)
            REFERENCES [$(SchemaName)].[template](id) ON DELETE CASCADE,
        CONSTRAINT uq_template_version UNIQUE (template_id, version_no),
        CONSTRAINT ck_template_version_no CHECK (version_no > 0),
        CONSTRAINT ck_template_version_sections CHECK (ISJSON(sections) = 1),
        CONSTRAINT ck_template_version_format_rules CHECK (format_rules IS NULL OR ISJSON(format_rules) = 1)
    );
END
GO

/* ---------- 3. collection ---------- */
IF OBJECT_ID(N'[$(SchemaName)].[collection]', N'U') IS NULL
BEGIN
    CREATE TABLE [$(SchemaName)].[collection] (
        id                   UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_collection_id DEFAULT NEWSEQUENTIALID(),
        name                 NVARCHAR(200)    NOT NULL,
        description          NVARCHAR(1000)   NULL,
        owner_id             UNIQUEIDENTIFIER NULL,     -- chủ sở hữu tài liệu (FR-GOV-01), gán sau
        default_template_id  UNIQUEIDENTIFIER NULL,
        created_at           DATETIME2(3)     NOT NULL CONSTRAINT df_collection_created_at DEFAULT SYSUTCDATETIME(),
        created_by           UNIQUEIDENTIFIER NULL,
        updated_at           DATETIME2(3)     NOT NULL CONSTRAINT df_collection_updated_at DEFAULT SYSUTCDATETIME(),
        updated_by           UNIQUEIDENTIFIER NULL,
        row_version          ROWVERSION       NOT NULL,
        CONSTRAINT pk_collection PRIMARY KEY (id),
        CONSTRAINT uq_collection_name UNIQUE (name),
        CONSTRAINT fk_collection_owner FOREIGN KEY (owner_id) REFERENCES [$(SchemaName)].[app_user](id),
        CONSTRAINT fk_collection_default_template FOREIGN KEY (default_template_id) REFERENCES [$(SchemaName)].[template](id)
    );
END
GO

/* ---------- 4. document ---------- */
IF OBJECT_ID(N'[$(SchemaName)].[document]', N'U') IS NULL
BEGIN
    CREATE TABLE [$(SchemaName)].[document] (
        id                    UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_document_id DEFAULT NEWSEQUENTIALID(),
        repository_id         UNIQUEIDENTIFIER NOT NULL,
        doc_type              VARCHAR(30)      NOT NULL,
        template_id           UNIQUEIDENTIFIER NULL,
        collection_id         UNIQUEIDENTIFIER NULL,
        owner_id              UNIQUEIDENTIFIER NOT NULL,
        title                 NVARCHAR(500)    NOT NULL,
        path_in_repo          NVARCHAR(450)    NOT NULL,
        current_version_id    UNIQUEIDENTIFIER NULL,      -- FK thêm sau
        published_version_id  UNIQUEIDENTIFIER NULL,      -- bản đang ở nhánh đích (cho diff FR-AUTO-06); FK thêm sau
        docs_branch           NVARCHAR(255)    NULL,      -- ví dụ livingdocs/<doc-id>
        docs_pr_number        INT              NULL,      -- PR tài liệu (không phải PR nguồn)
        auto_update_enabled   BIT              NOT NULL CONSTRAINT df_document_auto_update DEFAULT 1,
        -- Ba trạng thái quản lý riêng (FR-WF-24). Chỉ ghi qua sp_update_document_state.
        doc_status            VARCHAR(30)      NOT NULL CONSTRAINT df_document_doc_status DEFAULT 'DRAFT',
        publish_status        VARCHAR(30)      NOT NULL CONSTRAINT df_document_publish_status DEFAULT 'NOT_PUBLISHED',
        pr_status             VARCHAR(20)      NOT NULL CONSTRAINT df_document_pr_status DEFAULT 'NONE',
        created_at            DATETIME2(3)     NOT NULL CONSTRAINT df_document_created_at DEFAULT SYSUTCDATETIME(),
        created_by            UNIQUEIDENTIFIER NULL,
        updated_at            DATETIME2(3)     NOT NULL CONSTRAINT df_document_updated_at DEFAULT SYSUTCDATETIME(),
        updated_by            UNIQUEIDENTIFIER NULL,
        row_version           ROWVERSION       NOT NULL,
        CONSTRAINT pk_document PRIMARY KEY (id),
        CONSTRAINT uq_document_repo_path UNIQUE (repository_id, path_in_repo),
        CONSTRAINT fk_document_repository FOREIGN KEY (repository_id) REFERENCES [$(SchemaName)].[repository](id),
        CONSTRAINT fk_document_template   FOREIGN KEY (template_id)   REFERENCES [$(SchemaName)].[template](id),
        CONSTRAINT fk_document_collection FOREIGN KEY (collection_id) REFERENCES [$(SchemaName)].[collection](id),
        CONSTRAINT fk_document_owner      FOREIGN KEY (owner_id)      REFERENCES [$(SchemaName)].[app_user](id),
        CONSTRAINT ck_document_doc_type CHECK (doc_type IN ('API_REFERENCE','README','MODULE_GUIDE','ONBOARDING_GUIDE','ADR','OTHER')),
        CONSTRAINT ck_document_doc_status CHECK (doc_status IN (
            'DRAFT','PENDING_DEVELOPER_ACTION','IN_REVIEW_STAFF','IN_REVIEW_MANAGER','CHANGES_REQUESTED',
            'APPROVED','PENDING_MERGE','PUBLISHED','REJECTED','DISMISSED','SUPERSEDED')),
        CONSTRAINT ck_document_publish_status CHECK (publish_status IN (
            'NOT_PUBLISHED','FAILED','COMMITTED_TO_DOCS_BRANCH','IN_TARGET_BRANCH')),
        CONSTRAINT ck_document_pr_status CHECK (pr_status IN ('NONE','PENDING_MERGE','CLOSED_UNMERGED','MERGED')),
        CONSTRAINT ck_document_pr_number CHECK (docs_pr_number IS NULL OR docs_pr_number > 0),
        -- Nhất quán tối thiểu giữa ba trạng thái (Bảng 14 SRS)
        CONSTRAINT ck_document_state_published CHECK (doc_status <> 'PUBLISHED' OR publish_status = 'IN_TARGET_BRANCH'),
        CONSTRAINT ck_document_state_pending_merge CHECK (doc_status <> 'PENDING_MERGE'
            OR (publish_status = 'COMMITTED_TO_DOCS_BRANCH' AND pr_status = 'PENDING_MERGE'))
    );
END
GO

/* ---------- 5. document_version (= bản ghi change log, bất biến) ---------- */
IF OBJECT_ID(N'[$(SchemaName)].[document_version]', N'U') IS NULL
BEGIN
    CREATE TABLE [$(SchemaName)].[document_version] (
        id                           UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_document_version_id DEFAULT NEWSEQUENTIALID(),
        document_id                  UNIQUEIDENTIFIER NOT NULL,
        version_no                   INT              NOT NULL,
        content                      NVARCHAR(MAX)    NULL,        -- NULL khi đã che (content_redacted = 1)
        content_digest               VARBINARY(32)    NOT NULL,    -- SHA2_256(content)
        content_redacted             BIT              NOT NULL CONSTRAINT df_document_version_redacted DEFAULT 0,
        actor_role                   VARCHAR(20)      NOT NULL,
        actor_user_id                UNIQUEIDENTIFIER NULL,        -- NULL khi actor = AI
        change_source                VARCHAR(30)      NOT NULL,
        status_at_version            VARCHAR(30)      NOT NULL,    -- doc_status tại thời điểm ghi (dùng cho rollback FR-VER-09)
        source_commit_sha            VARCHAR(64)      NULL,
        source_pr_number             INT              NULL,
        source_pr_kind               VARCHAR(10)      NULL,        -- SOURCE (PR nguồn) | DOCS (PR tài liệu)
        reason                       NVARCHAR(1000)   NULL,        -- lý do rollback/duyệt; bị xóa khi che nội dung
        rolled_back_from_version_no  INT              NULL,
        prev_hash                    VARBINARY(32)    NULL,
        hash                         VARBINARY(32)    NOT NULL,
        created_at                   DATETIME2(3)     NOT NULL CONSTRAINT df_document_version_created_at DEFAULT SYSUTCDATETIME(),
        created_by                   UNIQUEIDENTIFIER NULL,
        updated_at                   DATETIME2(3)     NOT NULL CONSTRAINT df_document_version_updated_at DEFAULT SYSUTCDATETIME(),
        updated_by                   UNIQUEIDENTIFIER NULL,
        row_version                  ROWVERSION       NOT NULL,
        CONSTRAINT pk_document_version PRIMARY KEY (id),
        CONSTRAINT uq_document_version UNIQUE (document_id, version_no),
        CONSTRAINT fk_document_version_document FOREIGN KEY (document_id) REFERENCES [$(SchemaName)].[document](id),
        CONSTRAINT fk_document_version_actor_user FOREIGN KEY (actor_user_id) REFERENCES [$(SchemaName)].[app_user](id),
        CONSTRAINT ck_document_version_no CHECK (version_no > 0),
        CONSTRAINT ck_document_version_actor_role CHECK (actor_role IN ('AI','Developer','Staff','Manager','Technical Lead','Administrator')),
        CONSTRAINT ck_document_version_change_source CHECK (change_source IN (
            'AI_GENERATION','AUTO_UPDATE','DRIFT_SUGGESTION','MANUAL_EDIT','ROLLBACK','EXTERNAL_EDIT','REVIEW_ACTION')),
        CONSTRAINT ck_document_version_status CHECK (status_at_version IN (
            'DRAFT','PENDING_DEVELOPER_ACTION','IN_REVIEW_STAFF','IN_REVIEW_MANAGER','CHANGES_REQUESTED',
            'APPROVED','PENDING_MERGE','PUBLISHED','REJECTED','DISMISSED','SUPERSEDED')),
        CONSTRAINT ck_document_version_pr_kind CHECK (source_pr_kind IS NULL OR source_pr_kind IN ('SOURCE','DOCS')),
        CONSTRAINT ck_document_version_hash_len CHECK (
            DATALENGTH(hash) = 32 AND DATALENGTH(content_digest) = 32
            AND (prev_hash IS NULL OR DATALENGTH(prev_hash) = 32)),
        CONSTRAINT ck_document_version_chain_head CHECK (
            (version_no = 1 AND prev_hash IS NULL) OR (version_no > 1 AND prev_hash IS NOT NULL)),
        CONSTRAINT ck_document_version_redaction CHECK (
            (content_redacted = 0 AND content IS NOT NULL) OR (content_redacted = 1 AND content IS NULL))
    );
END
GO

/* ---------- 6. doc_code_link ---------- */
IF OBJECT_ID(N'[$(SchemaName)].[doc_code_link]', N'U') IS NULL
BEGIN
    CREATE TABLE [$(SchemaName)].[doc_code_link] (
        id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_doc_code_link_id DEFAULT NEWSEQUENTIALID(),
        document_id     UNIQUEIDENTIFIER NOT NULL,
        link_type       VARCHAR(20)      NOT NULL,
        code_entity_id  UNIQUEIDENTIFIER NULL,        -- khi link_type = CODE_ENTITY
        external_ref    NVARCHAR(450)    NULL,        -- commit sha, số PR, mã ticket... khi link_type khác
        created_at      DATETIME2(3)     NOT NULL CONSTRAINT df_doc_code_link_created_at DEFAULT SYSUTCDATETIME(),
        created_by      UNIQUEIDENTIFIER NULL,
        updated_at      DATETIME2(3)     NOT NULL CONSTRAINT df_doc_code_link_updated_at DEFAULT SYSUTCDATETIME(),
        updated_by      UNIQUEIDENTIFIER NULL,
        row_version     ROWVERSION       NOT NULL,
        CONSTRAINT pk_doc_code_link PRIMARY KEY (id),
        CONSTRAINT uq_doc_code_link UNIQUE (document_id, link_type, code_entity_id, external_ref),
        CONSTRAINT fk_doc_code_link_document FOREIGN KEY (document_id) REFERENCES [$(SchemaName)].[document](id),
        -- Ngắt kết nối repo xóa code_entity => xóa luôn liên kết (FR-GH-04, mục 4.8)
        CONSTRAINT fk_doc_code_link_code_entity FOREIGN KEY (code_entity_id)
            REFERENCES [$(SchemaName)].[code_entity](id) ON DELETE CASCADE,
        CONSTRAINT ck_doc_code_link_type CHECK (link_type IN ('CODE_ENTITY','COMMIT','PR','TICKET')),
        CONSTRAINT ck_doc_code_link_target CHECK (
            (link_type = 'CODE_ENTITY' AND code_entity_id IS NOT NULL AND external_ref IS NULL)
            OR (link_type <> 'CODE_ENTITY' AND code_entity_id IS NULL AND external_ref IS NOT NULL))
    );
END
GO

/* ---------- FK vòng (thêm sau khi cả hai bảng đã tồn tại) ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys
               WHERE name = N'fk_template_current_version' AND parent_object_id = OBJECT_ID(N'[$(SchemaName)].[template]'))
    ALTER TABLE [$(SchemaName)].[template] ADD CONSTRAINT fk_template_current_version
        FOREIGN KEY (current_version_id) REFERENCES [$(SchemaName)].[template_version](id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys
               WHERE name = N'fk_document_current_version' AND parent_object_id = OBJECT_ID(N'[$(SchemaName)].[document]'))
    ALTER TABLE [$(SchemaName)].[document] ADD CONSTRAINT fk_document_current_version
        FOREIGN KEY (current_version_id) REFERENCES [$(SchemaName)].[document_version](id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys
               WHERE name = N'fk_document_published_version' AND parent_object_id = OBJECT_ID(N'[$(SchemaName)].[document]'))
    ALTER TABLE [$(SchemaName)].[document] ADD CONSTRAINT fk_document_published_version
        FOREIGN KEY (published_version_id) REFERENCES [$(SchemaName)].[document_version](id);
GO
