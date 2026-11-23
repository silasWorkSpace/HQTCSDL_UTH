<#
.SYNOPSIS
  Khởi động LivingDocs để kiểm thử local trên Windows.
.DESCRIPTION
  Mặc định chạy SQL Server/Redis/Kafka bằng Docker, khởi tạo database demo nếu chưa có,
  chạy sáu Spring Boot service bằng Maven ở profile dev và chạy frontend bằng Vite.
  Không dừng tiến trình nào đang chiếm cổng. Chạy .\stop-all.ps1 để dừng các cửa sổ
  do script này tạo.
.PARAMETER Docker
  Chạy các backend container trong Compose thay cho Maven local. Frontend vẫn chạy Vite.
.PARAMETER NoFrontend
  Không khởi chạy Vite frontend.
.PARAMETER NoBrowser
  Không mở URL sau khi các service sẵn sàng.
.PARAMETER OpenDemoSignup
  Cho phép GitHub tự đăng ký trong workspace demo local để thử OAuth. Mặc định đóng.
.EXAMPLE
  .\start-all.ps1
  .\start-all.ps1 -OpenDemoSignup
  .\start-all.ps1 -Docker
  .\start-all.ps1 -NoFrontend
#>
[CmdletBinding()]
param(
    [switch]$Docker,
    [switch]$NoFrontend,
    [switch]$NoBrowser,
    [switch]$SkipDatabaseInit,
    [switch]$OpenDemoSignup,
    [ValidateRange(60, 900)]
    [int]$StartupTimeoutSeconds = 600
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$backendDir = Join-Path $root 'backend'
$infraDir = Join-Path $backendDir 'infra'
$dockerDir = Join-Path $infraDir 'docker'
$composeFile = Join-Path $dockerDir 'docker-compose.yml'
$envFile = Join-Path $dockerDir '.env'
$envExample = Join-Path $dockerDir '.env.example'
$localRunDir = Join-Path $backendDir '.local-run'
$localSecretsFile = Join-Path $localRunDir 'local-secrets.env'
$stateFile = Join-Path $localRunDir 'start-all.json'
$frontendDir = Join-Path $root 'frontend'
$mvnw = Join-Path $backendDir 'mvnw.cmd'
$powershellExe = (Get-Command powershell.exe -ErrorAction SilentlyContinue).Source

$services = @(
    @{ Name = 'Integration Service'; Module = 'services/integration-service'; Port = 8082 },
    @{ Name = 'Identity Service'; Module = 'services/identity-service'; Port = 8081 },
    @{ Name = 'Document Service'; Module = 'services/document-service'; Port = 8083 },
    @{ Name = 'Workflow Service'; Module = 'services/workflow-service'; Port = 8084 },
    @{ Name = 'Governance Service'; Module = 'services/governance-service'; Port = 8085 },
    @{ Name = 'Notification Service'; Module = 'services/notification-service'; Port = 8086 }
)

$trackedProcesses = [System.Collections.Generic.List[object]]::new()
$originalEnvironment = @{}
$generatedLocalSecrets = [ordered]@{}
$localSecretLines = [System.Collections.Generic.List[string]]::new()
$runState = [ordered]@{
    startedAt = [DateTime]::UtcNow.ToString('o')
    mode = if ($Docker) { 'docker' } else { 'local' }
    services = @()
}

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Save-RunState {
    if ($trackedProcesses.Count -eq 0) { return }
    $runState.services = @($trackedProcesses.ToArray())
    $runState | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $stateFile -Encoding UTF8
}

function Invoke-Native {
    param(
        [Parameter(Mandatory)] [string]$FilePath,
        [Parameter(Mandatory)] [string[]]$ArgumentList,
        [Parameter(Mandatory)] [string]$WorkingDirectory,
        [Parameter(Mandatory)] [string]$FailureMessage
    )
    Push-Location -LiteralPath $WorkingDirectory
    try {
        & $FilePath @ArgumentList
        if ($LASTEXITCODE -ne 0) {
            throw "$FailureMessage (exit code $LASTEXITCODE)."
        }
    }
    finally {
        Pop-Location
    }
}

function Set-ProcessEnvironment([string]$Name, [AllowNull()][string]$Value) {
    if (-not $originalEnvironment.ContainsKey($Name)) {
        $originalEnvironment[$Name] = [Environment]::GetEnvironmentVariable($Name, 'Process')
    }
    [Environment]::SetEnvironmentVariable($Name, $Value, 'Process')
}

function Import-EnvFile {
    param([Parameter(Mandatory)][string]$Path, [switch]$OnlyWhenUnset)
    if (-not (Test-Path -LiteralPath $Path)) { return }

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
        $equals = $trimmed.IndexOf('=')
        if ($equals -lt 1) { continue }

        $name = $trimmed.Substring(0, $equals).Trim()
        if ($name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { continue }
        $value = $trimmed.Substring($equals + 1).Trim()
        if ($value.Length -ge 2 -and (($value[0] -eq '"' -and $value[$value.Length - 1] -eq '"') -or
                                      ($value[0] -eq "'" -and $value[$value.Length - 1] -eq "'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        if ($value -match '^(your-|replace-with-|<.*>)') { continue }
        if ($OnlyWhenUnset -and [Environment]::GetEnvironmentVariable($name, 'Process')) { continue }
        Set-ProcessEnvironment $name $value
    }
}

function New-RandomBytes([int]$Count) {
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $bytes = New-Object byte[] $Count
        $rng.GetBytes($bytes)
        return ,$bytes
    }
    finally {
        $rng.Dispose()
    }
}

function Ensure-LocalSecret([string]$Name, [ValidateSet('base64', 'hex')][string]$Encoding) {
    $value = [Environment]::GetEnvironmentVariable($Name, 'Process')
    if ($value) { return }

    $bytes = New-RandomBytes 32
    if ($Encoding -eq 'base64') { $value = [Convert]::ToBase64String($bytes) }
    else { $value = (($bytes | ForEach-Object { $_.ToString('x2') }) -join '') }

    Set-ProcessEnvironment $Name $value
    $generatedLocalSecrets[$Name] = $value
    $localSecretLines.Add("$Name=$value")
}

function Test-TcpPort([int]$Port) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $pending = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $pending.AsyncWaitHandle.WaitOne(250)) { return $false }
        $client.EndConnect($pending)
        return $true
    }
    catch { return $false }
    finally { $client.Dispose() }
}

