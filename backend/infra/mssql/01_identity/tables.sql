-- Module Nguoi 1: dinh danh va nen tang. Chay cho TUNG tenant, bien: SchemaName (vi du ws_demo).
-- Role cua tenant (role_<SchemaName>) da duoc tao boi platform.sp_create_workspace.

-- ===================== app_user =====================
-- Dung ten app_user vi `user` la tu khoa cua SQL Server.
CREATE TABLE [$(SchemaName)].app_user (
    id                 UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_app_user_id         DEFAULT NEWSEQUENTIALID(),
    email              NVARCHAR(256)    NOT NULL,
    display_name       NVARCHAR(200)    NOT NULL,
    password_hash      VARCHAR(255)     NULL,       -- chuoi hash (bcrypt/argon2); NULL neu chi dang nhap OIDC
    oidc_provider      VARCHAR(50)      NULL,
    oidc_subject       NVARCHAR(200)    NULL,
    github_user_id     BIGINT           NULL,
    status             VARCHAR(20)      NOT NULL CONSTRAINT df_app_user_status     DEFAULT 'active',
    [language]         VARCHAR(10)      NOT NULL CONSTRAINT df_app_user_language   DEFAULT 'vi',
    notification_prefs NVARCHAR(MAX)    NULL,       -- JSON
    last_login_at      DATETIME2(3)     NULL,
    created_at         DATETIME2(3)     NOT NULL CONSTRAINT df_app_user_created_at DEFAULT SYSUTCDATETIME(),
    created_by         UNIQUEIDENTIFIER NULL,
    updated_at         DATETIME2(3)     NOT NULL CONSTRAINT df_app_user_updated_at DEFAULT SYSUTCDATETIME(),
    updated_by         UNIQUEIDENTIFIER NULL,
    row_version        ROWVERSION       NOT NULL,
    CONSTRAINT pk_app_user              PRIMARY KEY (id),
    CONSTRAINT uq_app_user_email        UNIQUE (email),
    CONSTRAINT ck_app_user_status       CHECK (status IN ('active', 'locked', 'disabled')),
    CONSTRAINT ck_app_user_language     CHECK ([language] IN ('vi', 'en')),
    CONSTRAINT ck_app_user_login_method CHECK (password_hash IS NOT NULL OR oidc_subject IS NOT NULL),
    CONSTRAINT ck_app_user_prefs        CHECK (notification_prefs IS NULL OR ISJSON(notification_prefs) = 1)
);
GO

-- Moi tai khoan OIDC / GitHub chi gan voi mot user
CREATE UNIQUE INDEX uq_app_user_oidc   ON [$(SchemaName)].app_user (oidc_provider, oidc_subject) WHERE oidc_subject IS NOT NULL;
CREATE UNIQUE INDEX uq_app_user_github ON [$(SchemaName)].app_user (github_user_id)              WHERE github_user_id IS NOT NULL;
GO

-- ===================== role_assignment =====================
-- 5 vai tro: Developer, Staff, Manager, TechLead, Administrator.
-- scope_id = NULL khi vai tro ap dung cho ca workspace.
CREATE TABLE [$(SchemaName)].role_assignment (
    id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_role_assignment_id         DEFAULT NEWSEQUENTIALID(),
    user_id     UNIQUEIDENTIFIER NOT NULL,
    [role]      VARCHAR(20)      NOT NULL,
    scope_type  VARCHAR(20)      NOT NULL CONSTRAINT df_role_assignment_scope_type DEFAULT 'workspace',
    scope_id    UNIQUEIDENTIFIER NULL,
    granted_by  UNIQUEIDENTIFIER NULL,
    created_at  DATETIME2(3)     NOT NULL CONSTRAINT df_role_assignment_created_at DEFAULT SYSUTCDATETIME(),
    created_by  UNIQUEIDENTIFIER NULL,
    updated_at  DATETIME2(3)     NOT NULL CONSTRAINT df_role_assignment_updated_at DEFAULT SYSUTCDATETIME(),
    updated_by  UNIQUEIDENTIFIER NULL,
    row_version ROWVERSION       NOT NULL,
    CONSTRAINT pk_role_assignment            PRIMARY KEY (id),
    CONSTRAINT fk_role_assignment_user       FOREIGN KEY (user_id)    REFERENCES [$(SchemaName)].app_user (id),
    CONSTRAINT fk_role_assignment_granted_by FOREIGN KEY (granted_by) REFERENCES [$(SchemaName)].app_user (id),
    CONSTRAINT uq_role_assignment            UNIQUE (user_id, [role], scope_type, scope_id),
    CONSTRAINT ck_role_assignment_role       CHECK ([role] IN ('Developer', 'Staff', 'Manager', 'TechLead', 'Administrator')),
    CONSTRAINT ck_role_assignment_scope_type CHECK (scope_type IN ('workspace', 'repository', 'module', 'document')),
    CONSTRAINT ck_role_assignment_scope      CHECK ((scope_type = 'workspace' AND scope_id IS NULL)
                                                 OR (scope_type <> 'workspace' AND scope_id IS NOT NULL))
);
GO

