<#
.SYNOPSIS
  Khởi động TOÀN BỘ hệ sinh thái LivingDocs chỉ với 1 lệnh duy nhất.
.DESCRIPTION
  Hỗ trợ 2 chế độ linh hoạt:
  1. Chế độ Local Dev (Mặc định):
     - Tự động bật Docker Infra (SQL Server, Redis, Kafka).
     - Khởi động đồng thời tất cả các Services (Identity, Integration, Document, Workflow, Notification, AI Engine, Frontend).
     - Mở từng service trong tab hoặc cửa sổ có nhãn màu rõ ràng để dễ dàng theo dõi log.
  2. Chế độ Docker Full (-Docker):
     - Dựng 100% dịch vụ bên trong Docker container qua profile 'full'.
.EXAMPLE
  .\start-all.ps1
  .\start-all.ps1 -Docker
  .\start-all.ps1 -NoFrontend
  .\start-all.ps1 -WindowMode windows
#>
param(
    [switch]$Docker,
    [switch]$NoFrontend,
    [ValidateSet("tabs", "windows")]
    [string]$WindowMode = "tabs"
)

$ErrorActionPreference = "Continue"
$root        = $PSScriptRoot
$backendDir  = Join-Path $root "backend"
$infraDir    = Join-Path $backendDir "infra"
$dockerDir   = Join-Path $infraDir "docker"
$composeFile = Join-Path $dockerDir "docker-compose.yml"
$envFile     = Join-Path $dockerDir ".env"
$envExample  = Join-Path $dockerDir ".env.example"
$aiDir       = Join-Path $backendDir "ai-engine"
$frontendDir = Join-Path $root "frontend"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "    LIVINGDOCS - KHỞI ĐỘNG HỆ THỐNG    " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# Kiểm tra file .env
if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host ">> [THÔNG BÁO] Chưa có file .env, đã tự động tạo từ .env.example!" -ForegroundColor Yellow
    }
}

# ------------------------------------------------------------------------------
# 1. NẾU CHỌN CHẾ ĐỘ DOCKER FULL (-Docker)
# ------------------------------------------------------------------------------
if ($Docker) {
    # 1.1 Kiểm tra Docker daemon
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host ">> [LỖI] Không tìm thấy lệnh 'docker'. Vui lòng cài đặt và bật Docker Desktop!" -ForegroundColor Red
        exit 1
    }
    docker ps 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host ">> [LỖI] Docker daemon chưa khởi động! Vui lòng bật Docker Desktop trước." -ForegroundColor Red
        exit 1
    }

    Write-Host "`n[1/4] Kiểm tra và biên dịch nhanh JARs trên máy host (tận dụng cache .m2 cực nhanh)..." -ForegroundColor Yellow
    Set-Location $backendDir
    .\mvnw.cmd package -DskipTests -q
    if ($LASTEXITCODE -ne 0) {
        Write-Host ">> [LỖI] Không thể biên dịch backend JARs!" -ForegroundColor Red
        exit 1
    }
    Write-Host ">> [OK] Đã biên dịch toàn bộ JARs thành công!" -ForegroundColor Green

    Write-Host "`n[2/4] Khởi động hạ tầng Docker (SQL Server, Redis, Kafka) và chuẩn bị CSDL..." -ForegroundColor Yellow
    docker compose --env-file $envFile -f $composeFile up -d mssql redis kafka
    if ($LASTEXITCODE -ne 0) {
        Write-Host ">> [LỖI] docker compose up hạ tầng gặp sự cố!" -ForegroundColor Red
        exit 1
    }

    # Chờ SQL Server sẵn sàng
    Write-Host ">> Đang kiểm tra trạng thái SQL Server..." -ForegroundColor Cyan
    $isHealthy = $false
    for ($i = 0; $i -lt 30; $i++) {
        $status = docker inspect -f "{{.State.Health.Status}}" livingdocs-mssql 2>&1
        if ($status -eq "healthy") {
            $isHealthy = $true
            break
        }
        Start-Sleep -Seconds 2
    }

    # Kiểm tra database livingdocs đã được khởi tạo chưa
    if ($isHealthy) {
        $dbCheck = docker exec livingdocs-mssql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Living_Docs_2026! -C -Q "SET NOCOUNT ON; SELECT DB_ID('livingdocs')" 2>&1
        if ($dbCheck -match 'NULL' -or $dbCheck -notmatch '\d+') {
            Write-Host ">> [TỰ ĐỘNG] Database livingdocs chưa tồn tại. Đang khởi tạo (Init + Tenant demo + Seed)..." -ForegroundColor Yellow
            try {
                Set-Location $infraDir
                .\db.ps1 init
                .\db.ps1 tenant -Code demo -Name "Demo Workspace"
                .\db.ps1 seed -Code demo
                Write-Host ">> [OK] Khởi tạo Database thành công!" -ForegroundColor Green
            } catch {
                Write-Host ">> [CẢNH BÁO] Không thể tự động seed DB: $_" -ForegroundColor Yellow
            }
        } else {
            Write-Host ">> [OK] Database livingdocs đã sẵn sàng!" -ForegroundColor Green
        }
    }

    Write-Host "`n[3/4] Đang đóng gói và khởi động các containers trong Docker (Profile: full)..." -ForegroundColor Yellow
    docker compose --env-file $envFile -f $composeFile --profile full up -d --build
    if ($LASTEXITCODE -ne 0) {
        Write-Host ">> [LỖI] docker compose up gặp sự cố!" -ForegroundColor Red
        exit 1
    }
    Write-Host ">> [OK] Toàn bộ container đã được khởi chạy trong nền!" -ForegroundColor Green

    if (-not $NoFrontend) {
        Write-Host "`n[4/4] Đang mở Frontend Web..." -ForegroundColor Yellow
        if (-not (Test-Path "$frontendDir\node_modules")) {
            Write-Host ">> Đang cài đặt thư viện frontend..." -ForegroundColor Cyan
            npm --prefix $frontendDir install
        }
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle = '[LivingDocs] Frontend (:5173)'; Set-Location '$frontendDir'; npm run dev"
    }

    Write-Host "HỆ THỐNG ĐÃ SẴN SÀNG!" -ForegroundColor Green
    Write-Host "   - Frontend UI:        http://localhost:5173" -ForegroundColor White
    Write-Host "   - Identity Swagger:   http://localhost:8081/swagger-ui.html" -ForegroundColor White
    Write-Host "   - Integration Swagger:http://localhost:8082/swagger-ui.html" -ForegroundColor White
    Write-Host "   - Document Swagger:   http://localhost:8083/swagger-ui.html" -ForegroundColor White
    Write-Host "   - Workflow Swagger:   http://localhost:8084/swagger-ui.html" -ForegroundColor White
    Write-Host "   - Notification Swagger: http://localhost:8086/swagger-ui.html" -ForegroundColor White
    Write-Host "   - Governance Swagger: http://localhost:8085/swagger-ui.html" -ForegroundColor White
    Write-Host "   - AI Engine Docs:     http://localhost:8090/docs" -ForegroundColor White
    if (-not $NoFrontend) {
        Start-Sleep -Seconds 3
        Start-Process "http://localhost:5173"
    }
    exit 0
}

