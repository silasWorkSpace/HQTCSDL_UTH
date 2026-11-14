-- File: 004_review_task_and_decision.sql
-- Mô tả: Tạo các bảng review_task và review_decision phục vụ quy trình phê duyệt tài liệu[cite: 1]

CREATE TABLE review_task (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    document_id UNIQUEIDENTIFIER NOT NULL,
    document_version_id UNIQUEIDENTIFIER NOT NULL,
    level VARCHAR(50) NOT NULL CHECK (level IN ('Staff', 'Manager')),
    submitter_id UNIQUEIDENTIFIER NOT NULL,
    assignee_id UNIQUEIDENTIFIER NULL,
    status VARCHAR(50) NOT NULL,
    created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    row_version ROWVERSION
);

CREATE TABLE review_decision (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    review_task_id UNIQUEIDENTIFIER NOT NULL,
    reviewer_id UNIQUEIDENTIFIER NOT NULL,
    decision VARCHAR(50) NOT NULL,
    reason NVARCHAR(MAX) NULL,
    decided_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    row_version ROWVERSION,
    CONSTRAINT fk_review_decision_task FOREIGN KEY (review_task_id) REFERENCES review_task(id)
);