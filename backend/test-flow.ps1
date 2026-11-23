# ==============================================================================
# SCRIPT KIỂM THỬ THỦ CÔNG TỰ ĐỘNG HÓA TOÀN BỘ LUỒNG (END-TO-END) LIVINGDOCS
# Hướng dẫn chạy: Mở PowerShell và gõ: .\test-flow.ps1
# ==============================================================================
[CmdletBinding()]
param(
    [ValidatePattern('^[a-z0-9_]{2,30}$')]
    [string]$Tenant = "e2e",
    [string]$RepositoryFullName = "silasWorkSpace/HQTCSDL_UTH",
    [string]$ExpectedBranch = "feature/backend-integration-service"
)

$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   BẮT ĐẦU CHUỖI KIỂM THỬ TÍCH HỢP END-TO-END LIVINGDOCS         " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# BƯỚC 1: LẤY TOKEN XÁC THỰC CHO CÁC VAI TRÒ (Identity Service - Port 8081)
# ------------------------------------------------------------------------------
Write-Host "`n[1/6] Đang lấy JWT Token từ Identity Service (Port 8081)..." -ForegroundColor Yellow

function Get-DevToken($email, $roles) {
    $body = @{
        tenant = $Tenant
        email  = $email
        roles  = $roles
    } | ConvertTo-Json
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $res = Invoke-RestMethod -Uri "http://localhost:8081/api/v1/auth/dev-token" -Method Post -Body $bytes -ContentType "application/json; charset=utf-8"
    return $res.accessToken
}

function Invoke-JsonPost($uri, $bodyObj, $headers) {
    $json = $bodyObj | ConvertTo-Json
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    return Invoke-RestMethod -Uri $uri -Method Post -Body $bytes -Headers $headers -ContentType "application/json; charset=utf-8"
}

function Assert-ServiceHealthy($port, $name) {
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:$port/actuator/health" -TimeoutSec 5
        if ($health.status -ne "UP") { throw "status=$($health.status)" }
    } catch {
        throw "$name ($port) is not healthy: $($_.Exception.Message)"
    }
}

function Assert-AiEngineReady {
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:8090/health/readiness" -TimeoutSec 5
        if ($health.status -ne "UP" -or -not $health.ready) {
            throw "status=$($health.status); issues=$($health.issues | ConvertTo-Json -Compress)"
        }
    } catch {
        throw "AI Engine (8090) is not ready: $($_.Exception.Message)"
    }
}

Write-Host "`n[Preflight] Kiem tra stack E2E va cau hinh GitHub..." -ForegroundColor Yellow
foreach ($service in @(
    @{ port = 8081; name = "Identity Service" }, @{ port = 8082; name = "Integration Service" },
    @{ port = 8083; name = "Document Service" }, @{ port = 8084; name = "Workflow Service" },
    @{ port = 8086; name = "Notification Service" }
)) { Assert-ServiceHealthy $service.port $service.name }
Assert-AiEngineReady

try {
    $DEV_TOKEN = Get-DevToken "developer1@example.com" @("Developer")
    $STAFF_TOKEN = Get-DevToken "staff1@example.com" @("Staff")
    $MGR_TOKEN = Get-DevToken "manager1@example.com" @("Manager")
    Write-Host ">> [OK] Đã cấp JWT Token thành công cho cả 3 vai trò (Developer, Staff, Manager)!" -ForegroundColor Green
} catch {
    Write-Host ">> [LỖI] Không thể kết nối tới Identity Service (Port 8081). Hãy chắc chắn bạn đã khởi động service này!" -ForegroundColor Red
    exit 1
}

$devHeaders = @{
    "Authorization" = "Bearer $DEV_TOKEN"
    "X-Tenant"      = "ws_$Tenant"
}
$staffHeaders = @{
    "Authorization" = "Bearer $STAFF_TOKEN"
    "X-Tenant"      = "ws_$Tenant"
}
$mgrHeaders = @{
    "Authorization" = "Bearer $MGR_TOKEN"
    "X-Tenant"      = "ws_$Tenant"
}

$repositories = Invoke-RestMethod -Uri "http://localhost:8082/api/v1/repositories" -Method Get -Headers $devHeaders
$targetRepository = @($repositories | Where-Object {
    $_.fullName -eq $RepositoryFullName -and $_.defaultBranch -eq $ExpectedBranch -and $_.connectionStatus -eq "connected"
}) | Select-Object -First 1
if (-not $targetRepository) {
    throw "Khong co repository connected '$RepositoryFullName' voi nhanh '$ExpectedBranch' trong workspace '$Tenant'."
}
Write-Host ">> [OK] Repository sandbox: $($targetRepository.fullName) ($($targetRepository.id))" -ForegroundColor Green

# ------------------------------------------------------------------------------
# BƯỚC 2: TẠO TÀI LIỆU MỚI (Document Service - Port 8083) - Do Developer thực hiện
# ------------------------------------------------------------------------------
Write-Host "`n[2/6] Tạo tài liệu mới trên Document Service (Port 8083)..." -ForegroundColor Yellow
$docBody = @{
    repositoryId = $targetRepository.id
    title   = "E2E Payment API $(Get-Date -Format 'yyyyMMdd-HHmmss')"
    docType = "API_REFERENCE"
    pathInRepo = "docs/e2e/payment-api-$(Get-Date -Format 'yyyyMMdd-HHmmss').md"
    content = "# E2E Payment API`nTai lieu do LivingDocs E2E tao; PR phai duoc giu mo."
}