# ------------------------------------------------------------------------------
# 2. CHẾ ĐỘ LOCAL DEV (INFRA DOCKER + MICROSERVICES LOCAL CHẠY CỰC NHANH)
# ------------------------------------------------------------------------------

# Bước 2.1: Dọn dẹp các tiến trình cũ nếu còn treo trên các cổng
Write-Host "`n[1/4] Kiểm tra và giải phóng các port nếu đang bị chiếm dụng..." -ForegroundColor Yellow
$ports = @(8081, 8082, 8083, 8084, 8085, 8086, 8090, 8000, 5173)
foreach ($p in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
    if ($conns) {
        $pids = $conns.OwningProcess | Select-Object -Unique
        foreach ($procId in $pids) {
            if ($procId -gt 0) {
                Write-Host "   -> Tắt tiến trình cũ PID $procId trên cổng $p..." -ForegroundColor DarkGray
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

# Bước 2.2: Khởi động SQL Server, Redis, Kafka
Write-Host "`n[2/4] Khởi động Docker Infra (SQL Server, Redis, Kafka)..." -ForegroundColor Yellow
cd $infraDir
try {
    .\db.ps1 up
} catch {
    Write-Host ">> [CẢNH BÁO] Không thể bật container hạ tầng qua db.ps1. Đang thử chạy docker compose..." -ForegroundColor Yellow
    docker compose --env-file $envFile -f $composeFile up -d mssql redis kafka
}

# Bước 2.3: Định nghĩa danh sách các service cần chạy
$services = @(
    @{
        Name = "Identity Service"
        Port = 8081
        Dir  = $backendDir
        Cmd  = ".\mvnw.cmd spring-boot:run -pl services/identity-service"
        Icon = "🔑"
    },
    @{
        Name = "Integration Service"
        Port = 8082
        Dir  = $backendDir
        Cmd  = ".\mvnw.cmd spring-boot:run -pl services/integration-service"
        Icon = "🔌"
    },
    @{
        Name = "Document Service"
        Port = 8083
        Dir  = $backendDir
        Cmd  = ".\mvnw.cmd spring-boot:run -pl services/document-service"
        Icon = "📄"
    },
    @{
        Name = "Workflow Service"
        Port = 8084
        Dir  = $backendDir
        Cmd  = ".\mvnw.cmd spring-boot:run -pl services/workflow-service"
        Icon = "⚡"
    },
    @{
        Name = "Governance Service"
        Port = 8085
        Dir  = $backendDir
        Cmd  = ".\mvnw.cmd spring-boot:run -pl services/governance-service"
        Icon = "📋"
    },
    @{
        Name = "Notification Service"
        Port = 8086
        Dir  = $backendDir
        Cmd  = ".\mvnw.cmd spring-boot:run -pl services/notification-service"
        Icon = "🔔"
    },
    @{
        Name = "AI Engine"
        Port = 8090
        Dir  = $aiDir
        Cmd  = "& ..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8090 --reload"
        Icon = "🧠"
    }
)

if (-not $NoFrontend) {
    $services += @{
        Name = "Frontend Web"
        Port = 5173
        Dir  = $frontendDir
        Cmd  = "npm run dev"
        Icon = "💻"
    }
}

# Bước 2.4: Khởi chạy từng service
Write-Host "`n[3/4] Đang mở đồng thời $($services.Count) services..." -ForegroundColor Yellow

$hasWT = ($null -ne (Get-Command wt.exe -ErrorAction SilentlyContinue)) -and ($WindowMode -eq "tabs")

if ($hasWT) {
    Write-Host ">> Phát hiện Windows Terminal! Mở tất cả service dưới dạng các Tab trong 1 cửa sổ duy nhất..." -ForegroundColor Cyan
    $first = $true
    foreach ($svc in $services) {
        $title = "$($svc.Icon) $($svc.Name) (:$($svc.Port))"
        $script = "`$host.UI.RawUI.WindowTitle = '$title'; Set-Location '$($svc.Dir)'; $($svc.Cmd)"
        if ($first) {
            Start-Process wt -ArgumentList "-w", "livingdocs", "new-tab", "--title", "`"$title`"", "-d", "`"$($svc.Dir)`"", "powershell", "-NoExit", "-Command", "`"$script`""
            $first = $false
        } else {
            Start-Sleep -Milliseconds 400
            Start-Process wt -ArgumentList "-w", "livingdocs", "new-tab", "--title", "`"$title`"", "-d", "`"$($svc.Dir)`"", "powershell", "-NoExit", "-Command", "`"$script`""
        }
    }
} else {
    Write-Host ">> Mở các service trong các cửa sổ console riêng biệt..." -ForegroundColor Cyan
    foreach ($svc in $services) {
        $title = "[LivingDocs] $($svc.Name) (:$($svc.Port))"
        $script = "`$host.UI.RawUI.WindowTitle = '$title'; Set-Location '$($svc.Dir)'; $($svc.Cmd)"
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "$script"
        Start-Sleep -Milliseconds 300
    }
}

# Bước 2.5: Báo cáo trạng thái và mở trình duyệt
Write-Host "`n[4/4] Hoàn tất lệnh mở hệ thống!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   📌 BẢNG ĐIỀU KHIỂN & ĐƯỜNG DẪN TRUY CẬP HỆ THỐNG:            " -ForegroundColor White
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   💻 Frontend UI:          http://localhost:5173" -ForegroundColor Green
Write-Host "   🔑 Identity Swagger:     http://localhost:8081/swagger-ui.html" -ForegroundColor White
Write-Host "   🔌 Integration Swagger:  http://localhost:8082/swagger-ui.html" -ForegroundColor White
Write-Host "   📄 Document Swagger:     http://localhost:8083/swagger-ui.html" -ForegroundColor White
Write-Host "   ⚡ Workflow Swagger:     http://localhost:8084/swagger-ui.html" -ForegroundColor White
Write-Host "   📋 Governance Swagger:   http://localhost:8085/swagger-ui.html" -ForegroundColor White
Write-Host "   🔔 Notification Swagger: http://localhost:8086/swagger-ui.html" -ForegroundColor White
Write-Host "   🧠 AI Engine Docs:       http://localhost:8090/docs" -ForegroundColor White
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   💡 Mẹo: Khi muốn tắt tất cả các service, chỉ cần gõ: .\stop-all.ps1" -ForegroundColor Yellow

if (-not $NoFrontend) {
    Start-Sleep -Seconds 3
    Start-Process "http://localhost:5173"
}