function Test-BackendHealthy([int]$Port) {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/actuator/health/readiness" -TimeoutSec 5 -ErrorAction Stop
        return ($health.status -eq 'UP')
    }
    catch { return $false }
}

function Test-PortOwnedByLivingDocsContainer([int]$Port) {
    if (-not $Docker) { return $false }

    $expectedContainer = switch ($Port) {
        8081 { 'livingdocs-identity' }
        8082 { 'livingdocs-integration' }
        8083 { 'livingdocs-document' }
        8084 { 'livingdocs-workflow' }
        8085 { 'livingdocs-governance' }
        8086 { 'livingdocs-notification' }
        80 { 'livingdocs-caddy' }
        443 { 'livingdocs-caddy' }
        default { $null }
    }
    if (-not $expectedContainer) { return $false }

    $owners = @(& docker ps --filter "publish=$Port" --format '{{.Names}}' 2>$null)
    return ($LASTEXITCODE -eq 0 -and $owners -contains $expectedContainer)
}

function Test-PortUnused([int]$Port) {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    try {
        $listener.Start()
        return $true
    }
    catch { return $false }
    finally { $listener.Stop() }
}

function Wait-ForDockerHealth([string]$Container, [int]$TimeoutSeconds) {
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        $health = & docker inspect -f '{{.State.Health.Status}}' $Container 2>$null
        if ($LASTEXITCODE -eq 0 -and "$health".Trim() -eq 'healthy') { return }
        Start-Sleep -Seconds 2
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "Container $Container chưa healthy sau $TimeoutSeconds giây. Xem log bằng: docker logs $Container"
}

