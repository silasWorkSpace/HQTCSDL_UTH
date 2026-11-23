<#
Tien ich cho database LivingDocs (ho tro ca Docker va SQL Server local).
Chay tu thu muc backend\infra:

  .\db.ps1 up                              Bat SQL Server
  .\db.ps1 init                            Tao database, schema platform, procedure, job
  .\db.ps1 tenant -Code demo -Name "Demo"  Tao workspace moi va toan bo bang cua moi module
  .\db.ps1 migrate -Code demo             Ap dung migration idempotent cho workspace hien co
  .\db.ps1 seed -Code demo                 Nap du lieu mau cho workspace
  .\db.ps1 test                            Chay moi file trong mssql\tests
  .\db.ps1 backup                          Backup full roi copy ra backend\infra\backup
  .\db.ps1 restore-test                    Restore ra database tam de kiem tra va do thoi gian
  .\db.ps1 provision-app-user              Create/update local least-privilege application SQL login
  .\db.ps1 rotate-sa-password              Rotate SQL Server sa password and update the ignored local .env
  .\db.ps1 rebuild                         Xoa sach roi dung lai tu dau (reset, init, 2 tenant, seed, test)
  .\db.ps1 reset | down | shell
#>
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("up", "down", "reset", "init", "tenant", "migrate", "seed", "test", "backup", "restore-test", "rebuild", "shell", "provision-app-user", "rotate-sa-password")]
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
$envFile   = Join-Path $infra "docker\.env"
$envExampleFile = Join-Path $infra "docker\.env.example"
$compose   = Join-Path $infra "docker\docker-compose.yml"
$container = "livingdocs-mssql"
$sqlcmd    = "/opt/mssql-tools18/bin/sqlcmd"

if (-not $env:MSSQL_SA_PASSWORD -and (Test-Path -LiteralPath $envFile)) {
    foreach ($name in @('MSSQL_SA_PASSWORD', 'DB_USER', 'DB_PASSWORD')) {
        if ([Environment]::GetEnvironmentVariable($name, 'Process')) { continue }
        $entry = Get-Content -LiteralPath $envFile | Where-Object { $_ -match "^\s*$name\s*=" } | Select-Object -First 1
        if ($entry -match "^\s*$name\s*=\s*(.*)\s*$") {
            [Environment]::SetEnvironmentVariable($name, $matches[1].Trim().Trim('"').Trim("'"), 'Process')
        }
    }
}

function Set-LocalEnvValue {
    param([string]$Name, [string]$Value)
    $lines = [Collections.Generic.List[string]]::new()
    if (Test-Path -LiteralPath $envFile) {
        foreach ($line in [IO.File]::ReadAllLines($envFile)) { $lines.Add($line) }
    }
    $found = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^\s*$Name\s*=") {
            $lines[$i] = "$Name=$Value"
            $found = $true
        }
    }
    if (-not $found) { $lines.Add("$Name=$Value") }
    [IO.File]::WriteAllLines($envFile, $lines, [Text.UTF8Encoding]::new($false))
}

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
        $sqlPassword = $env:MSSQL_SA_PASSWORD
        if (-not $sqlPassword) { throw "MSSQL_SA_PASSWORD is required for SQL Server container access." }
        $a = @("exec", "-e", "SQLCMDPASSWORD=$sqlPassword", $container, $sqlcmd, "-S", "localhost", "-U", "sa", "-C", "-I", "-b", "-f", "65001", "-d", $Db)
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
        if (-not (Test-Path -LiteralPath $envFile)) {
            throw "Chua co backend\infra\docker\.env. Hay copy tu .env.example roi dat mat khau."
        }
        docker compose --env-file $envExampleFile --env-file $envFile -f $compose up -d mssql redis kafka
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
        docker compose --env-file $envExampleFile --env-file $envFile -f $compose down -v
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

