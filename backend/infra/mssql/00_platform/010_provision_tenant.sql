-- Duoc db.ps1 goi voi cac bien: Code, TenantName
EXEC platform.sp_create_workspace @code = '$(Code)', @name = N'$(TenantName)';
GO