function Invoke-DbPs {
    param([Parameter(Mandatory)][string[]]$Arguments)
    Invoke-Native -FilePath 'powershell.exe' -ArgumentList (@('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $infraDir 'db.ps1')) + $Arguments) `
        -WorkingDirectory $infraDir -FailureMessage "db.ps1 $($Arguments[0]) thất bại"
}

function Invoke-SqlScalar([string]$Database, [string]$Query) {
    $sqlcmd = '/opt/mssql-tools18/bin/sqlcmd'
    $sqlPassword = [Environment]::GetEnvironmentVariable('MSSQL_SA_PASSWORD', 'Process')
    $output = & docker exec -e "SQLCMDPASSWORD=$sqlPassword" livingdocs-mssql $sqlcmd -S localhost -U sa -C -b -h -1 -W -d $Database -Q $Query 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw 'Không truy vấn được SQL Server. Kiểm tra MSSQL_SA_PASSWORD trong file .env mà không chia sẻ giá trị đó.'
    }
    return (($output | ForEach-Object { "$($_)" }) -join "`n").Trim()
}

function Initialize-LocalDatabase {
    $exists = Invoke-SqlScalar -Database 'master' -Query "SET NOCOUNT ON; SELECT CASE WHEN DB_ID(N'livingdocs') IS NULL THEN 0 ELSE 1 END;"
    if ($exists -notmatch '(?m)^\s*1\s*$') {
        Write-Host 'Database livingdocs chưa có; đang chạy init, tạo workspace demo và seed dữ liệu local.' -ForegroundColor Yellow
        Invoke-DbPs @('init')
        Invoke-DbPs @('tenant', '-Code', 'demo', '-Name', 'Demo Workspace')
        Invoke-DbPs @('seed', '-Code', 'demo')
        Invoke-DbPs @('migrate', '-Code', 'demo')
        return
    }

    $platformExists = Invoke-SqlScalar -Database 'livingdocs' -Query "SET NOCOUNT ON; SELECT CASE WHEN OBJECT_ID(N'platform.workspace', N'U') IS NULL THEN 0 ELSE 1 END;"
    if ($platformExists -notmatch '(?m)^\s*1\s*$') {
        Write-Host 'Database có nhưng schema platform chưa khởi tạo; đang chạy các bước init idempotent.' -ForegroundColor Yellow
        Invoke-DbPs @('init')
    }

    $demoExists = Invoke-SqlScalar -Database 'livingdocs' -Query "SET NOCOUNT ON; SELECT CASE WHEN EXISTS (SELECT 1 FROM platform.workspace WHERE code = 'demo') THEN 1 ELSE 0 END;"
    if ($demoExists -notmatch '(?m)^\s*1\s*$') {
        Write-Host 'Workspace demo chưa có; đang tạo workspace và seed dữ liệu local.' -ForegroundColor Yellow
        Invoke-DbPs @('tenant', '-Code', 'demo', '-Name', 'Demo Workspace')
        Invoke-DbPs @('seed', '-Code', 'demo')
    }

    Invoke-DbPs @('migrate', '-Code', 'demo')
}

function Add-ChildPowerShell([string]$Title, [string]$ScriptText, [string]$WorkingDirectory) {
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($ScriptText))
    $process = Start-Process -FilePath $powershellExe `
        -ArgumentList @('-NoLogo', '-NoProfile', '-NoExit', '-EncodedCommand', $encoded) `
        -WorkingDirectory $WorkingDirectory -PassThru -WindowStyle Normal
    Start-Sleep -Milliseconds 350
    $trackedProcesses.Add([ordered]@{
        name = $Title
        pid = $process.Id
        processStartedAt = $process.StartTime.ToUniversalTime().ToString('o')
    })
    Save-RunState
    return $process
}

function Start-LocalSpringService($Service) {
    $quotedBackend = "'" + $backendDir.Replace("'", "''") + "'"
    $quotedTitle = "'LivingDocs - $($Service.Name) (: $($Service.Port))'"
    $quotedModule = "'" + $Service.Module + "'"
    $childScript = @"
`$host.UI.RawUI.WindowTitle = $quotedTitle
Set-Location -LiteralPath $quotedBackend
Write-Host 'Local dev profile; HttpOnly cookies use COOKIE_SECURE=false for localhost.' -ForegroundColor DarkCyan
& '.\mvnw.cmd' -pl $quotedModule spring-boot:run '-Dspring-boot.run.profiles=dev'
if (`$LASTEXITCODE -ne 0) { Write-Host 'Service stopped with an error. Review the Maven output above.' -ForegroundColor Red }
"@
    return Add-ChildPowerShell -Title $Service.Name -ScriptText $childScript -WorkingDirectory $backendDir
}

function Start-Frontend {
    $quotedFrontend = "'" + $frontendDir.Replace("'", "''") + "'"
    $childScript = @"
`$host.UI.RawUI.WindowTitle = 'LivingDocs - Frontend (5173)'
Set-Location -LiteralPath $quotedFrontend
npm run dev -- --host 127.0.0.1
if (`$LASTEXITCODE -ne 0) { Write-Host 'Vite stopped with an error. Review the npm output above.' -ForegroundColor Red }
"@
    return Add-ChildPowerShell -Title 'Frontend' -ScriptText $childScript -WorkingDirectory $frontendDir
}

