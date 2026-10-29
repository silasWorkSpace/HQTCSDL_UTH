SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ---------- 5 template mặc định ---------- */
DECLARE @seed TABLE (name NVARCHAR(200), doc_type VARCHAR(30), description NVARCHAR(1000), sections NVARCHAR(MAX));

INSERT INTO @seed VALUES
(N'API Reference', 'API_REFERENCE', N'Tham chiếu API: endpoint, tham số, giá trị trả về, lỗi.',
 N'{"sections":[
   {"key":"overview","title":"Tổng quan","required":true},
   {"key":"endpoints","title":"Danh sách endpoint","required":true,"placeholder":"{{endpoint_list}}","entity_kind":"endpoint"},
   {"key":"parameters","title":"Bảng tham số","required":true,"placeholder":"{{parameter_table}}","entity_kind":"parameter"},
   {"key":"responses","title":"Giá trị trả về","required":true},
   {"key":"errors","title":"Mã lỗi","required":false}]}'),
(N'README', 'README', N'README chuẩn cho repo hoặc module.',
 N'{"sections":[
   {"key":"overview","title":"Giới thiệu","required":true},
   {"key":"getting_started","title":"Bắt đầu nhanh","required":true},
   {"key":"usage","title":"Cách sử dụng","required":true},
   {"key":"configuration","title":"Cấu hình","required":false}]}'),
(N'Module Guide', 'MODULE_GUIDE', N'Hướng dẫn module/package: class, phụ thuộc, ví dụ.',
 N'{"sections":[
   {"key":"purpose","title":"Mục đích","required":true},
   {"key":"classes","title":"Danh sách class","required":true,"placeholder":"{{class_list}}","entity_kind":"class"},
   {"key":"dependencies","title":"Phụ thuộc","required":true,"placeholder":"{{dependency_list}}"},
   {"key":"examples","title":"Ví dụ sử dụng","required":false}]}'),
(N'Onboarding Guide', 'ONBOARDING_GUIDE', N'Hướng dẫn hội nhập lập trình viên mới.',
 N'{"sections":[
   {"key":"welcome","title":"Chào mừng","required":true},
   {"key":"architecture","title":"Kiến trúc tổng quan","required":true},
   {"key":"local_setup","title":"Cài đặt môi trường","required":true},
   {"key":"key_modules","title":"Các module chính","required":true,"placeholder":"{{module_list}}"},
   {"key":"contribution","title":"Quy trình đóng góp","required":false}]}'),
(N'ADR', 'ADR', N'Architecture Decision Record.',
 N'{"sections":[
   {"key":"title","title":"Tiêu đề quyết định","required":true},
   {"key":"status","title":"Trạng thái","required":true},
   {"key":"context","title":"Bối cảnh","required":true},
   {"key":"decision","title":"Quyết định","required":true},
   {"key":"consequences","title":"Hệ quả","required":true}]}');

INSERT INTO [$(SchemaName)].[template] (name, doc_type, description, status)
SELECT s.name, s.doc_type, s.description, 'ACTIVE'
  FROM @seed s
 WHERE NOT EXISTS (SELECT 1 FROM [$(SchemaName)].[template] t WHERE t.name = s.name);

INSERT INTO [$(SchemaName)].[template_version] (template_id, version_no, sections, format_rules, change_note)
SELECT t.id, 1, s.sections,
       N'{"output":"markdown","language":"vi","max_heading_depth":3}', N'Seed phien ban dau'
  FROM @seed s
  JOIN [$(SchemaName)].[template] t ON t.name = s.name
 WHERE NOT EXISTS (SELECT 1 FROM [$(SchemaName)].[template_version] v WHERE v.template_id = t.id);

UPDATE t SET current_version_id = v.id
  FROM [$(SchemaName)].[template] t
  JOIN [$(SchemaName)].[template_version] v ON v.template_id = t.id AND v.version_no = 1
 WHERE t.current_version_id IS NULL;
GO

/* ---------- collection mặc định ---------- */
IF NOT EXISTS (SELECT 1 FROM [$(SchemaName)].[collection] WHERE name = N'Default')
    INSERT INTO [$(SchemaName)].[collection] (name, description, default_template_id)
    SELECT N'Default', N'Bo suu tap mac dinh', t.id
      FROM [$(SchemaName)].[template] t WHERE t.name = N'README';
GO

/* ---------- 2 tài liệu mẫu (cần repository + app_user đã seed) ---------- */
DECLARE @repo UNIQUEIDENTIFIER = (SELECT TOP (1) id FROM [$(SchemaName)].[repository] ORDER BY created_at);
DECLARE @usr  UNIQUEIDENTIFIER = (SELECT TOP (1) id FROM [$(SchemaName)].[app_user]  ORDER BY created_at);
DECLARE @col  UNIQUEIDENTIFIER = (SELECT id FROM [$(SchemaName)].[collection] WHERE name = N'Default');
DECLARE @tpl_readme UNIQUEIDENTIFIER = (SELECT id FROM [$(SchemaName)].[template] WHERE name = N'README');
DECLARE @tpl_api    UNIQUEIDENTIFIER = (SELECT id FROM [$(SchemaName)].[template] WHERE name = N'API Reference');
DECLARE @d UNIQUEIDENTIFIER, @v UNIQUEIDENTIFIER;

IF @repo IS NULL OR @usr IS NULL
    PRINT N'Bo qua tai lieu mau: chua co repository/app_user. Chay seed cua Hoang va Hieu roi chay lai.';
ELSE
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [$(SchemaName)].[document] WHERE repository_id = @repo AND path_in_repo = N'README.md')
        EXEC [$(SchemaName)].[sp_create_document]
            @repository_id = @repo, @doc_type = 'README', @title = N'README',
            @path_in_repo = N'README.md', @owner_id = @usr,
            @content = N'# LivingDocs Demo

Tai lieu mau duoc sinh tu seed.',
            @actor_role = 'Developer', @actor_user_id = @usr, @change_source = 'MANUAL_EDIT',
            @template_id = @tpl_readme, @collection_id = @col,
            @document_id = @d OUTPUT, @version_id = @v OUTPUT;

    IF NOT EXISTS (SELECT 1 FROM [$(SchemaName)].[document] WHERE repository_id = @repo AND path_in_repo = N'docs/api.md')
        EXEC [$(SchemaName)].[sp_create_document]
            @repository_id = @repo, @doc_type = 'API_REFERENCE', @title = N'API Reference',
            @path_in_repo = N'docs/api.md', @owner_id = @usr,
            @content = N'# API Reference

## Endpoints

(AI se sinh noi dung o day)',
            @actor_role = 'AI', @actor_user_id = NULL, @change_source = 'AI_GENERATION',
            @template_id = @tpl_api, @collection_id = @col,
            @document_id = @d OUTPUT, @version_id = @v OUTPUT;
END
GO
