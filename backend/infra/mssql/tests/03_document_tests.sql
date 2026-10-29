SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

DECLARE @repo UNIQUEIDENTIFIER = (SELECT TOP (1) id FROM [$(SchemaName)].[repository] ORDER BY created_at);
DECLARE @usr  UNIQUEIDENTIFIER = (SELECT TOP (1) id FROM [$(SchemaName)].[app_user]  ORDER BY created_at);
IF @repo IS NULL OR @usr IS NULL
    THROW 59000, N'Can it nhat 1 repository va 1 app_user. Chay seed cua cac module khac truoc.', 1;

DECLARE @doc UNIQUEIDENTIFIER, @v1 UNIQUEIDENTIFIER, @v UNIQUEIDENTIFIER, @n INT;
DECLARE @valid BIT, @review BIT, @ok BIT, @cnt INT, @st VARCHAR(30), @txt NVARCHAR(MAX);
DECLARE @err NVARCHAR(2000) = NULL;
DECLARE @path NVARCHAR(450) = N'tests/__ld_test__' + CONVERT(NVARCHAR(36), NEWID()) + N'.md';

BEGIN TRY
    /* T1: tạo document + version 1 */
    EXEC [$(SchemaName)].[sp_create_document]
        @repository_id = @repo, @doc_type = 'README', @title = N'Tai lieu test', @path_in_repo = @path,
        @owner_id = @usr, @content = N'v1', @actor_role = 'Developer', @actor_user_id = @usr,
        @change_source = 'MANUAL_EDIT', @document_id = @doc OUTPUT, @version_id = @v1 OUTPUT;
    IF NOT EXISTS (SELECT 1 FROM [$(SchemaName)].[document_version]
                    WHERE id = @v1 AND version_no = 1 AND prev_hash IS NULL AND status_at_version = 'DRAFT')
        THROW 59001, N'FAIL T1: version 1 sai.', 1;
    IF (SELECT current_version_id FROM [$(SchemaName)].[document] WHERE id = @doc) <> @v1
        THROW 59001, N'FAIL T1: current_version_id sai.', 1;
    PRINT N'PASS T1 tao document + version 1';

    /* T2: append v2, v3 (v3 được duyệt), chuỗi hash nối đúng */
    EXEC [$(SchemaName)].[sp_append_document_version] @document_id = @doc, @content = N'v2',
        @actor_role = 'AI', @change_source = 'AUTO_UPDATE', @source_pr_number = 12, @source_pr_kind = 'SOURCE',
        @version_no = @n OUTPUT;
    IF @n <> 2 THROW 59002, N'FAIL T2: version_no phai la 2.', 1;
    EXEC [$(SchemaName)].[sp_append_document_version] @document_id = @doc, @content = N'v3 approved',
        @actor_role = 'Manager', @actor_user_id = @usr, @change_source = 'REVIEW_ACTION',
        @status_at_version = 'APPROVED', @version_no = @n OUTPUT;
    IF @n <> 3 THROW 59002, N'FAIL T2: version_no phai la 3.', 1;
    IF EXISTS (SELECT 1 FROM [$(SchemaName)].[document_version] a
                 JOIN [$(SchemaName)].[document_version] b ON b.document_id = a.document_id AND b.version_no = a.version_no + 1
                WHERE a.document_id = @doc AND b.prev_hash <> a.hash)
        THROW 59002, N'FAIL T2: prev_hash khong khop hash truoc.', 1;
    PRINT N'PASS T2 append version, chuoi hash noi dung';

    /* T3: verify sạch */
    EXEC [$(SchemaName)].[sp_verify_version_chain] @document_id = @doc, @is_valid = @valid OUTPUT;
    IF @valid <> 1 THROW 59003, N'FAIL T3: chuoi sach nhung bao loi.', 1;
    PRINT N'PASS T3 verify chuoi sach';

    /* T4: UPDATE trực tiếp bị chặn */
    SET @ok = 0;
    BEGIN TRY
        UPDATE [$(SchemaName)].[document_version] SET content = N'hack' WHERE document_id = @doc AND version_no = 2;
    END TRY
    BEGIN CATCH
        SET @ok = IIF(ERROR_NUMBER() = 50010, 1, 0);
    END CATCH
    IF @ok = 0 THROW 59004, N'FAIL T4: UPDATE khong bi chan.', 1;
    PRINT N'PASS T4 UPDATE document_version bi chan';

    /* T5: DELETE bị chặn */
    SET @ok = 0;
    BEGIN TRY
        DELETE FROM [$(SchemaName)].[document_version] WHERE document_id = @doc AND version_no = 1;
    END TRY
    BEGIN CATCH
        SET @ok = IIF(ERROR_NUMBER() = 50011, 1, 0);
    END CATCH
    IF @ok = 0 THROW 59005, N'FAIL T5: DELETE khong bi chan.', 1;
    PRINT N'PASS T5 DELETE document_version bi chan';

    /* T6: rollback về v1 (chưa từng duyệt) -> phải qua duyệt */
    EXEC [$(SchemaName)].[sp_rollback_document] @document_id = @doc, @target_version_no = 1,
        @actor_role = 'Developer', @actor_user_id = @usr, @reason = N'test rollback v1',
        @new_version_no = @n OUTPUT, @requires_review = @review OUTPUT;
    SELECT @st = doc_status FROM [$(SchemaName)].[document] WHERE id = @doc;
    SELECT @txt = content FROM [$(SchemaName)].[document_version] WHERE document_id = @doc AND version_no = @n;
    IF @n <> 4 OR @review <> 1 OR @st <> 'IN_REVIEW_STAFF' OR @txt <> N'v1'
        THROW 59006, N'FAIL T6: rollback ban chua duyet sai.', 1;
    PRINT N'PASS T6 rollback ban chua duyet -> IN_REVIEW_STAFF';

    /* T7: rollback về v3 (từng APPROVED) -> hiệu lực ngay */
    EXEC [$(SchemaName)].[sp_rollback_document] @document_id = @doc, @target_version_no = 3,
        @actor_role = 'Manager', @actor_user_id = @usr, @reason = N'test rollback v3',
        @new_version_no = @n OUTPUT, @requires_review = @review OUTPUT;
    SELECT @st = doc_status FROM [$(SchemaName)].[document] WHERE id = @doc;
    IF @n <> 5 OR @review <> 0 OR @st <> 'APPROVED'
        THROW 59007, N'FAIL T7: rollback ban da duyet sai.', 1;
    IF (SELECT COUNT(*) FROM [$(SchemaName)].[document_version] WHERE document_id = @doc) <> 5
        THROW 59007, N'FAIL T7: lich su bi mat.', 1;
    PRINT N'PASS T7 rollback ban da duyet -> APPROVED, lich su con nguyen';

    /* T8: Administrator không được rollback; thiếu lý do bị từ chối */
    SET @ok = 0;
    BEGIN TRY
        EXEC [$(SchemaName)].[sp_rollback_document] @document_id = @doc, @target_version_no = 1,
            @actor_role = 'Administrator', @reason = N'x';
    END TRY
    BEGIN CATCH
        SET @ok = IIF(ERROR_NUMBER() = 50026, 1, 0);
    END CATCH
    IF @ok = 0 THROW 59008, N'FAIL T8: Administrator duoc rollback.', 1;
    SET @ok = 0;
    BEGIN TRY
        EXEC [$(SchemaName)].[sp_rollback_document] @document_id = @doc, @target_version_no = 1,
            @actor_role = 'Developer', @reason = N'   ';
    END TRY
    BEGIN CATCH
        SET @ok = IIF(ERROR_NUMBER() = 50023, 1, 0);
    END CATCH
    IF @ok = 0 THROW 59008, N'FAIL T8: rollback khong ly do van duoc.', 1;
    PRINT N'PASS T8 kiem tra vai tro va ly do rollback';

    /* T9: verify vẫn sạch sau rollback */
    EXEC [$(SchemaName)].[sp_verify_version_chain] @document_id = @doc, @is_valid = @valid OUTPUT;
    IF @valid <> 1 THROW 59009, N'FAIL T9: chuoi hong sau rollback.', 1;
    PRINT N'PASS T9 chuoi sach sau rollback';

    /* T10: che nội dung, chuỗi hash vẫn xác minh được */
    EXEC [$(SchemaName)].[sp_redact_document_content] @document_id = @doc, @redacted_by = @usr, @redacted_count = @cnt OUTPUT;
    IF @cnt <> 5 THROW 59010, N'FAIL T10: so version bi che sai.', 1;
    IF EXISTS (SELECT 1 FROM [$(SchemaName)].[document_version]
                WHERE document_id = @doc AND (content IS NOT NULL OR content_redacted = 0 OR reason IS NOT NULL))
        THROW 59010, N'FAIL T10: con noi dung chua che.', 1;
    EXEC [$(SchemaName)].[sp_verify_version_chain] @document_id = @doc, @is_valid = @valid OUTPUT;
    IF @valid <> 1 THROW 59010, N'FAIL T10: che noi dung lam gay chuoi hash.', 1;
    SET @ok = 0;   -- không rollback được về bản đã che
    BEGIN TRY
        EXEC [$(SchemaName)].[sp_rollback_document] @document_id = @doc, @target_version_no = 1,
            @actor_role = 'Developer', @reason = N'x';
    END TRY
    BEGIN CATCH
        SET @ok = IIF(ERROR_NUMBER() = 50025, 1, 0);
    END CATCH
    IF @ok = 0 THROW 59010, N'FAIL T10: rollback ve ban da che van duoc.', 1;
    PRINT N'PASS T10 che noi dung, chuoi hash van xac minh duoc';

    /* T11: giả lập can thiệp (tắt trigger, sửa metadata) -> verify phải phát hiện */
    DISABLE TRIGGER ALL ON [$(SchemaName)].[document_version];
    UPDATE [$(SchemaName)].[document_version] SET actor_role = 'Manager' WHERE document_id = @doc AND version_no = 2;
    ENABLE TRIGGER ALL ON [$(SchemaName)].[document_version];
    DECLARE @res TABLE (document_version_id UNIQUEIDENTIFIER, version_no INT, problem VARCHAR(20));
    INSERT INTO @res EXEC [$(SchemaName)].[sp_verify_version_chain] @document_id = @doc;
    IF NOT EXISTS (SELECT 1 FROM @res WHERE version_no = 2 AND problem = 'HASH_MISMATCH')
        THROW 59011, N'FAIL T11: khong phat hien ban ghi bi sua.', 1;
    PRINT N'PASS T11 phat hien ban ghi bi can thiep (version 2)';
