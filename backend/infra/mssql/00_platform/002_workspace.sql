-- Bang workspace (tenant) nam o schema dung chung `platform`, KHONG nam trong schema cua tenant.
USE livingdocs;
GO

IF OBJECT_ID(N'platform.workspace', N'U') IS NULL
CREATE TABLE platform.workspace (
    id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_workspace_id         DEFAULT NEWSEQUENTIALID(),
    code        VARCHAR(30)      NOT NULL,   -- vi du: demo -> schema ws_demo
    name        NVARCHAR(200)    NOT NULL,
    schema_name SYSNAME          NOT NULL,
    config      NVARCHAR(MAX)    NULL,       -- JSON, vi du {"audit_retention_days": 365}
    status      VARCHAR(20)      NOT NULL CONSTRAINT df_workspace_status     DEFAULT 'active',
    created_at  DATETIME2(3)     NOT NULL CONSTRAINT df_workspace_created_at DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2(3)     NOT NULL CONSTRAINT df_workspace_updated_at DEFAULT SYSUTCDATETIME(),
    row_version ROWVERSION       NOT NULL,
    CONSTRAINT pk_workspace        PRIMARY KEY (id),
    CONSTRAINT uq_workspace_code   UNIQUE (code),
    CONSTRAINT uq_workspace_schema UNIQUE (schema_name),
    CONSTRAINT ck_workspace_status CHECK (status IN ('active', 'suspended', 'archived')),
    CONSTRAINT ck_workspace_config CHECK (config IS NULL OR ISJSON(config) = 1),
    -- code chi gom a-z, 0-9, dau gach duoi (so sanh nhi phan de khong lot ky tu co dau)
    CONSTRAINT ck_workspace_code   CHECK (LEN(code) >= 2 AND code COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-z0-9_]%')
);
GO

PRINT N'OK: bang platform.workspace';
GO
