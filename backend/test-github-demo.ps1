# ==============================================================================
# LivingDocs - GitHub Real Integration Demo Script
# Repository: https://github.com/silasWorkSpace/HQTCSDL_UTH
# GitHub Repo ID: 1404979837
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   DEMO TÍCH HỢP GITHUB THẬT (silasWorkSpace/HQTCSDL_UTH)        " -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan

$SECRET = "development_webhook_secret_key_123456"
$REPO_FULL_NAME = "silasWorkSpace/HQTCSDL_UTH"
$REPO_GITHUB_ID = 1404979837
$BRANCH = "feature/backend-integration-service"
$CONNECTION_ID = "ebd08c7f-628d-4cd4-a038-4dfd3d7cbfcc"

# ------------------------------------------------------------------------------
# 1. KIỂM TRA / LIÊN KẾT REPOSITORY TRÊN INTEGRATION SERVICE (Port 8082)
# ------------------------------------------------------------------------------
Write-Host "`n[1/4] Kiểm tra danh sách Repository trên Integration Service (Port 8082)..." -ForegroundColor White
$existingRepos = Invoke-RestMethod -Uri "http://localhost:8082/api/v1/repositories" -Method Get
$targetRepo = $existingRepos | Where-Object { $_.githubRepoId -eq $REPO_GITHUB_ID }

if (-not $targetRepo) {
    Write-Host ">> Chưa liên kết, đang gửi request POST /api/v1/repositories..." -ForegroundColor Yellow
    $addBody = @{
        connectionId = $CONNECTION_ID
        githubRepoId = $REPO_GITHUB_ID
        fullName = $REPO_FULL_NAME
        defaultBranch = $BRANCH
    } | ConvertTo-Json

    $targetRepo = Invoke-RestMethod -Uri "http://localhost:8082/api/v1/repositories" -Method Post -Body $addBody -ContentType "application/json; charset=utf-8"
}

Write-Host ">> [OK] Repository đã sẵn sàng!" -ForegroundColor Green
Write-Host "   - Repo ID trong LivingDocs: " $targetRepo.id -ForegroundColor Cyan
Write-Host "   - GitHub Full Name:         " $targetRepo.fullName -ForegroundColor Cyan
Write-Host "   - GitHub Repo ID:           " $targetRepo.githubRepoId -ForegroundColor Cyan
Write-Host "   - Trạng thái kết nối:       " $targetRepo.connectionStatus -ForegroundColor Cyan

$REPO_UUID = $targetRepo.id

# ------------------------------------------------------------------------------
# 2. MÔ PHỎNG SỰ KIỆN WEBHOOK TỪ GITHUB (KÈM CHỮ KÝ HMAC SHA-256)
# ------------------------------------------------------------------------------
Write-Host "`n[2/4] Bắn sự kiện Webhook (Push Event) từ GitHub có chữ ký HMAC SHA-256..." -ForegroundColor White

$commitSha = "bbdcedc9df259eb5339f4a7c062db28bb516104d"
$deliveryId = [Guid]::NewGuid().ToString()

$webhookPayload = @{
    ref = "refs/heads/$BRANCH"
    before = "6d4530b80982305ca7710b65f0ca96ec9697be96"
    after = $commitSha
    repository = @{
        id = $REPO_GITHUB_ID
        name = "HQTCSDL_UTH"
        full_name = $REPO_FULL_NAME
        default_branch = $BRANCH
    }
    pusher = @{
        name = "silasWorkSpace"
        email = "silas@livingdocs.internal"
    }
    sender = @{
        login = "silasWorkSpace"
        id = 242319708
    }
    commits = @(
        @{
            id = $commitSha
            message = "feat(integration): link real github repo silasWorkSpace/HQTCSDL_UTH"
            timestamp = (Get-Date).ToString("o")
            author = @{
                name = "silasWorkSpace"
                email = "silas@livingdocs.internal"
            }
            added = @("backend/services/integration-service/src/main/resources/application.yml")
            modified = @("backend/pom.xml")
            removed = @()
        }
    )
} | ConvertTo-Json -Depth 5 -Compress

