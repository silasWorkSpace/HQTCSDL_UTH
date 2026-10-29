<#
Tien ich cho database LivingDocs (SQL Server chay trong Docker).
Chay tu thu muc backend\infra:

  .\db.ps1 up                              Bat SQL Server
  .\db.ps1 init                            Tao database, schema platform, procedure, job
  .\db.ps1 tenant -Code demo -Name "Demo"  Tao workspace moi va toan bo bang cua moi module
  .\db.ps1 seed -Code demo                 Nap du lieu mau cho workspace
  .\db.ps1 test                            Chay moi file trong mssql\tests
  .\db.ps1 backup                          Backup full roi copy ra backend\infra\backup
  .\db.ps1 restore-test                    Restore ra database tam de kiem tra va do thoi gian
  .\db.ps1 rebuild                         Xoa sach roi dung lai tu dau (reset, init, 2 tenant, seed, test)
  .\db.ps1 reset | down | shell
#>
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("up", "down", "reset", "init", "tenant", "seed", "test", "backup", "restore-test", "rebuild", "shell")]
    [string]$Cmd,

    [ValidatePattern('^[a-z0-9_]{2,30}$')]
    [string]$Code = "demo",

    [string]$Name = "Demo Workspace"
)

$ErrorActionPreference = "Continue"
$infra     = $PSScriptRoot
$mssqlDir  = Join-Path $infra "mssql"
$compose   = Join-Path $infra "docker\docker-compose.yml"
$container = "livingdocs-mssql"
$sqlcmd    = "/opt/mssql-tools18/bin/sqlcmd"

# Chay mot file .sql ben trong container. $File tinh tu thu muc mssql, dung dau /.
function Invoke-Sql {
    param([string]$File, [string]$Db = "livingdocs", [string[]]$Vars = @())
    $a = @("exec", $container, $sqlcmd, "-S", "localhost", "-U", "sa", "-C", "-I", "-b", "-f", "65001", "-d", $Db)
    foreach ($v in $Vars) { $a += @("-v", $v) }
    $a += @("-i", "/scripts/$File")
    Write-Host ">> $File" -ForegroundColor Cyan
    & docker @a
    if ($LASTEXITCODE -ne 0) { throw "Loi khi chay $File" }
}

function Wait-Healthy {
    Write-Host "Cho SQL Server khoi dong" -NoNewline
    for ($i = 0; $i -lt 60; $i++) {
        $s = docker inspect -f "{{.State.Health.Status}}" $container
        if ($s -eq "healthy") { Write-Host " xong." -ForegroundColor Green; return }
        Start-Sleep -Seconds 3
        Write-Host "." -NoNewline
    }
    throw "SQL Server khong len duoc. Xem log bang: docker logs $container"
}

function Start-Db {
    if (-not (Test-Path (Join-Path $infra "docker\.env"))) {
        throw "Chua co backend\infra\docker\.env. Hay copy tu .env.example roi dat mat khau."
    }
    docker compose -f $compose up -d
    if ($LASTEXITCODE -ne 0) { throw "docker compose up bi loi" }
    Wait-Healthy
}

function Reset-Db {
    docker compose -f $compose down -v
    if ($LASTEXITCODE -ne 0) { throw "docker compose down bi loi" }
    Start-Db
}

function Initialize-Db {
    Invoke-Sql "00_platform/001_create_database.sql" -Db master
    Invoke-Sql "00_platform/002_workspace.sql"
    Invoke-Sql "00_platform/003_sp_create_workspace.sql"
    Invoke-Sql "00_platform/004_sp_purge_expired_audit_log.sql"
    Invoke-Sql "00_platform/005_agent_jobs.sql" -Db master
}

# Thu muc module: 01_identity, 02_integration, 03_document, 04_workflow (theo thu tu phu thuoc)
function Get-ModuleDirs {
    Get-ChildItem $mssqlDir -Directory | Where-Object { $_.Name -match '^0[1-9]_' } | Sort-Object Name
}

function New-Tenant {
    param([string]$TenantCode, [string]$TenantName)
    $schema = "ws_$TenantCode"
    Invoke-Sql "00_platform/010_provision_tenant.sql" -Vars @("Code=$TenantCode", "TenantName=$TenantName")
    # Chay theo tung giai doan cho MOI module: tat ca bang truoc, roi index, procedure, trigger
    foreach ($phase in "tables.sql", "indexes.sql", "procedures.sql", "triggers.sql") {
        foreach ($dir in Get-ModuleDirs) {
            if (Test-Path (Join-Path $dir.FullName $phase)) {
                Invoke-Sql "$($dir.Name)/$phase" -Vars @("SchemaName=$schema")
            }
        }
    }
}

function Import-Seed {
    param([string]$TenantCode)
    $schema = "ws_$TenantCode"
    Get-ChildItem (Join-Path $mssqlDir "99_seed") -Filter *.sql | Sort-Object Name | ForEach-Object {
        Invoke-Sql "99_seed/$($_.Name)" -Vars @("SchemaName=$schema")
    }
}

function Invoke-Tests {
    Get-ChildItem (Join-Path $mssqlDir "tests") -Filter *.sql | Sort-Object Name | ForEach-Object {
        Invoke-Sql "tests/$($_.Name)"
    }
}

function Backup-Db {
    Invoke-Sql "00_platform/020_backup_full.sql" -Db master
    $dest = Join-Path $infra "backup"
    New-Item -ItemType Directory -Force $dest | Out-Null
    docker cp "${container}:/var/opt/mssql/data/livingdocs_manual.bak" (Join-Path $dest "livingdocs_manual.bak")
    if ($LASTEXITCODE -ne 0) { throw "docker cp bi loi" }
    Write-Host "Da copy file backup ra $dest" -ForegroundColor Green
}

function Test-Restore {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    Invoke-Sql "00_platform/021_restore_test.sql" -Db master
    $sw.Stop()
    Write-Host ("Thoi gian restore va kiem tra: {0:N1} giay (muc tieu RTO: 4 gio)" -f $sw.Elapsed.TotalSeconds) -ForegroundColor Yellow
}

switch ($Cmd) {
    "up"           { Start-Db }
    "down"         { docker compose -f $compose down }
    "reset"        { Reset-Db }
    "init"         { Initialize-Db }
    "tenant"       { New-Tenant $Code $Name }
    "seed"         { Import-Seed $Code }
    "test"         { Invoke-Tests }
    "backup"       { Backup-Db }
    "restore-test" { Test-Restore }
    "rebuild"      {
        Reset-Db
        Initialize-Db
        New-Tenant "demo" "Demo Workspace"
        New-Tenant "acme" "Acme Corp"
        Import-Seed "demo"
        Import-Seed "acme"
        Invoke-Tests
    }
    "shell"        { docker exec -it $container $sqlcmd -S localhost -U sa -C -d livingdocs }
}