END TRY
BEGIN CATCH
    SET @err = ERROR_MESSAGE();
END CATCH

/* ---------- Dọn dữ liệu test (luôn chạy) ---------- */
IF OBJECT_ID(N'[$(SchemaName)].[document_version]', N'U') IS NOT NULL
    ENABLE TRIGGER ALL ON [$(SchemaName)].[document_version];
IF @doc IS NOT NULL
BEGIN
    DISABLE TRIGGER ALL ON [$(SchemaName)].[document_version];
    UPDATE [$(SchemaName)].[document] SET current_version_id = NULL, published_version_id = NULL WHERE id = @doc;
    DELETE FROM [$(SchemaName)].[document_version] WHERE document_id = @doc;
    DELETE FROM [$(SchemaName)].[document] WHERE id = @doc;
    ENABLE TRIGGER ALL ON [$(SchemaName)].[document_version];
END

IF @err IS NOT NULL
    THROW 59999, @err, 1;
PRINT N'==== TAT CA TEST 03_document DAT ====';
GO

/* =============================================================================
   TEST CONCURRENCY THỦ CÔNG (cần 2 cửa sổ SSMS/sqlcmd, thay @doc bằng id document có sẵn)
   Session A:
     BEGIN TRAN;
     DECLARE @n INT;
     EXEC [$(SchemaName)].sp_append_document_version @document_id='<id>', @content=N'A',
          @actor_role='AI', @change_source='AUTO_UPDATE', @version_no=@n OUTPUT;
     SELECT @n;            -- chưa COMMIT
   Session B (chạy ngay sau đó):
     DECLARE @n INT;
     EXEC [$(SchemaName)].sp_append_document_version @document_id='<id>', @content=N'B',
          @actor_role='AI', @change_source='AUTO_UPDATE', @version_no=@n OUTPUT;
     SELECT @n;            -- phải BỊ CHỜ (blocked)
   Session A: COMMIT;  -> Session B chạy tiếp và nhận version_no = (A + 1), không trùng, không lỗi unique.
   Sau đó chạy sp_verify_version_chain: phải sạch.
   ============================================================================= */