CREATE INDEX ix_role_assignment_user ON [$(SchemaName)].role_assignment (user_id);
GO

-- ===================== notification =====================
CREATE TABLE [$(SchemaName)].notification (
    id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_notification_id         DEFAULT NEWSEQUENTIALID(),
    recipient_user_id UNIQUEIDENTIFIER NOT NULL,
    channel           VARCHAR(20)      NOT NULL,
    event_type        VARCHAR(50)      NOT NULL,
    payload           NVARCHAR(MAX)    NOT NULL CONSTRAINT df_notification_payload    DEFAULT N'{}',
    status            VARCHAR(20)      NOT NULL CONSTRAINT df_notification_status     DEFAULT 'pending',
    read_at           DATETIME2(3)     NULL,
    sent_at           DATETIME2(3)     NULL,
    correlation_id    UNIQUEIDENTIFIER NULL,
    created_at        DATETIME2(3)     NOT NULL CONSTRAINT df_notification_created_at DEFAULT SYSUTCDATETIME(),
    updated_at        DATETIME2(3)     NOT NULL CONSTRAINT df_notification_updated_at DEFAULT SYSUTCDATETIME(),
    row_version       ROWVERSION       NOT NULL,
    CONSTRAINT pk_notification           PRIMARY KEY (id),
    CONSTRAINT fk_notification_recipient FOREIGN KEY (recipient_user_id) REFERENCES [$(SchemaName)].app_user (id),
    CONSTRAINT ck_notification_channel   CHECK (channel IN ('in_app', 'slack')),
    CONSTRAINT ck_notification_status    CHECK (status IN ('pending', 'sent', 'failed')),
    CONSTRAINT ck_notification_payload   CHECK (ISJSON(payload) = 1)
);
GO

-- Truy van "thong bao chua doc cua toi" chay rat thuong xuyen
CREATE INDEX ix_notification_recipient_unread ON [$(SchemaName)].notification (recipient_user_id, read_at) INCLUDE (created_at);
GO

-- ===================== audit_log =====================
-- Chi INSERT. Role cua ung dung bi DENY UPDATE/DELETE o cuoi file nay.
CREATE TABLE [$(SchemaName)].audit_log (
    id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_audit_log_id          DEFAULT NEWSEQUENTIALID(),
    [action]        VARCHAR(100)     NOT NULL,
    actor_type      VARCHAR(10)      NOT NULL,
    actor_id        UNIQUEIDENTIFIER NULL,
    actor_role      VARCHAR(20)      NULL,
    entity_type     VARCHAR(50)      NOT NULL,
    entity_id       UNIQUEIDENTIFIER NULL,
    correlation_id  UNIQUEIDENTIFIER NULL,
    detail          NVARCHAR(MAX)    NULL,           -- JSON, TUYET DOI khong chua token/mat khau (NFR-DATA-03)
    occurred_at     DATETIME2(3)     NOT NULL CONSTRAINT df_audit_log_occurred_at DEFAULT SYSUTCDATETIME(),
    retention_until DATETIME2(3)     NOT NULL CONSTRAINT df_audit_log_retention   DEFAULT DATEADD(DAY, 365, SYSUTCDATETIME()),
    CONSTRAINT pk_audit_log            PRIMARY KEY (id),
    CONSTRAINT ck_audit_log_actor_type CHECK (actor_type IN ('ai', 'user', 'system')),
    CONSTRAINT ck_audit_log_actor      CHECK (actor_type <> 'user' OR actor_id IS NOT NULL),
    CONSTRAINT ck_audit_log_detail     CHECK (detail IS NULL OR ISJSON(detail) = 1)
);
GO

CREATE INDEX ix_audit_log_entity    ON [$(SchemaName)].audit_log (entity_type, entity_id, occurred_at);
CREATE INDEX ix_audit_log_actor     ON [$(SchemaName)].audit_log (actor_id, occurred_at);
CREATE INDEX ix_audit_log_retention ON [$(SchemaName)].audit_log (retention_until);
GO

-- audit_log bat bien: ung dung chi duoc them dong moi
DENY UPDATE, DELETE ON [$(SchemaName)].audit_log TO [role_$(SchemaName)];
GO

PRINT N'OK: 01_identity tables.sql cho schema $(SchemaName)';
GO
