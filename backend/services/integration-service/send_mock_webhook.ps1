<#
.SYNOPSIS
  Script gửi webhook GitHub giả lập kèm chữ ký HMAC SHA-256 để kiểm thử integration-service cục bộ.

.EXAMPLE
  .\send_mock_webhook.ps1 -Fixture "pr_opened"
  .\send_mock_webhook.ps1 -Fixture "push_commit"
  .\send_mock_webhook.ps1 -Fixture "bot"
#>
param(
    [ValidateSet("pr_opened", "push_commit", "bot")]
    [string]$Fixture = "pr_opened",

    [string]$Url = "http://localhost:8082/api/v1/webhooks/github",

    [string]$Secret = "development_webhook_secret_key_123456",

    [string]$Tenant = "demo",

    [string]$DeliveryId = ""
)

$scriptDir = $PSScriptRoot
$fixtureFile = switch ($Fixture) {
    "pr_opened"   { Join-Path $scriptDir "src\test\resources\fixtures\webhook_pr_opened.json" }
    "push_commit" { Join-Path $scriptDir "src\test\resources\fixtures\webhook_push_commit.json" }
    "bot"         { Join-Path $scriptDir "src\test\resources\fixtures\webhook_livingdocs_bot.json" }
}

if (-not (Test-Path $fixtureFile)) {
    Write-Error "Không tìm thấy file fixture: $fixtureFile"
    exit 1
}

$rawBody = Get-Content -Raw -Encoding UTF8 $fixtureFile
if ([string]::IsNullOrWhiteSpace($DeliveryId)) {
    $DeliveryId = [guid]::NewGuid().ToString()
}

$eventType = if ($Fixture -eq "push_commit") { "push" } else { "pull_request" }

# 1. Tính toán chữ ký HMAC SHA-256
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($Secret)
$hashBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($rawBody))
$hexSignature = ($hashBytes | ForEach-Object { "{0:x2}" -f $_ }) -join ""
$signatureHeader = "sha256=$hexSignature"

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "GỬI MOCK GITHUB WEBHOOK" -ForegroundColor Cyan
Write-Host "  URL:         $Url"
Write-Host "  Fixture:     $Fixture ($fixtureFile)"
Write-Host "  Event:       $eventType"
Write-Host "  Delivery-ID: $DeliveryId"
Write-Host "  Tenant:      $Tenant"
Write-Host "  Signature:   $signatureHeader"
Write-Host "====================================================================" -ForegroundColor Cyan

$headers = @{
    "Content-Type"          = "application/json; charset=utf-8"
    "X-Hub-Signature-256"   = $signatureHeader
    "X-GitHub-Event"        = $eventType
    "X-GitHub-Delivery"     = $DeliveryId
    "X-Tenant-Id"           = $Tenant
}

$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $response = Invoke-RestMethod -Uri $Url -Method Post -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($rawBody))
    $sw.Stop()
    Write-Host ">> [SUCCESS] Phản hồi HTTP 200/202 trong $($sw.ElapsedMilliseconds) ms:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 5 | Write-Host
}
catch {
    $sw.Stop()
    Write-Host ">> [ERROR] Lỗi khi gửi request ($($sw.ElapsedMilliseconds) ms):" -ForegroundColor Red
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $respBody = $reader.ReadToEnd()
        Write-Host "Response Body: $respBody" -ForegroundColor Yellow
    } else {
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}
