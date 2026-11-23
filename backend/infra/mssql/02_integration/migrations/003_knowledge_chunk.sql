SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF OBJECT_ID(N'[$(SchemaName)].[knowledge_chunk]', N'U') IS NULL
BEGIN
    CREATE TABLE [$(SchemaName)].[knowledge_chunk] (
        id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_knowledge_chunk_id DEFAULT NEWSEQUENTIALID(),
        repository_id       UNIQUEIDENTIFIER NULL,
        document_id         UNIQUEIDENTIFIER NULL,
        document_version_id UNIQUEIDENTIFIER NULL,
        commit_sha          VARCHAR(64)      NULL,
        file_path           NVARCHAR(450)    NULL,
        chunk_type          VARCHAR(50)      NOT NULL, -- 'CODE', 'DOCUMENT'
        content             NVARCHAR(MAX)    NOT NULL, -- Secret-masked content
        checksum            VARCHAR(64)      NOT NULL, -- SHA256 of masked content
        entity_links        NVARCHAR(MAX)    NULL,     -- JSON array of linked entity IDs
        embedding_model     VARCHAR(100)     NULL,
        embedding_vector    NVARCHAR(MAX)    NULL,     -- JSON array or vector ref
        created_at          DATETIME2(3)     NOT NULL CONSTRAINT df_knowledge_chunk_created_at DEFAULT SYSUTCDATETIME(),
        updated_at          DATETIME2(3)     NOT NULL CONSTRAINT df_knowledge_chunk_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT pk_knowledge_chunk PRIMARY KEY CLUSTERED (id),
        CONSTRAINT ck_knowledge_chunk_type CHECK (chunk_type IN ('CODE', 'DOCUMENT'))
    );

    CREATE NONCLUSTERED INDEX ix_knowledge_chunk_repo_commit
        ON [$(SchemaName)].[knowledge_chunk] (repository_id, commit_sha)
        INCLUDE (file_path, checksum, chunk_type);

    CREATE NONCLUSTERED INDEX ix_knowledge_chunk_document_version
        ON [$(SchemaName)].[knowledge_chunk] (document_id, document_version_id);

    CREATE NONCLUSTERED INDEX ix_knowledge_chunk_checksum
        ON [$(SchemaName)].[knowledge_chunk] (checksum);
END;
GO
