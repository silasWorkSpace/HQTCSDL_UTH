-- File: 007_review_comment.sql
-- Mô tả: Tạo bảng review_comment lưu trữ các bình luận góp ý trong quá trình review tài liệu

IF OBJECT_ID(N'review_comment', N'U') IS NULL
BEGIN
    CREATE TABLE review_comment (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
        review_task_id UNIQUEIDENTIFIER NOT NULL,
        user_id UNIQUEIDENTIFIER NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        line_number INT NULL,
        created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        row_version ROWVERSION,
        CONSTRAINT fk_review_comment_task FOREIGN KEY (review_task_id) REFERENCES review_task(id) ON DELETE CASCADE
    );
END;
GO
