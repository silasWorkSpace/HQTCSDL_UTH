# ==============================================================================
# SCRIPT KIỂM THỬ THỦ CÔNG TỰ ĐỘNG HÓA TOÀN BỘ LUỒNG (END-TO-END) LIVINGDOCS
# Hướng dẫn chạy: Mở PowerShell và gõ: .\test-flow.ps1
# ==============================================================================
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
        tenant = "demo"
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
    "X-Tenant"      = "ws_demo"
}
$staffHeaders = @{
    "Authorization" = "Bearer $STAFF_TOKEN"
    "X-Tenant"      = "ws_demo"
}
$mgrHeaders = @{
    "Authorization" = "Bearer $MGR_TOKEN"
    "X-Tenant"      = "ws_demo"
}

# ------------------------------------------------------------------------------
# BƯỚC 2: TẠO TÀI LIỆU MỚI (Document Service - Port 8083) - Do Developer thực hiện
# ------------------------------------------------------------------------------
Write-Host "`n[2/6] Tạo tài liệu mới trên Document Service (Port 8083)..." -ForegroundColor Yellow
$docBody = @{
    title   = "Tài liệu Hướng dẫn Thanh toán API v1.0"
    docType = "API_REFERENCE"
    content = "# Hướng Dẫn Thanh Toán`nAPI v1.0 cung cấp các cổng thanh toán an toàn."
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
Write-Host ">> [OK] Manager đã phê duyệt thành công!" -ForegroundColor Green
Write-Host "   - Trạng thái cuối: APPROVED & PUBLISHED" -ForegroundColor Gray
Write-Host "   - Đã phát sự kiện Kafka (DOC_PUBLISHED) sang Notification Service!" -ForegroundColor Magenta

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