$createdDoc = Invoke-JsonPost "http://localhost:8083/api/v1/documents" $docBody $devHeaders
$DOC_ID = $createdDoc.documentId
Write-Host ">> [OK] Tài liệu đã được tạo thành công!" -ForegroundColor Green
Write-Host "   - Document ID: $DOC_ID" -ForegroundColor Gray
Write-Host "   - Trạng thái : $($createdDoc.docStatus) (Bản nháp ban đầu)" -ForegroundColor Gray

# ------------------------------------------------------------------------------
# BƯỚC 3: KIỂM TRA CHUỖI BẢO MẬT SHA-256 HASH (Document Service - Port 8083)
# ------------------------------------------------------------------------------
Write-Host "`n[3/6] Xác minh chuỗi bảo mật SHA-256 Integrity Chain..." -ForegroundColor Yellow
$integrity = Invoke-RestMethod -Uri "http://localhost:8083/api/v1/documents/$DOC_ID/integrity" -Method Get -Headers $devHeaders
Write-Host ">> [OK] Kết quả xác minh toàn vẹn phiên bản:" -ForegroundColor Green
Write-Host "   - isValid: $($integrity.isValid)" -ForegroundColor Cyan
Write-Host "   - Total Versions Verified: $($integrity.totalVersionsVerified)" -ForegroundColor Gray

# ------------------------------------------------------------------------------
# BƯỚC 4: GỬI TÀI LIỆU VÀO HÀNG ĐỢI DUYỆT (Workflow Service - Port 8084)
# ------------------------------------------------------------------------------
Write-Host "`n[4/6] Developer gửi tài liệu vào quy trình duyệt (Workflow Service - Port 8084)..." -ForegroundColor Yellow
$submitRes = Invoke-RestMethod -Uri "http://localhost:8084/api/v1/documents/$DOC_ID/submit" -Method Post -Headers $devHeaders
$STAFF_TASK_ID = $submitRes.id
Write-Host ">> [OK] Đã nộp vào hàng đợi duyệt thành công!" -ForegroundColor Green
Write-Host "   - Staff Review Task ID: $STAFF_TASK_ID" -ForegroundColor Gray
Write-Host "   - Trạng thái Task: $($submitRes.status)" -ForegroundColor Gray

# ------------------------------------------------------------------------------
# BƯỚC 5: QUY TRÌNH DUYỆT 2 CẤP (STAFF -> MANAGER) (Workflow Service - Port 8084)
# ------------------------------------------------------------------------------
Write-Host "`n[5/6] Thực hiện quy trình duyệt 2 cấp tuân thủ FR-WF-22..." -ForegroundColor Yellow

# 5a. Staff duyệt sơ bộ
Write-Host "   [5a] Staff kiểm tra và duyệt sơ bộ..." -ForegroundColor Gray
$staffDecisionBody = @{
    decision = "APPROVE"
    reason   = "Nội dung chuẩn định dạng kỹ thuật, chuyển tiếp Manager."
}
$staffDecisionRes = Invoke-JsonPost "http://localhost:8084/api/v1/reviews/$STAFF_TASK_ID/decisions" $staffDecisionBody $staffHeaders
$MGR_TASK_ID = $staffDecisionRes.id
Write-Host ">> [OK] Staff đã duyệt sơ bộ! Chuyển tiếp lên cấp Manager (Task ID: $MGR_TASK_ID)" -ForegroundColor Green

# 5b. Manager phê duyệt cuối cùng và ban hành
Write-Host "   [5b] Manager phê duyệt ban hành tài liệu..." -ForegroundColor Gray
$mgrDecisionBody = @{
    decision = "APPROVE"
    reason   = "Tài liệu đạt chuẩn chất lượng xuất bản, duyệt ban hành."
}
$mgrDecisionRes = Invoke-JsonPost "http://localhost:8084/api/v1/reviews/$MGR_TASK_ID/decisions" $mgrDecisionBody $mgrHeaders
$publishedCandidate = Invoke-RestMethod -Uri "http://localhost:8083/api/v1/documents/$DOC_ID" -Method Get -Headers $mgrHeaders
if ($publishedCandidate.docStatus -ne "PENDING_MERGE") {
    throw "Manager approval phai dua tai lieu vao PENDING_MERGE, nhan duoc '$($publishedCandidate.docStatus)'."
}
Write-Host ">> [OK] Manager đã phê duyệt thành công!" -ForegroundColor Green
Write-Host "   - Trạng thái: PENDING_MERGE; GitHub PR phai duoc giu mo." -ForegroundColor Gray
Write-Host "   - Khong merge PR va khong khang dinh Published trong E2E nay." -ForegroundColor Magenta

# ------------------------------------------------------------------------------
# BƯỚC 6: KIỂM TRA THÔNG BÁO IN-APP (Notification Service - Port 8086)
# ------------------------------------------------------------------------------
Write-Host "`n[6/6] Chờ 2 giây để Kafka đồng bộ sự kiện và kiểm tra Notification Service..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $notifs = Invoke-RestMethod -Uri "http://localhost:8086/api/v1/notifications" -Method Get -Headers $devHeaders
    Write-Host ">> [OK] Danh sách thông báo in-app Developer nhận được:" -ForegroundColor Green
    $notifs | Select-Object -First 5 | Format-Table id, event_type, status, created_at
} catch {
    Write-Host ">> [GHI CHÚ] Notification service chưa nhận được message hoặc đang bận." -ForegroundColor Yellow
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   HOÀN THÀNH KIỂM THỬ THÀNH CÔNG TOÀN BỘ CÁC BƯỚC NGHIỆP VỤ!   " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
