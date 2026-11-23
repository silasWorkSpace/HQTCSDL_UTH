<#
.SYNOPSIS
  Dừng các cửa sổ service do start-all.ps1 tạo; tùy chọn dừng Docker containers.
.EXAMPLE
  .\stop-all.ps1
  .\stop-all.ps1 -Docker
#>
[CmdletBinding()]
param(
    [switch]$Docker,
    [switch]$All
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$stateFile = Join-Path $root 'backend\.local-run\start-all.json'
$composeFile = Join-Path $root 'backend\infra\docker\docker-compose.yml'
$envFile = Join-Path $root 'backend\infra\docker\.env'
$envExample = Join-Path $root 'backend\infra\docker\.env.example'

if (Test-Path -LiteralPath $stateFile) {
    $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    $remaining = [System.Collections.Generic.List[object]]::new()

    foreach ($service in @($state.services)) {
        $processId = [int]$service.pid
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if (-not $process) {
            Write-Host "Đã dừng: $($service.name)" -ForegroundColor DarkGray
            continue
        }

        $expectedStart = [DateTime]::Parse($service.processStartedAt).ToUniversalTime()
        $actualStart = $process.StartTime.ToUniversalTime()
        if ([Math]::Abs(($actualStart - $expectedStart).TotalSeconds) -gt 30) {
            Write-Host "Bỏ qua PID $processId vì process hiện tại không khớp lần chạy LivingDocs đã ghi." -ForegroundColor Yellow
            $remaining.Add($service)
            continue
        }

        & taskkill.exe /PID $processId /T /F | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Đã dừng: $($service.name) (PID $processId và process con)" -ForegroundColor Green
        }
        else {
            Write-Host "Không dừng được PID $processId. Có thể cửa sổ đã tự thoát." -ForegroundColor Yellow
        }
    }

    if ($remaining.Count -eq 0) {
        Remove-Item -LiteralPath $stateFile -Force
    }
    else {
        $state.services = @($remaining.ToArray())
        $state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $stateFile -Encoding UTF8
    }
}
else {
    Write-Host 'Không có process local nào được start-all.ps1 ghi nhận; không kill process chỉ dựa trên port.' -ForegroundColor DarkGray
}

if ($Docker -or $All) {
    if (-not (Test-Path -LiteralPath $envFile)) {
        throw "Không tìm thấy $envFile để dừng Docker Compose."
    }
    & docker compose --env-file $envExample --env-file $envFile -f $composeFile down
    if ($LASTEXITCODE -ne 0) { throw 'docker compose down thất bại.' }
    Write-Host 'Đã dừng Docker containers (volume dữ liệu được giữ nguyên).' -ForegroundColor Green
}
else {
    Write-Host 'Docker infra vẫn chạy để lần test sau khởi động nhanh hơn. Dùng .\stop-all.ps1 -Docker để dừng containers.' -ForegroundColor DarkGray
}
