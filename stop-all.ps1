<#
.SYNOPSIS
  Tắt sạch toàn bộ các Services của LivingDocs chỉ với 1 lệnh duy nhất.
.DESCRIPTION
  Dừng tất cả các tiến trình đang chiếm port của LivingDocs:
  - 8081 (Identity Service)
  - 8082 (Integration Service)
  - 8083 (Document Service)
  - 8084 (Workflow Service)
  - 8085 (Governance Service)
  - 8086 (Notification Service)
  - 8000 (AI Engine)
  - 5173 (Frontend)
  Nếu truyền thêm -Docker hoặc -All, script sẽ tắt luôn cả Docker containers.
.EXAMPLE
  .\stop-all.ps1
  .\stop-all.ps1 -Docker
#>
param(
    [switch]$Docker,
    [switch]$All
)

$ErrorActionPreference = "SilentlyContinue"
$root = $PSScriptRoot
$composeFile = Join-Path $root "backend\infra\docker\docker-compose.yml"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   🛑 LIVINGDOCS - DỪNG TẤT CẢ DỊCH VỤ                           " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$servicePorts = @(
    @{ Port = 8081; Name = "Identity Service" },
    @{ Port = 8082; Name = "Integration Service" },
    @{ Port = 8083; Name = "Document Service" },
    @{ Port = 8084; Name = "Workflow Service" },
    @{ Port = 8085; Name = "Governance Service" },
    @{ Port = 8086; Name = "Notification Service" },
    @{ Port = 8000; Name = "AI Engine" },
    @{ Port = 5173; Name = "Frontend Vite" }
)

Write-Host "`n[1/2] Đang tắt các tiến trình ứng dụng đang chạy..." -ForegroundColor Yellow
$stoppedCount = 0

foreach ($svc in $servicePorts) {
    $p = $svc.Port
    $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
    if ($conns) {
        $pids = $conns.OwningProcess | Select-Object -Unique
        foreach ($procId in $pids) {
            if ($procId -gt 0) {
                Write-Host "   -> Đang dừng $($svc.Name) (Port $p, PID $procId)..." -ForegroundColor White
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                $stoppedCount++
            }
        }
    }
}

if ($stoppedCount -eq 0) {
    Write-Host ">> Không có tiến trình cục bộ nào đang chạy trên các cổng dịch vụ." -ForegroundColor DarkGray
} else {
    Write-Host ">> [OK] Đã tắt thành công $stoppedCount tiến trình." -ForegroundColor Green
}

# 2. Tắt Docker containers nếu được yêu cầu
if ($Docker -or $All) {
    Write-Host "`n[2/2] Đang dừng Docker containers..." -ForegroundColor Yellow
    docker compose -f $composeFile down
    Write-Host ">> [OK] Đã dừng các containers Docker." -ForegroundColor Green
} else {
    Write-Host "`n[2/2] Giữ lại Docker infra (SQL Server, Redis, Kafka) để dùng tiếp." -ForegroundColor DarkGray
    Write-Host "      (Nếu muốn tắt cả Docker, hãy chạy: .\stop-all.ps1 -Docker)" -ForegroundColor DarkGray
}

Write-Host "`n✅ ĐÃ DỪNG TOÀN BỘ CÁC SERVICE THÀNH CÔNG!" -ForegroundColor Green
