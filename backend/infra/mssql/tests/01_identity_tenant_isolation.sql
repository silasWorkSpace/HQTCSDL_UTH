-- Kiem tra phan quyen: role cua tenant demo khong doc duoc tenant acme,
-- khong sua/xoa duoc audit_log, va job don audit_log hoat dong.
-- Yeu cau: da tao tenant demo va acme, da seed.
SET NOCOUNT ON;
GO

IF USER_ID(N'test_demo') IS NOT NULL DROP USER test_demo;
CREATE USER test_demo WITHOUT LOGIN;
ALTER ROLE role_ws_demo ADD MEMBER test_demo;
GO

-- T1: doc du lieu tenant cua minh -> phai thanh cong
BEGIN TRY
    DECLARE @n INT;
    EXECUTE AS USER = N'test_demo';
    SELECT @n = COUNT(*) FROM ws_demo.app_user;
    REVERT;
    PRINT N'T1 PASS - doc duoc tenant cua minh (' + CAST(@n AS NVARCHAR(10)) + N' user)';
END TRY
BEGIN CATCH
    IF USER_NAME() = N'test_demo' REVERT;
    PRINT N'T1 FAIL - ' + ERROR_MESSAGE();
END CATCH;
GO

-- T2: doc du lieu tenant khac -> phai bi tu choi (loi 229)
BEGIN TRY
    DECLARE @n INT;
    EXECUTE AS USER = N'test_demo';
    SELECT @n = COUNT(*) FROM ws_acme.app_user;
    REVERT;
    PRINT N'T2 FAIL - doc duoc du lieu tenant khac!';
END TRY
BEGIN CATCH
    IF USER_NAME() = N'test_demo' REVERT;
    IF ERROR_NUMBER() = 229 PRINT N'T2 PASS - doc tenant khac bi tu choi';
    ELSE PRINT N'T2 FAIL - loi khac du kien: ' + ERROR_MESSAGE();
END CATCH;
GO

-- T3: ghi them audit_log -> phai thanh cong
BEGIN TRY
    EXECUTE AS USER = N'test_demo';
    INSERT INTO ws_demo.audit_log ([action], actor_type, entity_type) VALUES ('test.insert', 'system', 'test');
    REVERT;
    PRINT N'T3 PASS - them dong audit_log duoc';
END TRY
BEGIN CATCH
    IF USER_NAME() = N'test_demo' REVERT;
    PRINT N'T3 FAIL - ' + ERROR_MESSAGE();
END CATCH;
GO

-- T4: sua audit_log -> phai bi tu choi
BEGIN TRY
    EXECUTE AS USER = N'test_demo';
    UPDATE ws_demo.audit_log SET [action] = 'hacked';
    REVERT;
    PRINT N'T4 FAIL - sua duoc audit_log!';
END TRY
BEGIN CATCH
    IF USER_NAME() = N'test_demo' REVERT;
    IF ERROR_NUMBER() = 229 PRINT N'T4 PASS - sua audit_log bi tu choi';
    ELSE PRINT N'T4 FAIL - loi khac du kien: ' + ERROR_MESSAGE();
END CATCH;
GO

-- T5: xoa audit_log -> phai bi tu choi
BEGIN TRY
    EXECUTE AS USER = N'test_demo';
    DELETE FROM ws_demo.audit_log;
    REVERT;
    PRINT N'T5 FAIL - xoa duoc audit_log!';
END TRY
BEGIN CATCH
    IF USER_NAME() = N'test_demo' REVERT;
    IF ERROR_NUMBER() = 229 PRINT N'T5 PASS - xoa audit_log bi tu choi';
    ELSE PRINT N'T5 FAIL - loi khac du kien: ' + ERROR_MESSAGE();
END CATCH;
GO

-- T6: procedure don audit_log (chay bang quyen dbo) xoa dong het han nhung giu dong con han
INSERT INTO ws_demo.audit_log ([action], actor_type, entity_type, retention_until)
VALUES ('test.expired', 'system', 'test', DATEADD(DAY, -1, SYSUTCDATETIME()));
EXEC platform.sp_purge_expired_audit_log;
IF NOT EXISTS (SELECT 1 FROM ws_demo.audit_log WHERE [action] = 'test.expired')
   AND EXISTS (SELECT 1 FROM ws_demo.audit_log WHERE [action] = 'test.insert')
    PRINT N'T6 PASS - don audit_log het han dung';
ELSE
    PRINT N'T6 FAIL - procedure don audit_log chay sai';
GO

-- Don dep
DELETE FROM ws_demo.audit_log WHERE [action] LIKE 'test.%';
DROP USER test_demo;
GO
PRINT N'Hoan tat test 01_identity';
GO
