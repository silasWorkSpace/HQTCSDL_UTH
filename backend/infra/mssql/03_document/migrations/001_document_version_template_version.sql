SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF COL_LENGTH('[$(SchemaName)].document_version', 'template_version_id') IS NULL
BEGIN
    ALTER TABLE [$(SchemaName)].document_version
    ADD template_version_id UNIQUEIDENTIFIER NULL;
END
GO
