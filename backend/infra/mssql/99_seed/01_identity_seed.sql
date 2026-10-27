-- Du lieu mau cho tenant. Bien: SchemaName. Chay mot lan sau khi tao bang.
-- Chi dung du lieu khong dau trong seed de tranh loi ma hoa khi chay bang sqlcmd.

-- 10 user: moi vai tro 2 nguoi. password_hash la chuoi gia, KHONG dung dang nhap that.
INSERT INTO [$(SchemaName)].app_user (email, display_name, password_hash) VALUES
    (N'developer1@example.com', N'Developer Mot', 'SEED_ONLY_NOT_A_REAL_HASH'),
    (N'developer2@example.com', N'Developer Hai', 'SEED_ONLY_NOT_A_REAL_HASH'),
    (N'staff1@example.com',     N'Staff Mot',     'SEED_ONLY_NOT_A_REAL_HASH'),
    (N'staff2@example.com',     N'Staff Hai',     'SEED_ONLY_NOT_A_REAL_HASH'),
    (N'manager1@example.com',   N'Manager Mot',   'SEED_ONLY_NOT_A_REAL_HASH'),
    (N'manager2@example.com',   N'Manager Hai',   'SEED_ONLY_NOT_A_REAL_HASH'),
    (N'techlead1@example.com',  N'TechLead Mot',  'SEED_ONLY_NOT_A_REAL_HASH'),
    (N'techlead2@example.com',  N'TechLead Hai',  'SEED_ONLY_NOT_A_REAL_HASH'),
    (N'admin1@example.com',     N'Admin Mot',     'SEED_ONLY_NOT_A_REAL_HASH'),
    (N'admin2@example.com',     N'Admin Hai',     'SEED_ONLY_NOT_A_REAL_HASH');
GO

-- Moi user mot vai tro ap dung cho ca workspace, nguoi cap quyen la admin1
INSERT INTO [$(SchemaName)].role_assignment (user_id, [role], scope_type, scope_id, granted_by)
SELECT u.id, v.[role], 'workspace', NULL, a.id
FROM (VALUES
        (N'developer1@example.com', N'Developer'),     (N'developer2@example.com', N'Developer'),
        (N'staff1@example.com',     N'Staff'),         (N'staff2@example.com',     N'Staff'),
        (N'manager1@example.com',   N'Manager'),       (N'manager2@example.com',   N'Manager'),
        (N'techlead1@example.com',  N'TechLead'),      (N'techlead2@example.com',  N'TechLead'),
        (N'admin1@example.com',     N'Administrator'), (N'admin2@example.com',     N'Administrator')
     ) AS v (email, [role])
JOIN [$(SchemaName)].app_user u ON u.email = v.email
CROSS JOIN (SELECT id FROM [$(SchemaName)].app_user WHERE email = N'admin1@example.com') AS a;
GO

-- 20 thong bao: moi user nhan 1 thong bao trong ung dung va 1 thong bao Slack
INSERT INTO [$(SchemaName)].notification (recipient_user_id, channel, event_type, payload, status)
SELECT u.id, c.channel, 'welcome', N'{"message":"Chao mung den LivingDocs"}', 'sent'
FROM [$(SchemaName)].app_user u
CROSS JOIN (VALUES ('in_app'), ('slack')) AS c (channel);
GO

-- 10 dong audit_log: ghi lai viec tao user
INSERT INTO [$(SchemaName)].audit_log ([action], actor_type, entity_type, entity_id, detail)
SELECT 'user.created', 'system', 'app_user', id, N'{"source":"seed"}'
FROM [$(SchemaName)].app_user;
GO

PRINT N'OK: seed 01_identity cho schema $(SchemaName)';
GO
