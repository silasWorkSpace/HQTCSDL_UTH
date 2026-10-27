-- Backup full thu cong, sau do kiem tra file backup doc duoc va khong hong.
BACKUP DATABASE livingdocs
    TO DISK = N'/var/opt/mssql/data/livingdocs_manual.bak'
    WITH COMPRESSION, CHECKSUM, INIT, STATS = 25;
GO

RESTORE VERIFYONLY FROM DISK = N'/var/opt/mssql/data/livingdocs_manual.bak' WITH CHECKSUM;
GO
