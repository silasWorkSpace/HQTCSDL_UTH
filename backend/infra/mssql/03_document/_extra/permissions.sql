SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

DECLARE @role SYSNAME = N'role_ws_' + SUBSTRING(N'$(SchemaName)', 4, 100);

IF DATABASE_PRINCIPAL_ID(@role) IS NULL
BEGIN
    PRINT N'Bo qua permissions: chua co role ' + @role + N' (chay 01_identity truoc).';
END
ELSE
BEGIN
    DECLARE @r NVARCHAR(300) = QUOTENAME(@role);
    DECLARE @sql NVARCHAR(MAX) = N'
GRANT SELECT ON [$(SchemaName)].[template]                    TO ' + @r + N';
GRANT SELECT ON [$(SchemaName)].[template_version]            TO ' + @r + N';
GRANT SELECT ON [$(SchemaName)].[collection]                  TO ' + @r + N';
GRANT SELECT ON [$(SchemaName)].[document]                    TO ' + @r + N';
GRANT SELECT ON [$(SchemaName)].[document_version]            TO ' + @r + N';
GRANT SELECT ON [$(SchemaName)].[doc_code_link]               TO ' + @r + N';
GRANT SELECT ON [$(SchemaName)].[v_document_current]          TO ' + @r + N';
GRANT SELECT ON [$(SchemaName)].[v_document_version_timeline] TO ' + @r + N';

GRANT INSERT, UPDATE, DELETE ON [$(SchemaName)].[template]         TO ' + @r + N';
GRANT INSERT, UPDATE, DELETE ON [$(SchemaName)].[template_version] TO ' + @r + N';
GRANT INSERT, UPDATE, DELETE ON [$(SchemaName)].[collection]       TO ' + @r + N';
GRANT INSERT, UPDATE, DELETE ON [$(SchemaName)].[doc_code_link]    TO ' + @r + N';

GRANT UPDATE (title, path_in_repo, owner_id, collection_id, template_id, auto_update_enabled)
    ON [$(SchemaName)].[document] TO ' + @r + N';
DENY  INSERT, DELETE ON [$(SchemaName)].[document] TO ' + @r + N';
DENY  UPDATE (doc_status, publish_status, pr_status, current_version_id, published_version_id, docs_branch, docs_pr_number)
    ON [$(SchemaName)].[document] TO ' + @r + N';

DENY  INSERT, UPDATE, DELETE ON [$(SchemaName)].[document_version] TO ' + @r + N';

GRANT EXECUTE ON [$(SchemaName)].[sp_create_document]          TO ' + @r + N';
GRANT EXECUTE ON [$(SchemaName)].[sp_append_document_version]  TO ' + @r + N';
GRANT EXECUTE ON [$(SchemaName)].[sp_update_document_state]    TO ' + @r + N';
GRANT EXECUTE ON [$(SchemaName)].[sp_verify_version_chain]     TO ' + @r + N';
GRANT EXECUTE ON [$(SchemaName)].[sp_redact_document_content]  TO ' + @r + N';
GRANT EXECUTE ON [$(SchemaName)].[sp_rollback_document]        TO ' + @r + N';
GRANT EXECUTE ON [$(SchemaName)].[sp_rollback_collection]      TO ' + @r + N';
GRANT EXECUTE ON [$(SchemaName)].[fn_document_version_hash]    TO ' + @r + N';';

    EXEC sys.sp_executesql @sql;
END
GO