# Tính toán HMAC SHA-256
$secretBytes = [System.Text.Encoding]::UTF8.GetBytes($SECRET)
$payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($webhookPayload)
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = $secretBytes
$hashBytes = $hmac.ComputeHash($payloadBytes)
$signature = "sha256=" + [BitConverter]::ToString($hashBytes).Replace("-", "").ToLower()

$headers = @{
    "X-GitHub-Event" = "push"
    "X-GitHub-Delivery" = $deliveryId
    "X-Hub-Signature-256" = $signature
    "Content-Type" = "application/json"
}

$webhookResponse = Invoke-RestMethod -Uri "http://localhost:8082/api/v1/webhooks/github" -Method Post -Body $webhookPayload -Headers $headers
Write-Host ">> [OK] Webhook đã được Integration Service xử lý thành công!" -ForegroundColor Green
Write-Host "   - HTTP Status:        " $webhookResponse.status -ForegroundColor Cyan
Write-Host "   - Event ID (CSDL):    " $webhookResponse.eventId -ForegroundColor Cyan
Write-Host "   - Thời gian xử lý:    " ($webhookResponse.processingTimeMs.ToString() + " ms (SLA < 3000ms)") -ForegroundColor Cyan
Write-Host "   - Phát hiện trùng lặp:" $webhookResponse.isDuplicate -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# 3. TRUY VẤN LỊCH SỬ SOURCE EVENT TỪ CSDL QUA API
# ------------------------------------------------------------------------------
Write-Host "`n[3/4] Kiểm tra sự kiện đã lưu trong CSDL LivingDocs (ws_demo.source_event)..." -ForegroundColor White
$events = Invoke-RestMethod -Uri "http://localhost:8082/api/v1/repositories/$REPO_UUID/events" -Method Get
Write-Host ">> [OK] Đã ghi nhận tổng cộng $($events.Count) sự kiện cho kho ${REPO_FULL_NAME}:" -ForegroundColor Green
foreach ($evt in $events) {
    Write-Host "   - [$($evt.eventType)] Ref: $($evt.githubRef) | Delivery: $($evt.deliveryId) | Lúc: $($evt.receivedAt)" -ForegroundColor Yellow
}

# ------------------------------------------------------------------------------
# 4. CHẠY AST ANALYZER BÓC TÁCH MÃ NGUỒN THẬT CỦA REPOSITORY
# ------------------------------------------------------------------------------
Write-Host "`n[4/4] AI Engine AST Analyzer quét mã nguồn thực tế của Repository..." -ForegroundColor White
$javaFile = "../services/document-service/src/main/java/com/livingdocs/document/service/DocumentService.java"
$astCmd = "from app.ast_analyzer.analyzer import analyze; entities = analyze(['$javaFile'], 'java', '$commitSha'); print(f'FOUND_{len(entities)}'); [print(f'{e.kind}|{e.name}|{e.signature}') for e in entities[:6]]"

$pushd = Get-Location
try {
    Set-Location (Join-Path $PSScriptRoot "ai-engine")
    $astOutput = python -c "$astCmd" 2>&1
} finally {
    Set-Location $pushd
}
$lines = $astOutput -split "`r?`n"
$foundLine = $lines | Where-Object { $_ -like "FOUND_*" }
$count = $foundLine.Replace("FOUND_", "")

Write-Host ">> [OK] Bóc tách AST thành công! Tìm thấy $count thực thể mã nguồn trong tệp:" -ForegroundColor Green
Write-Host "   services/document-service/.../DocumentService.java" -ForegroundColor Cyan
Write-Host "   Các Code Entity tiêu biểu được trích xuất:" -ForegroundColor White
foreach ($line in ($lines | Where-Object { $_ -notlike "FOUND_*" -and $_ -ne "" })) {
    $parts = $line -split "\|"
    if ($parts.Count -ge 3) {
        Write-Host "   - [$($parts[0])] $($parts[1]): $($parts[2])" -ForegroundColor Gray
    }
}

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "   HOÀN THÀNH TOÀN DIỆN DEMO GITHUB VỚI REPOSITORY THỰC TẾ!      " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
