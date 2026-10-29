-- Kiem tra platform.sp_create_workspace: tu choi ma sai, tu choi ma trung, tao thanh cong day du.
-- Yeu cau: da tao tenant demo (.\db.ps1 tenant -Code demo).
SET NOCOUNT ON;
GO

-- Don dep phong truong hop lan chay truoc bi do giua chung
IF DATABASE_PRINCIPAL_ID(N'role_ws_tmp_test') IS NOT NULL DROP ROLE role_ws_tmp_test;
IF SCHEMA_ID(N'ws_tmp_test') IS NOT NULL DROP SCHEMA ws_tmp_test;
DELETE FROM platform.workspace WHERE code = 'tmp_test';
GO

-- C1: ma co chu hoa -> loi 50001
BEGIN TRY
    EXEC platform.sp_create_workspace @code = 'Demo', @name = N'x';
    PRINT N'C1 FAIL - chap nhan ma co chu hoa';
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() = 50001 PRINT N'C1 PASS - ma co chu hoa bi tu choi';
    ELSE PRINT N'C1 FAIL - loi khac du kien: ' + ERROR_MESSAGE();
END CATCH;
GO

-- C2: ma co ky tu la (dau gach ngang) -> loi 50001
BEGIN TRY
    EXEC platform.sp_create_workspace @code = 'demo-1', @name = N'x';
    PRINT N'C2 FAIL - chap nhan ma co ky tu la';
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() = 50001 PRINT N'C2 PASS - ma co ky tu la bi tu choi';
    ELSE PRINT N'C2 FAIL - loi khac du kien: ' + ERROR_MESSAGE();
END CATCH;
GO

-- C3: thu chen SQL qua ma workspace -> loi 50001, khong co gi bi thuc thi
BEGIN TRY
    EXEC platform.sp_create_workspace @code = 'x'';DROP', @name = N'x';
    PRINT N'C3 FAIL - chap nhan chuoi chua dau nhay don';
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() = 50001 PRINT N'C3 PASS - chuoi chen SQL bi tu choi';
    ELSE PRINT N'C3 FAIL - loi khac du kien: ' + ERROR_MESSAGE();
END CATCH;
GO

-- C4: ma qua ngan (1 ky tu) -> loi 50001
BEGIN TRY
    EXEC platform.sp_create_workspace @code = 'a', @name = N'x';
    PRINT N'C4 FAIL - chap nhan ma qua ngan';
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() = 50001 PRINT N'C4 PASS - ma qua ngan bi tu choi';
    ELSE PRINT N'C4 FAIL - loi khac du kien: ' + ERROR_MESSAGE();
END CATCH;
GO

-- C5: ma NULL -> loi 50001
BEGIN TRY
    EXEC platform.sp_create_workspace @code = NULL, @name = N'x';
    PRINT N'C5 FAIL - chap nhan ma NULL';
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() = 50001 PRINT N'C5 PASS - ma NULL bi tu choi';
    ELSE PRINT N'C5 FAIL - loi khac du kien: ' + ERROR_MESSAGE();
END CATCH;
GO

-- C6: ma da ton tai (demo) -> loi 50002
BEGIN TRY
    EXEC platform.sp_create_workspace @code = 'demo', @name = N'x';
    PRINT N'C6 FAIL - cho tao trung workspace';
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() = 50002 PRINT N'C6 PASS - ma trung bi tu choi';
    ELSE PRINT N'C6 FAIL - loi khac du kien: ' + ERROR_MESSAGE();
END CATCH;
GO

-- C7: tao thanh cong -> co dong workspace, schema, role va quyen SELECT tren schema
BEGIN TRY
    EXEC platform.sp_create_workspace @code = 'tmp_test', @name = N'Tenant tam de test';
    IF SCHEMA_ID(N'ws_tmp_test') IS NOT NULL
       AND DATABASE_PRINCIPAL_ID(N'role_ws_tmp_test') IS NOT NULL
       AND EXISTS (SELECT 1 FROM platform.workspace
                   WHERE code = 'tmp_test' AND schema_name = N'ws_tmp_test' AND status = 'active')
       AND EXISTS (SELECT 1 FROM sys.database_permissions p
                   WHERE p.grantee_principal_id = DATABASE_PRINCIPAL_ID(N'role_ws_tmp_test')
                     AND p.class_desc = 'SCHEMA' AND p.permission_name = 'SELECT' AND p.state = 'G')
        PRINT N'C7 PASS - tao workspace day du (dong workspace, schema, role, quyen)';
    ELSE
        PRINT N'C7 FAIL - tao workspace thieu schema, role, quyen hoac dong workspace';
END TRY
BEGIN CATCH
    PRINT N'C7 FAIL - ' + ERROR_MESSAGE();
END CATCH;
GO

-- Don dep
IF DATABASE_PRINCIPAL_ID(N'role_ws_tmp_test') IS NOT NULL DROP ROLE role_ws_tmp_test;
IF SCHEMA_ID(N'ws_tmp_test') IS NOT NULL DROP SCHEMA ws_tmp_test;
DELETE FROM platform.workspace WHERE code = 'tmp_test';
GO
PRINT N'Hoan tat test 02_create_workspace';
GO
