SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

CREATE OR ALTER VIEW [$(SchemaName)].[v_document_current]
AS
SELECT
    d.id                      AS document_id,
    d.repository_id,
    d.title,
    d.path_in_repo,
    d.doc_type,
    d.collection_id,
    c.name                    AS collection_name,
    d.template_id,
    t.name                    AS template_name,
    d.owner_id,
    d.auto_update_enabled,
    -- ba trạng thái quản lý riêng (FR-WF-24)
    d.doc_status,
    d.publish_status,
    d.pr_status,
    d.docs_branch,
    d.docs_pr_number,
    -- version hiện tại
    d.current_version_id,
    cv.version_no             AS current_version_no,
    cv.actor_role             AS current_actor_role,
    cv.change_source          AS current_change_source,
    cv.content                AS current_content,
    cv.content_digest         AS current_content_digest,
    cv.content_redacted       AS current_content_redacted,
    cv.created_at             AS current_version_at,
    -- version đang ở nhánh đích (diff FR-AUTO-06)
    d.published_version_id,
    pv.version_no             AS published_version_no,
    d.created_at,
    d.updated_at
FROM [$(SchemaName)].[document] d
LEFT JOIN [$(SchemaName)].[document_version] cv ON cv.id = d.current_version_id
LEFT JOIN [$(SchemaName)].[document_version] pv ON pv.id = d.published_version_id
LEFT JOIN [$(SchemaName)].[collection]       c  ON c.id  = d.collection_id
LEFT JOIN [$(SchemaName)].[template]         t  ON t.id  = d.template_id;
GO

CREATE OR ALTER VIEW [$(SchemaName)].[v_document_version_timeline]
AS
SELECT
    v.id                      AS document_version_id,
    v.document_id,
    d.repository_id,
    d.collection_id,
    d.title                   AS document_title,
    v.version_no,
    v.actor_role,
    v.actor_user_id,
    v.change_source,
    v.status_at_version,
    v.source_commit_sha,
    v.source_pr_number,
    v.source_pr_kind,
    v.reason,
    v.rolled_back_from_version_no,
    v.content_redacted,
    v.prev_hash,
    v.hash,
    v.created_at
FROM [$(SchemaName)].[document_version] v
JOIN [$(SchemaName)].[document] d ON d.id = v.document_id;
GO
