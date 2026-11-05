# LivingDocs — Integration Service

**Tác giả phụ trách:** Hiếu aka silas (Integration Subsystem Lead)  
**Cổng dịch vụ (Port):** `8082`  
**Công nghệ:** Java 21 LTS, Spring Boot 3.3.5, Spring JDBC (SQL Server 2022), Spring Kafka, Spring Data Redis, BouncyCastle, JJWT, Springdoc OpenAPI.

---

## 1. Giới thiệu chức năng

Dịch vụ `integration-service` chịu trách nhiệm toàn bộ các giao tiếp giữa hệ thống **LivingDocs** và nền tảng **GitHub**:
1. **GitHub App Connection (GH-02, GH-03)**:
   - Tiếp nhận `installation_id` từ GitHub App Setup URL.
   - Sinh JWT cho GitHub App (RS256, thời hạn 10 phút) từ Private Key.
   - Lấy Installation Access Token, lưu đệm trong Redis với TTL 50 phút.
   - Mã hóa đối xứng Access Token bằng thuật toán **AES-GCM 256-bit** (NFR-SEC-04) trước khi lưu vào bảng `github_connection`.
2. **Quản lý Repository (GH-03, GH-04, GH-05, GH-07)**:
   - Thêm kho mã nguồn vào Workspace.
   - Xem danh sách và chi tiết trạng thái đồng bộ, default branch.
   - Ngắt kết nối kho lưu trữ an toàn: Thực thi Stored Procedure CSDL `sp_disconnect_repository` để dọn sạch `code_entity`, `embedding` và thu hồi token.
   - Xem timeline sự kiện PR/commit đã tiếp nhận.
3. **GitHub Webhook Ingestion (GH-08, DR-14, NFR-SEC-06, NFR-REL-05, NFR-PERF-06)**:
   - Tiếp nhận sự kiện Webhook tại `POST /api/v1/webhooks/github`.
   - Xác thực chữ ký `X-Hub-Signature-256` qua HMAC SHA-256 (Constant-time check chống Timing Attack).
   - Chặn vòng lặp PR do chính LivingDocs Bot tạo (`created_by_livingdocs = 1` - DR-14).
   - Gọi Stored Procedure `sp_ingest_source_event` (khử trùng lặp theo `delivery_id`, bảo đảm tính Idempotent).
   - Bắn sự kiện bất đồng bộ sang Apache Kafka topic `ld.source-events` theo envelope chuẩn.
   - Phản hồi HTTP 202 trong vòng < 3 giây (NFR-PERF-06).

---

## 2. Cấu hình biến môi trường

| Biến môi trường | Mặc định | Mô tả |
|---|---|---|
| `SERVER_PORT` | `8082` | Cổng HTTP của service |
| `SPRING_DATASOURCE_URL` | `jdbc:sqlserver://localhost:1433;databaseName=livingdocs;trustServerCertificate=true;encrypt=false` | Chuỗi kết nối SQL Server |
| `SPRING_DATASOURCE_USERNAME` | `sa` | Tài khoản CSDL |
| `SPRING_DATASOURCE_PASSWORD` | `Password123!` | Mật khẩu CSDL |
| `REDIS_HOST` / `REDIS_PORT` | `localhost:6379` | Địa chỉ máy chủ Redis cache |
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Địa chỉ Kafka Broker |
| `TOKEN_ENCRYPTION_KEY` | *(Key mẫu 32-byte Base64)* | Khóa bí mật 256-bit dùng cho AES-GCM (NFR-SEC-04) |
| `GITHUB_WEBHOOK_SECRET` | `development_webhook_secret_key_123456` | Secret dùng để xác thực HMAC Webhook |
| `GITHUB_APP_ID` | `123456` | ID của GitHub App |
| `GITHUB_APP_PRIVATE_KEY_PEM` | *Trống* | Nội dung private key PEM của GitHub App (nếu để trống, service tự sinh mock token) |

---

## 3. Khởi động và kiểm thử

### 3.1. Chạy Unit Tests
```bash
# Windows
.\mvnw.cmd clean test

# Linux / macOS
./mvnw clean test
```

### 3.2. Khởi động Service
```bash
# Windows
.\mvnw.cmd spring-boot:run

# Linux / macOS
./mvnw spring-boot:run
```

Sau khi khởi động, truy cập Swagger UI tài liệu API tại:
👉 `http://localhost:8082/swagger-ui.html`

### 3.3. Kiểm thử Webhook bằng Script PowerShell
Script `send_mock_webhook.ps1` có sẵn để tự động tính HMAC SHA-256 và gửi request mẫu:
```powershell
# Gửi Webhook Pull Request mở mới
.\send_mock_webhook.ps1 -Fixture "pr_opened"

# Gửi Webhook Push Commit
.\send_mock_webhook.ps1 -Fixture "push_commit"

# Gửi Webhook Bot (phát hiện và chặn vòng lặp)
.\send_mock_webhook.ps1 -Fixture "bot"
```

---

## 4. Danh sách API Endpoints

| Phương thức | Đường dẫn | Chức năng | Yêu cầu SRS |
|---|---|---|---|
| `POST` | `/api/v1/integrations/github/connections` | Tạo kết nối GitHub App, mã hóa token AES-GCM | GH-02 |
| `GET` | `/api/v1/integrations/github/connections/{id}` | Lấy thông tin kết nối | GH-02 |
| `GET` | `/api/v1/integrations/github/connections/{id}/available-repos` | Danh sách repo App được quyền truy cập | GH-02, GH-03 |
| `POST` | `/api/v1/repositories` | Thêm kho mã nguồn vào Workspace | GH-03 |
| `GET` | `/api/v1/repositories` | Liệt kê danh sách kho mã nguồn | GH-05 |
| `GET` | `/api/v1/repositories/{id}` | Chi tiết kho mã nguồn | GH-05 |
| `DELETE` | `/api/v1/repositories/{id}` | Ngắt kết nối kho (gọi `sp_disconnect_repository`) | GH-04 |
| `GET` | `/api/v1/repositories/{id}/events` | Lịch sử sự kiện PR/commit đã nhận | GH-07 |
| `POST` | `/api/v1/webhooks/github` | Webhook tiếp nhận sự kiện (HMAC, Idempotent, Kafka) | GH-08, DR-14, NFR-SEC-06, NFR-REL-05 |
| `GET` | `/actuator/health` | Kiểm tra tình trạng sức khỏe dịch vụ | NFR-MAIN-06 |
