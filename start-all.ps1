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
$composeFile = Join-Path $infraDir "docker\docker-compose.yml"
$aiDir       = Join-Path $backendDir "ai-engine"
$frontendDir = Join-Path $root "frontend"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "    LIVINGDOCS - KHỞI ĐỘNG HỆ THỐNG    " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# 1. NẾU CHỌN CHẾ ĐỘ DOCKER FULL (-Docker)
# ------------------------------------------------------------------------------
if ($Docker) {
    Write-Host "`n[1/2] Đang khởi động toàn bộ services trong Docker Compose (Profile: full)..." -ForegroundColor Yellow
    docker compose -f $composeFile --profile full up -d --build
    if ($LASTEXITCODE -ne 0) {
        Write-Host ">> [LỖI] docker compose up gặp sự cố!" -ForegroundColor Red
        exit 1
    }
    Write-Host ">> [OK] Toàn bộ container đã được khởi chạy trong nền!" -ForegroundColor Green

    if (-not $NoFrontend) {
        Write-Host "`n[2/2] Đang mở Frontend Web..." -ForegroundColor Yellow
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle = '[LivingDocs] Frontend (:5173)'; Set-Location '$frontendDir'; npm run dev"
    }

    Write-Host "HỆ THỐNG ĐÃ SẴN SÀNG!" -ForegroundColor Green
    Write-Host "   - Frontend UI:        http://localhost:5173" -ForegroundColor White
    Write-Host "   - Identity Swagger:   http://localhost:8081/swagger-ui.html" -ForegroundColor White
    Write-Host "   - Integration Swagger:http://localhost:8082/swagger-ui.html" -ForegroundColor White
    Write-Host "   - Document Swagger:   http://localhost:8083/swagger-ui.html" -ForegroundColor White
    Write-Host "   - Workflow Swagger:   http://localhost:8084/swagger-ui.html" -ForegroundColor White
    Write-Host "   - Notification Swagger: http://localhost:8086/swagger-ui.html" -ForegroundColor White
    Write-Host "   - AI Engine Docs:     http://localhost:8000/docs" -ForegroundColor White
    Start-Process "http://localhost:5173"
    exit 0
}

# ------------------------------------------------------------------------------
# 2. CHẾ ĐỘ LOCAL DEV (INFRA DOCKER + MICROSERVICES LOCAL CHẠY CỰC NHANH)
# ------------------------------------------------------------------------------

# Bước 2.1: Dọn dẹp các tiến trình cũ nếu còn treo trên các cổng
Write-Host "`n[1/4] Kiểm tra và giải phóng các port nếu đang bị chiếm dụng..." -ForegroundColor Yellow
$ports = @(8081, 8082, 8083, 8084, 8085, 8086, 8000, 5173)
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
    docker compose -f $composeFile up -d mssql redis kafka
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
        Name = "Notification Service"
        Port = 8086
        Dir  = $backendDir
        Cmd  = ".\mvnw.cmd spring-boot:run -pl services/notification-service"
        Icon = "🔔"
    },
    @{
        Name = "AI Engine"
        Port = 8000
        Dir  = $aiDir
        Cmd  = "& ..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000 --reload"
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
Write-Host "   🔔 Notification Swagger: http://localhost:8086/swagger-ui.html" -ForegroundColor White
Write-Host "   🧠 AI Engine Docs:       http://localhost:8000/docs" -ForegroundColor White
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   💡 Mẹo: Khi muốn tắt tất cả các service, chỉ cần gõ: .\stop-all.ps1" -ForegroundColor Yellow

if (-not $NoFrontend) {
    Start-Sleep -Seconds 3
    Start-Process "http://localhost:5173"
}
