<#
Tien ich cho database LivingDocs (ho tro ca Docker va SQL Server local).
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

    [string]$Name = "Demo Workspace",

    [string]$Server = "",

    [switch]$Local
)

$ErrorActionPreference = "Continue"
$infra     = $PSScriptRoot
$mssqlDir  = Join-Path $infra "mssql"
$compose   = Join-Path $infra "docker\docker-compose.yml"
$container = "livingdocs-mssql"
$sqlcmd    = "/opt/mssql-tools18/bin/sqlcmd"

function Get-SqlRunner {
    if ($Local -or ($Server -ne "")) {
        return "local"
    }
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        return "local"
    }
    # Kiem tra docker daemon co dang chay khong
    docker ps 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        return "local"
    }
    return "docker"
}

function Get-LocalServer {
    if ($Server -ne "") { return $Server }
    # Kiem tra service MSSQLSERVER01
    $svc = Get-Service -Name "MSSQL`$MSSQLSERVER01" -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq "Running") {
        return ".\MSSQLSERVER01"
    }
    return "localhost"
}

# Chay mot file .sql. $File tinh tu thu muc mssql.
function Invoke-Sql {
    param([string]$File, [string]$Db = "livingdocs", [string[]]$Vars = @())
    $runner = Get-SqlRunner
    Write-Host ">> $File ($runner)" -ForegroundColor Cyan

    if ($runner -eq "docker") {
        $a = @("exec", $container, $sqlcmd, "-S", "localhost", "-U", "sa", "-C", "-I", "-b", "-f", "65001", "-d", $Db)
        foreach ($v in $Vars) { $a += @("-v", $v) }
        $a += @("-i", "/scripts/$File")
        & docker @a
        if ($LASTEXITCODE -ne 0) { throw "Loi khi chay $File trong container" }
    }
    else {
        $localServer = Get-LocalServer
        $localFilePath = Join-Path $mssqlDir $File.Replace('/', '\')
        $cmdArgs = @("-S", $localServer, "-E", "-I", "-b", "-f", "65001", "-d", $Db)
        foreach ($v in $Vars) {
            if ($v -match '^(.*?)=(.*)$') {
                $varName = $matches[1]
                $varVal  = $matches[2]
                $cmdArgs += @("-v", "$varName=`"$varVal`"")
            } else {
                $cmdArgs += @("-v", $v)
            }
        }
        $cmdArgs += @("-i", $localFilePath)
        & sqlcmd @cmdArgs
        if ($LASTEXITCODE -ne 0) { throw "Loi khi chay $File tren SQL Server local" }
    }
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
    $runner = Get-SqlRunner
    if ($runner -eq "docker") {
        if (-not (Test-Path (Join-Path $infra "docker\.env"))) {
            throw "Chua co backend\infra\docker\.env. Hay copy tu .env.example roi dat mat khau."
        }
        docker compose -f $compose up -d
        if ($LASTEXITCODE -ne 0) { throw "docker compose up bi loi" }
        Wait-Healthy
    }
    else {
        Write-Host "Dang su dung SQL Server local tai $(Get-LocalServer)" -ForegroundColor Green
    }
}

function Reset-Db {
    $runner = Get-SqlRunner
    if ($runner -eq "docker") {
        docker compose -f $compose down -v
        if ($LASTEXITCODE -ne 0) { throw "docker compose down bi loi" }
        Start-Db
    }
    else {
        $localServer = Get-LocalServer
        Write-Host "Reset database tren SQL Server local $localServer" -ForegroundColor Yellow
        $dropSql = "IF DB_ID('livingdocs') IS NOT NULL BEGIN ALTER DATABASE livingdocs SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE livingdocs; END;"
        & sqlcmd -S $localServer -E -d master -Q $dropSql
    }
}

function Initialize-Db {
    Invoke-Sql "00_platform/001_create_database.sql" -Db master
    Invoke-Sql "00_platform/002_workspace.sql"
    Invoke-Sql "00_platform/003_sp_create_workspace.sql"
    Invoke-Sql "00_platform/004_sp_purge_expired_audit_log.sql"
    # Agent jobs chi ap dung khi Agent service duoc kich hoat
    try {
        Invoke-Sql "00_platform/005_agent_jobs.sql" -Db master
    }
    catch {
        Write-Host "Luu y: Khong khoi tao duoc SQL Server Agent job (co the Agent service dang tat)." -ForegroundColor Yellow
    }
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
    param([string]$TenantCode = "demo")
    $schema = "ws_$TenantCode"
    Get-ChildItem (Join-Path $mssqlDir "tests") -Filter *.sql | Sort-Object Name | ForEach-Object {
        Invoke-Sql "tests/$($_.Name)" -Vars @("SchemaName=$schema")
    }
    # Chay them bo kiem thu procedure cua 02_integration
    if (Test-Path (Join-Path $mssqlDir "02_integration\test_procedures.sql")) {
        Invoke-Sql "02_integration/test_procedures.sql" -Vars @("SchemaName=$schema")
    }
}

function Backup-Db {
    $runner = Get-SqlRunner
    if ($runner -eq "docker") {
        Invoke-Sql "00_platform/020_backup_full.sql" -Db master
        $dest = Join-Path $infra "backup"
        New-Item -ItemType Directory -Force $dest | Out-Null
        docker cp "${container}:/var/opt/mssql/data/livingdocs_manual.bak" (Join-Path $dest "livingdocs_manual.bak")
        if ($LASTEXITCODE -ne 0) { throw "docker cp bi loi" }
        Write-Host "Da copy file backup ra $dest" -ForegroundColor Green
    }
    else {
        $dest = Join-Path $infra "backup"
        New-Item -ItemType Directory -Force $dest | Out-Null
        $bakFile = (Join-Path $dest "livingdocs_manual.bak").Replace('/', '\')
        $localServer = Get-LocalServer
        $bakSql = "BACKUP DATABASE livingdocs TO DISK = N'$bakFile' WITH COMPRESSION, CHECKSUM, INIT, STATS = 25;"
        & sqlcmd -S $localServer -E -d master -Q $bakSql
        Write-Host "Da backup database thanh cong ra $bakFile" -ForegroundColor Green
    }
}

function Test-Restore {
    $runner = Get-SqlRunner
    if ($runner -eq "docker") {
        $sw = [Diagnostics.Stopwatch]::StartNew()
        Invoke-Sql "00_platform/021_restore_test.sql" -Db master
        $sw.Stop()
        Write-Host ("Thoi gian restore va kiem tra: {0:N1} giay (muc tieu RTO: 4 gio)" -f $sw.Elapsed.TotalSeconds) -ForegroundColor Yellow
    }
    else {
        Write-Host "Kiem tra restore duoc toi uu hoa cho Docker. Bo qua tren local." -ForegroundColor Yellow
    }
}

switch ($Cmd) {
    "up"           { Start-Db }
    "down"         {
        $runner = Get-SqlRunner
        if ($runner -eq "docker") { docker compose -f $compose down }
    }
    "reset"        { Reset-Db }
    "init"         { Initialize-Db }
    "tenant"       { New-Tenant $Code $Name }
    "seed"         { Import-Seed $Code }
    "test"         { Invoke-Tests $Code }
    "backup"       { Backup-Db }
    "restore-test" { Test-Restore }
    "rebuild"      {
        Reset-Db
        Initialize-Db
        New-Tenant "demo" "Demo Workspace"
        New-Tenant "acme" "Acme Corp"
        Import-Seed "demo"
        Import-Seed "acme"
        Invoke-Tests "demo"
    }
    "shell"        {
        $runner = Get-SqlRunner
        if ($runner -eq "docker") {
            docker exec -it $container $sqlcmd -S localhost -U sa -C -d livingdocs
        }
        else {
            $localServer = Get-LocalServer
            & sqlcmd -S $localServer -E -d livingdocs
        }
    }
}