function Wait-ForPorts([int[]]$Ports, [int]$TimeoutSeconds) {
    $pending = @($Ports)
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    while ($pending.Count -gt 0 -and [DateTime]::UtcNow -lt $deadline) {
        $pending = @($pending | Where-Object {
            if ($_ -eq 5173) { -not (Test-TcpPort $_) }
            else { -not (Test-BackendHealthy $_) }
        })
        if ($pending.Count -gt 0) { Start-Sleep -Seconds 2 }
    }
    return ,$pending
}

function Restore-ProcessEnvironment {
    foreach ($name in $originalEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $originalEnvironment[$name], 'Process')
    }
}

try {
    Write-Host '==============================================================' -ForegroundColor Cyan
    Write-Host ' LivingDocs local test launcher' -ForegroundColor Cyan
    Write-Host '==============================================================' -ForegroundColor Cyan

    if (-not (Test-Path -LiteralPath $envFile)) {
        throw "Chưa có $envFile. Tạo file local từ .env.example rồi điền MSSQL_SA_PASSWORD và GitHub OAuth credentials. Script không tự chép placeholder thành cấu hình chạy được."
    }
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Không tìm thấy Docker CLI.' }
    if (-not $powershellExe) { throw 'Không tìm thấy powershell.exe để mở cửa sổ log cho từng service.' }
    if (-not (Test-Path -LiteralPath $mvnw)) { throw 'Không tìm thấy backend/mvnw.cmd.' }

    New-Item -ItemType Directory -Path $localRunDir -Force | Out-Null
    Import-EnvFile -Path $envFile
    Import-EnvFile -Path $localSecretsFile -OnlyWhenUnset

    $saPassword = [Environment]::GetEnvironmentVariable('MSSQL_SA_PASSWORD', 'Process')
    if (-not $saPassword) { throw 'Thiếu MSSQL_SA_PASSWORD trong backend/infra/docker/.env.' }

    $jwtSecret = [Environment]::GetEnvironmentVariable('JWT_SECRET', 'Process')
    if (-not $jwtSecret -or $jwtSecret.Length -lt 32) {
        throw 'JWT_SECRET phải có ít nhất 32 ký tự. Hãy đặt khóa random riêng trong file .env local.'
    }

    foreach ($name in @('GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET')) {
        if (-not [Environment]::GetEnvironmentVariable($name, 'Process')) {
            throw "Thiếu $name thật cho GitHub OAuth trong file .env local; không dùng placeholder từ .env.example."
        }
    }

    $redirectUri = [Environment]::GetEnvironmentVariable('GITHUB_REDIRECT_URI', 'Process')
    if (-not $redirectUri) {
        Set-ProcessEnvironment 'GITHUB_REDIRECT_URI' 'http://localhost:5173/auth/callback'
        $redirectUri = 'http://localhost:5173/auth/callback'
    }
    if ($redirectUri -ne 'http://localhost:5173/auth/callback') {
        throw 'GITHUB_REDIRECT_URI trong file .env phải là http://localhost:5173/auth/callback để test local. Giữ callback staging ở cấu hình riêng.'
    }

    $encryptionKey = [Environment]::GetEnvironmentVariable('TOKEN_ENCRYPTION_KEY', 'Process')
    $encryptionKeyValid = $false
    if ($encryptionKey) {
        try { $encryptionKeyValid = ([Convert]::FromBase64String($encryptionKey).Length -eq 32) } catch { $encryptionKeyValid = $false }
    }
    if (-not $encryptionKeyValid) {
        if ($encryptionKey) { throw 'TOKEN_ENCRYPTION_KEY có giá trị nhưng không phải Base64 của đúng 32 byte. Kiểm tra .env local.' }
        Ensure-LocalSecret -Name 'TOKEN_ENCRYPTION_KEY' -Encoding base64
    }
    Ensure-LocalSecret -Name 'GITHUB_WEBHOOK_SECRET' -Encoding hex

    if ($localSecretLines.Count -gt 0) {
        if (Test-Path -LiteralPath $localSecretsFile) { Add-Content -LiteralPath $localSecretsFile -Value $localSecretLines -Encoding UTF8 }
        else { Set-Content -LiteralPath $localSecretsFile -Value $localSecretLines -Encoding UTF8 }
        (Get-Item -LiteralPath $localSecretsFile).Attributes = (Get-Item -LiteralPath $localSecretsFile).Attributes -bor [IO.FileAttributes]::Hidden
        Write-Host 'Đã tạo khóa local bền vững trong backend/.local-run/local-secrets.env (được gitignore); không sửa file .env của bạn.' -ForegroundColor DarkYellow
    }

    # Local testing can use sa only as a fallback when no app login was provisioned.
    $dbUser = [Environment]::GetEnvironmentVariable('DB_USER', 'Process')
    $dbPassword = [Environment]::GetEnvironmentVariable('DB_PASSWORD', 'Process')
    if (-not $dbUser -or -not $dbPassword) {
        Set-ProcessEnvironment 'DB_USER' 'sa'
        Set-ProcessEnvironment 'DB_PASSWORD' $saPassword
        Write-Host 'Local-only fallback: app processes connect with SQL Server sa because DB_USER/DB_PASSWORD are not configured.' -ForegroundColor Yellow
    }

    $dbUser = [Environment]::GetEnvironmentVariable('DB_USER', 'Process')
    $dbPassword = [Environment]::GetEnvironmentVariable('DB_PASSWORD', 'Process')
    Set-ProcessEnvironment 'DB_HOST' 'localhost'
    Set-ProcessEnvironment 'DB_PORT' '1433'
    Set-ProcessEnvironment 'DB_NAME' 'livingdocs'
    Set-ProcessEnvironment 'DB_URL' 'jdbc:sqlserver://localhost:1433;databaseName=livingdocs;trustServerCertificate=true;encrypt=false'
    Set-ProcessEnvironment 'SPRING_DATASOURCE_URL' 'jdbc:sqlserver://localhost:1433;databaseName=livingdocs;trustServerCertificate=true;encrypt=false'
    Set-ProcessEnvironment 'SPRING_DATASOURCE_USERNAME' $dbUser
    Set-ProcessEnvironment 'SPRING_DATASOURCE_PASSWORD' $dbPassword
    Set-ProcessEnvironment 'REDIS_HOST' 'localhost'
    Set-ProcessEnvironment 'REDIS_PORT' '6379'
    Set-ProcessEnvironment 'KAFKA_BOOTSTRAP' 'localhost:9092'
    Set-ProcessEnvironment 'KAFKA_BOOTSTRAP_SERVERS' 'localhost:9092'
    Set-ProcessEnvironment 'KAFKA_SERVERS' 'localhost:9092'
    Set-ProcessEnvironment 'INTEGRATION_SERVICE_URL' 'http://localhost:8082'
    Set-ProcessEnvironment 'SPRING_PROFILES_ACTIVE' 'dev'
    Set-ProcessEnvironment 'COOKIE_SECURE' 'false'
    Set-ProcessEnvironment 'KAFKA_ENABLED' 'true'

    $applicationPorts = @(8081, 8082, 8083, 8084, 8085, 8086)
    if (-not $NoFrontend) { $applicationPorts += 5173 }
    if ($Docker) { $applicationPorts += @(80, 443) }
    foreach ($port in $applicationPorts) {
        if (Test-PortUnused $port) { continue }
        if (Test-PortOwnedByLivingDocsContainer $port) {
            Write-Host "Cổng $port đã thuộc container LivingDocs; sẽ tái sử dụng stack Compose hiện có." -ForegroundColor DarkCyan
            continue
        }
        throw "Local port $port đang được ứng dụng khác sử dụng. Dừng đúng ứng dụng đó rồi chạy lại; script không tự kill process ngoài LivingDocs."
    }

    Write-Step 'Khởi động SQL Server, Redis, Kafka bằng Docker Compose.'
    Invoke-Native -FilePath 'docker' `
        -ArgumentList @('compose', '--env-file', $envFile, '-f', $composeFile, 'up', '-d', 'mssql', 'redis', 'kafka') `
        -WorkingDirectory $root -FailureMessage 'Không khởi động được Docker infrastructure'
    Wait-ForDockerHealth -Container 'livingdocs-mssql' -TimeoutSeconds 180
    Wait-ForDockerHealth -Container 'livingdocs-redis' -TimeoutSeconds 90
    Wait-ForDockerHealth -Container 'livingdocs-kafka' -TimeoutSeconds 120

    if (-not $SkipDatabaseInit) {
        Write-Step 'Kiểm tra database và workspace demo.'
        Initialize-LocalDatabase
        if ($OpenDemoSignup) {
            $null = Invoke-SqlScalar -Database 'livingdocs' -Query "UPDATE platform.workspace SET config = JSON_MODIFY(COALESCE(config, N'{}'), '$.github_signup', 'open') WHERE code = 'demo'; SELECT 1;"
            Write-Host 'GitHub signup đang mở riêng cho workspace demo trong database local này.' -ForegroundColor Yellow
        }
    }

    Write-Step 'Build backend local từ các module Maven.'
    $installArgs = @('-B', '-DskipTests', 'install')
    Invoke-Native -FilePath $mvnw -ArgumentList $installArgs -WorkingDirectory $backendDir `
        -FailureMessage 'Maven build/install thất bại'

    if ($Docker) {
        Write-Step 'Build và chạy backend containers bằng Compose profile full.'
        Invoke-Native -FilePath 'docker' `
            -ArgumentList @('compose', '--env-file', $envFile, '-f', $composeFile, '--profile', 'full', 'up', '-d', '--build') `
            -WorkingDirectory $root -FailureMessage 'Docker Compose full profile thất bại'
    }
    else {
        Write-Step 'Mở sáu backend service trong các cửa sổ log riêng.'
        foreach ($service in $services) {
            Start-LocalSpringService $service | Out-Null
            Start-Sleep -Seconds 2
        }
    }

    if (-not $NoFrontend) {
        if (-not (Test-Path -LiteralPath (Join-Path $frontendDir 'node_modules'))) {
            Write-Step 'Cài dependencies frontend bằng npm ci.'
            Invoke-Native -FilePath 'npm' -ArgumentList @('ci') -WorkingDirectory $frontendDir `
                -FailureMessage 'npm ci thất bại'
        }
        Start-Frontend | Out-Null
    }

    $waitPorts = if ($Docker) { @(8081, 8082, 8083, 8084, 8085, 8086) } else { @($services | ForEach-Object { $_.Port }) }
    if (-not $NoFrontend) { $waitPorts += 5173 }
    $waitDescription = if ($NoFrontend) { 'Chờ sáu backend health UP' } else { 'Chờ backend health UP và frontend mở cổng' }
    Write-Step "$waitDescription (tối đa $StartupTimeoutSeconds giây)."
    $pendingPorts = Wait-ForPorts -Ports $waitPorts -TimeoutSeconds $StartupTimeoutSeconds
    if ($pendingPorts.Count -gt 0) {
        throw "Service chưa healthy ở các cổng: $($pendingPorts -join ', ') sau $StartupTimeoutSeconds giây. Kiểm tra log của các service chưa sẵn sàng."
    }
    else {
        if ($NoFrontend) { Write-Host 'Cả sáu backend trả health UP.' -ForegroundColor Green }
        else { Write-Host 'Frontend mở cổng và cả sáu backend trả health UP.' -ForegroundColor Green }
    }

    if (-not $NoFrontend) { Write-Host "`nFrontend:    http://localhost:5173" -ForegroundColor Green }
    else { Write-Host "`nFrontend:    bỏ qua theo -NoFrontend" -ForegroundColor DarkGray }
    Write-Host 'Identity:    http://localhost:8081/swagger-ui.html' -ForegroundColor White
    Write-Host 'Integration: http://localhost:8082/swagger-ui.html' -ForegroundColor White
    Write-Host 'Documents:   http://localhost:8083/swagger-ui.html' -ForegroundColor White
    Write-Host 'Workflow:    http://localhost:8084/swagger-ui.html' -ForegroundColor White
    Write-Host 'Governance:  http://localhost:8085/swagger-ui.html' -ForegroundColor White
    Write-Host 'Notifications:http://localhost:8086/swagger-ui.html' -ForegroundColor White
    if ($Docker) { Write-Host 'AI Engine:   http://localhost:8090/health' -ForegroundColor White }
    else { Write-Host 'AI/RAG không được khởi động trong luồng local JVM MVP này.' -ForegroundColor DarkGray }
    Write-Host 'Dừng các cửa sổ do script mở: .\stop-all.ps1' -ForegroundColor Yellow
    if ($Docker) { Write-Host 'Dừng cả Docker containers: .\stop-all.ps1 -Docker' -ForegroundColor Yellow }

    if (-not $NoBrowser -and -not $NoFrontend -and (Test-TcpPort 5173)) {
        Start-Process 'http://localhost:5173'
    }
}
catch {
    Write-Host "`n[START FAILED] $($_.Exception.Message)" -ForegroundColor Red
    if ($trackedProcesses.Count -gt 0) {
        Write-Host "Một số cửa sổ đã mở và vẫn giữ để xem log. Dùng .\stop-all.ps1 để dừng chúng." -ForegroundColor Yellow
    }
    exit 1
}
finally {
    Restore-ProcessEnvironment
}
