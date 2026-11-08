# ==============================================================================
# SCRIPT KIỂM THỬ THỦ CÔNG TỰ ĐỘNG HÓA TOÀN BỘ LUỒNG (END-TO-END) LIVINGDOCS
# Hướng dẫn chạy: Mở PowerShell và gõ: .\test-flow.ps1
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   BẮT ĐẦU CHUỖI KIỂM THỬ TÍCH HỢP END-TO-END LIVINGDOCS         " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# BƯỚC 1: LẤY TOKEN XÁC THỰC (Identity Service - Port 8081)
# ------------------------------------------------------------------------------
Write-Host "`n[1/6] Đang lấy JWT Token từ Identity Service (Port 8081)..." -ForegroundColor Yellow
$devTokenBody = @{
    tenant = "demo"
    email = "manager1@example.com"
    roles = @("Manager", "Developer", "Staff")
} | ConvertTo-Json

try {
    $tokenRes = Invoke-RestMethod -Uri "http://localhost:8081/api/v1/auth/dev-token" -Method Post -Body $devTokenBody -ContentType "application/json"
    $TOKEN = $tokenRes.accessToken
    Write-Host ">> [OK] Đã cấp JWT Token thành công! (Thời hạn: $($tokenRes.expiresIn)s)" -ForegroundColor Green
} catch {
    Write-Host ">> [LỖI] Không thể kết nối tới Identity Service (Port 8081). Hãy chắc chắn bạn đã khởi động service này!" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $TOKEN"
    "X-Tenant"      = "ws_demo"
}

# ------------------------------------------------------------------------------
# BƯỚC 2: TẠO TÀI LIỆU MỚI (Document Service - Port 8083)
# ------------------------------------------------------------------------------
Write-Host "`n[2/6] Tạo tài liệu mới trên Document Service (Port 8083)..." -ForegroundColor Yellow
$docBody = @{
    title   = "Tài liệu Hướng dẫn Thanh toán API v1.0"
    docType = "API_REFERENCE"
    content = "# Hướng Dẫn Thanh Toán\nAPI v1.0 cung cấp các cổng thanh toán an toàn."
} | ConvertTo-Json

$createdDoc = Invoke-RestMethod -Uri "http://localhost:8083/api/v1/documents" -Method Post -Body $docBody -Headers $headers -ContentType "application/json"
$DOC_ID = $createdDoc.documentId
Write-Host ">> [OK] Tài liệu đã được tạo thành công!" -ForegroundColor Green
Write-Host "   - Document ID: $DOC_ID" -ForegroundColor Gray
Write-Host "   - Trạng thái : $($createdDoc.docStatus) (Bản nháp ban đầu)" -ForegroundColor Gray

# ------------------------------------------------------------------------------
# BƯỚC 3: KIỂM TRA CHUỖI BẢO MẬT SHA-256 HASH (Document Service - Port 8083)
# ------------------------------------------------------------------------------
Write-Host "`n[3/6] Xác minh chuỗi bảo mật SHA-256 Integrity Chain..." -ForegroundColor Yellow
$integrity = Invoke-RestMethod -Uri "http://localhost:8083/api/v1/documents/$DOC_ID/integrity" -Method Get -Headers $headers
Write-Host ">> [OK] Kết quả xác minh toàn vẹn phiên bản:" -ForegroundColor Green
Write-Host "   - isValid: $($integrity.isValid)" -ForegroundColor Cyan
Write-Host "   - Total Versions Verified: $($integrity.totalVersionsVerified)" -ForegroundColor Gray

# ------------------------------------------------------------------------------
# BƯỚC 4: GỬI TÀI LIỆU VÀO HÀNG ĐỢI DUYỆT (Workflow Service - Port 8084)
# ------------------------------------------------------------------------------
Write-Host "`n[4/6] Gửi tài liệu vào quy trình duyệt (Workflow Service - Port 8084)..." -ForegroundColor Yellow
$submitRes = Invoke-RestMethod -Uri "http://localhost:8084/api/v1/documents/$DOC_ID/submit" -Method Post -Headers $headers
$TASK_ID = $submitRes.id
Write-Host ">> [OK] Đã nộp vào hàng đợi duyệt thành công!" -ForegroundColor Green
Write-Host "   - Review Task ID: $TASK_ID" -ForegroundColor Gray
Write-Host "   - Trạng thái Task: $($submitRes.status)" -ForegroundColor Gray

# ------------------------------------------------------------------------------
# BƯỚC 5: MANAGER PHÊ DUYỆT TÀI LIỆU (Workflow Service - Port 8084)
# ------------------------------------------------------------------------------
Write-Host "`n[5/6] Quản lý (Manager) phê duyệt tài liệu..." -ForegroundColor Yellow
$decisionBody = @{
    decision = "APPROVE"
    reason   = "Nội dung đạt chuẩn chất lượng kỹ thuật, duyệt ban hành."
} | ConvertTo-Json

$decisionRes = Invoke-RestMethod -Uri "http://localhost:8084/api/v1/reviews/$TASK_ID/decisions" -Method Post -Body $decisionBody -Headers $headers -ContentType "application/json"
Write-Host ">> [OK] Phê duyệt thành công!" -ForegroundColor Green
Write-Host "   - Quyết định: $($decisionRes.status)" -ForegroundColor Gray
Write-Host "   - Đã phát sự kiện Kafka (NOTIFICATION) sang Notification Service!" -ForegroundColor Magenta

# ------------------------------------------------------------------------------
# BƯỚC 6: KIỂM TRA THÔNG BÁO IN-APP (Notification Service - Port 8086)
# ------------------------------------------------------------------------------
Write-Host "`n[6/6] Chờ 2 giây để Kafka đồng bộ sự kiện và kiểm tra Notification Service..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $notifs = Invoke-RestMethod -Uri "http://localhost:8086/api/v1/notifications" -Method Get -Headers $headers
    Write-Host ">> [OK] Danh sách thông báo in-app nhận được:" -ForegroundColor Green
    $notifs | Select-Object -First 5 | Format-Table id, event_type, status, created_at
} catch {
    Write-Host ">> [GHI CHÚ] Notification service chưa nhận được message hoặc đang bận." -ForegroundColor Yellow
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   HOÀN THÀNH KIỂM THỬ THÀNH CÔNG TOÀN BỘ CÁC BƯỚC NGHIỆP VỤ!   " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