function Invoke-TenantMigrations {
    param([string]$TenantCode)
    $schema = "ws_$TenantCode"
    foreach ($dir in Get-ModuleDirs) {
        $migrationDir = Join-Path $dir.FullName "migrations"
        if (-not (Test-Path -LiteralPath $migrationDir)) { continue }
        Get-ChildItem -LiteralPath $migrationDir -Filter '*.sql' -File | Sort-Object Name | ForEach-Object {
            Invoke-Sql "$($dir.Name)/migrations/$($_.Name)" -Vars @("SchemaName=$schema")
        }
    }
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
    Invoke-TenantMigrations $TenantCode
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
    Invoke-TenantMigrations $TenantCode
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

function Rotate-SaPassword {
    if (-not (Test-Path -LiteralPath $envFile)) { throw "Missing local environment file: $envFile" }
    $oldPassword = $env:MSSQL_SA_PASSWORD
    if (-not $oldPassword) { throw "MSSQL_SA_PASSWORD is missing from the process and local .env." }

    $randomBytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($randomBytes) } finally { $rng.Dispose() }
    $newPassword = "LD!$(([BitConverter]::ToString($randomBytes)).Replace('-', ''))aZ9"

    $originalText = [IO.File]::ReadAllText($envFile)
    $matches = [regex]::Matches($originalText, '(?m)^\s*MSSQL_SA_PASSWORD\s*=')
    if ($matches.Count -ne 1) { throw "Expected exactly one MSSQL_SA_PASSWORD entry in local .env." }
    $updatedText = [regex]::Replace($originalText, '(?m)^\s*MSSQL_SA_PASSWORD\s*=.*$', [System.Text.RegularExpressions.MatchEvaluator]{ param($match) "MSSQL_SA_PASSWORD=$newPassword" }, 1)

    [IO.File]::WriteAllText($envFile, $updatedText, [Text.UTF8Encoding]::new($false))
    try {
        $quotedNew = $newPassword.Replace("'", "''")
        $process = New-Object System.Diagnostics.Process
        $process.StartInfo.FileName = (Get-Command docker -ErrorAction Stop).Source
        $process.StartInfo.Arguments = "exec -i $container $sqlcmd -S localhost -U sa -C -b -d master"
        $process.StartInfo.UseShellExecute = $false
        $process.StartInfo.CreateNoWindow = $true
        $process.StartInfo.RedirectStandardInput = $true
        $process.StartInfo.RedirectStandardOutput = $true
        $process.StartInfo.RedirectStandardError = $true
        if (-not $process.Start()) { throw "Could not start Docker SQL command." }
        $process.StandardInput.WriteLine("ALTER LOGIN [sa] WITH PASSWORD = N'$quotedNew';")
        $process.StandardInput.WriteLine("GO")
        $process.StandardInput.Close()
        $null = $process.StandardOutput.ReadToEnd()
        $null = $process.StandardError.ReadToEnd()
        $process.WaitForExit()
        if ($process.ExitCode -ne 0) { throw "SQL Server rejected the password change." }
        $process.Dispose()
    }
    catch {
        [IO.File]::WriteAllText($envFile, $originalText, [Text.UTF8Encoding]::new($false))
        throw "SQL Server password rotation failed; local .env was restored."
    }

    $env:MSSQL_SA_PASSWORD = $newPassword
    docker compose --env-file $envExampleFile --env-file $envFile -f $compose up -d --force-recreate mssql
    if ($LASTEXITCODE -ne 0) { throw "The SQL password changed and local .env was updated, but Compose could not recreate the SQL container." }
    Wait-Healthy
    Write-Host "SQL Server sa password rotated and saved only in the ignored local .env." -ForegroundColor Green
}

function Provision-AppUser {
    if (-not (Test-Path -LiteralPath $envFile)) { throw "Missing local environment file: $envFile" }
    if (-not $env:MSSQL_SA_PASSWORD) { throw 'MSSQL_SA_PASSWORD is missing from the local .env.' }
    $appUser = $env:DB_USER
    if (-not $appUser) { $appUser = 'livingdocs_app' }
    if ($appUser -notmatch '^[A-Za-z][A-Za-z0-9_]{2,29}$') { throw 'DB_USER must start with a letter and contain only letters, digits, and underscores (3-30 characters).' }

    $appPassword = $env:DB_PASSWORD
    if (-not $appPassword) {
        $randomBytes = New-Object byte[] 32
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($randomBytes) } finally { $rng.Dispose() }
        $appPassword = "LD!$(([BitConverter]::ToString($randomBytes)).Replace('-', ''))aZ9"
    }
    if ($appPassword -notmatch '^[A-Za-z0-9!_-]{16,128}$') { throw 'DB_PASSWORD must contain 16-128 letters, digits, or !_- characters for SQLCMD-safe provisioning.' }

    Set-LocalEnvValue -Name 'DB_USER' -Value $appUser
    Set-LocalEnvValue -Name 'DB_PASSWORD' -Value $appPassword
    $env:DB_USER = $appUser
    $env:DB_PASSWORD = $appPassword

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo.FileName = (Get-Command docker -ErrorAction Stop).Source
    $process.StartInfo.Arguments = "exec -i $container $sqlcmd -S localhost -U sa -C -I -b -f 65001 -d master"
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.CreateNoWindow = $true
    $process.StartInfo.RedirectStandardInput = $true
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true
    if (-not $process.Start()) { throw 'Could not start Docker SQL command.' }
    $process.StandardInput.WriteLine((':setvar AppUser "{0}"' -f $appUser))
    $process.StandardInput.WriteLine((':setvar AppPassword "{0}"' -f $appPassword))
    $process.StandardInput.WriteLine(':r /scripts/00_platform/011_provision_app_login.sql')
    $process.StandardInput.Close()
    $null = $process.StandardOutput.ReadToEnd()
    $null = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    $exitCode = $process.ExitCode
    $process.Dispose()
    if ($exitCode -ne 0) { throw 'SQL Server could not provision the application login. Local .env retains the generated credentials for retry.' }
    Write-Host 'Application SQL login provisioned; local credentials are stored only in the ignored .env.' -ForegroundColor Green
}

switch ($Cmd) {
    "up"           { Start-Db }
    "down"         {
        $runner = Get-SqlRunner
        if ($runner -eq "docker") { docker compose --env-file $envExampleFile --env-file $envFile -f $compose down }
    }
    "reset"        { Reset-Db }
    "init"         { Initialize-Db }
    "tenant"       { New-Tenant $Code $Name }
    "migrate"      { Invoke-TenantMigrations $Code }
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
    "provision-app-user" { Provision-AppUser }
    "rotate-sa-password" { Rotate-SaPassword }
}
