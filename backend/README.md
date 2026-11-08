# LivingDocs Backend

Java Spring Boot (Maven đa module), Python FastAPI (ai-engine), Apache Kafka, Redis, Microsoft SQL Server.

```
backend/
  pom.xml                             parent POM (Java 21, Spring Boot 3.x)
  libs/common-events                  Topic Kafka, Event Envelopes
  libs/common-security                JWT, phân quyền vai trò, TenantContext
  libs/common-web                     Problem Details, Correlation ID, TenantJdbc, AuditService
  services/identity-service           Quản lý danh tính, phân quyền, Dev Token (Port 8081)
  services/integration-service        Kết nối GitHub App, Ingestion Webhook (Port 8082)
  services/document-service           Quản lý tài liệu kỹ thuật, SHA-256 Chain (Port 8083)
  services/workflow-service           Quy trình duyệt 2 cấp (Staff -> Manager), Code Drift (Port 8084)
  services/notification-service       Nhận thông báo qua Kafka, In-App Notification (Port 8086)
  ai-engine/                          Trích xuất AST (Tree-sitter Java/Python), Drift Detection
  infra/                              docker-compose, db.ps1, script SQL
```

---

## 1. Danh sách Swagger UI trực tiếp trên Trình duyệt

| Dịch vụ (Microservice) | Cổng (Port) | Đường dẫn Swagger UI |
| :--- | :---: | :--- |
| **Identity Service** | `8081` | [http://localhost:8081/swagger-ui.html](http://localhost:8081/swagger-ui.html) |
| **Integration Service** | `8082` | [http://localhost:8082/swagger-ui.html](http://localhost:8082/swagger-ui.html) |
| **Document Service** | `8083` | [http://localhost:8083/swagger-ui.html](http://localhost:8083/swagger-ui.html) |
| **Workflow Service** | `8084` | [http://localhost:8084/swagger-ui.html](http://localhost:8084/swagger-ui.html) |
| **Notification Service** | `8086` | [http://localhost:8086/swagger-ui.html](http://localhost:8086/swagger-ui.html) |

---

## 2. HƯỚNG DẪN DEMO TAY (HOÀN TOÀN TRÊN SWAGGER UI)

### KỊCH BẢN 1: QUY TRÌNH PHÊ DUYỆT TÀI LIỆU 2 CẤP & NHẬN THÔNG BÁO KAFKA

#### Bước 1: Lấy Token cấp quyền (Identity Service - Port 8081)
1. Mở [http://localhost:8081/swagger-ui.html](http://localhost:8081/swagger-ui.html).
2. Vào nhóm **`dev-token-controller`** $\rightarrow$ `POST /api/v1/auth/dev-token`.
3. Bấm **Try it out**, nhập JSON tạo token cho Developer:
   ```json
   {
     "userId": "11111111-1111-1111-1111-111111111111",
     "role": "Developer",
     "tenant": "demo"
   }
   ```
4. Bấm **Execute**. Copy chuỗi token trong trường `token` của kết quả trả về.

#### Bước 2: Đăng nhập Swagger (Authorize)
1. Trên giao diện Swagger của các cổng `8083`, `8084`, `8086`:
2. Bấm vào nút màu xanh **Authorize** (hình ổ khóa 🔓) ở góc trên bên phải.
3. Dán chuỗi JWT vừa copy vào ô `Value` (hoặc gõ `Bearer <token>`).
4. Bấm **Authorize** $\rightarrow$ Bấm **Close**. Ổ khóa sẽ chuyển sang trạng thái đã khóa 🔒.

#### Bước 3: Tạo bản thảo tài liệu mới (Document Service - Port 8083)
1. Mở [http://localhost:8083/swagger-ui.html](http://localhost:8083/swagger-ui.html).
2. Vào nhóm **`document-controller`** $\rightarrow$ `POST /api/v1/documents`.
3. Bấm **Try it out**, điền nội dung tài liệu:
   ```json
   {
     "title": "Tài liệu API Hướng dẫn sử dụng LivingDocs",
     "content": "# Giới thiệu LivingDocs\nHệ thống cập nhật tài liệu kỹ thuật tự động.",
     "pathInRepo": "docs/guide.md"
   }
   ```
4. Bấm **Execute**. Lưu lại giá trị `id` của tài liệu trong Response (ví dụ: `a1b2c3d4-...`).
5. *(Tùy chọn)* Kiểm tra tính toàn vẹn chuỗi Hash SHA-256 bằng `GET /api/v1/documents/{id}/integrity`.

#### Bước 4: Nộp tài liệu vào hàng đợi duyệt (Workflow Service - Port 8084)
1. Mở [http://localhost:8084/swagger-ui.html](http://localhost:8084/swagger-ui.html).
2. Vào nhóm **`review-controller`** $\rightarrow$ `POST /api/v1/documents/{id}/submit`.
3. Điền `{id}` là mã tài liệu vừa tạo ở Bước 3.
4. Bấm **Execute**. Hệ thống trả về `reviewTask` ở trạng thái chờ Staff duyệt.

#### Bước 5: Phê duyệt 2 cấp (Staff -> Manager)
Theo quy tắc phân quyền (SoD - Segregation of Duties), người tạo tài liệu không được tự duyệt:
1. **Duyệt cấp 1 (Staff)**:
   * Quay lại `http://localhost:8081/swagger-ui.html` $\rightarrow$ `POST /api/v1/auth/dev-token` với `role: "Staff"`. Copy token mới.
   * Trên Swagger `8084`, bấm **Authorize**, dán token Staff vào.
   * Vào `POST /api/v1/reviews/{id}/decisions` (với `{id}` là `reviewTask.id` ở bước 4):
     ```json
     {
       "decision": "approve",
       "comment": "Bản thảo đạt tiêu chuẩn kỹ thuật cấp 1."
     }
     ```
   * Bấm **Execute**. Nhiệm vụ chuyển lên hàng đợi chờ Manager duyệt.
2. **Duyệt cấp 2 (Manager)**:
   * Quay lại `8081` $\rightarrow$ `POST /api/v1/auth/dev-token` với `role: "Manager"`. Copy token mới.
   * Trên Swagger `8084`, bấm **Authorize**, dán token Manager vào.
   * Gọi tiếp `POST /api/v1/reviews/{id}/decisions`:
     ```json
     {
       "decision": "approve",
       "comment": "Phê duyệt chính thức xuất bản tài liệu."
     }
     ```
   * Bấm **Execute**. Tài liệu chính thức đạt trạng thái `PUBLISHED`.
   * Workflow Service tự động bắn sự kiện Kafka `NOTIFICATION_EVENT` sang topic `ld.notifications`.

#### Bước 6: Kiểm tra Thông báo In-App (Notification Service - Port 8086)
1. Mở [http://localhost:8086/swagger-ui.html](http://localhost:8086/swagger-ui.html).
2. Bấm **Authorize** và dán token vào.
3. Vào nhóm **`notification-controller`** $\rightarrow$ `GET /api/v1/notifications`.
4. Bấm **Execute**. Bạn sẽ thấy thông báo *"Tài liệu đã được phê duyệt và xuất bản"* được tiêu thụ tự động từ Kafka.

---

### KỊCH BẢN 2: TÍCH HỢP GITHUB THẬT & WEBHOOK INGESTION

Repository thực tế: **[https://github.com/silasWorkSpace/HQTCSDL_UTH](https://github.com/silasWorkSpace/HQTCSDL_UTH)** (GitHub Repo ID: `1404979837`).

#### Bước 1: Xem kho mã nguồn đã liên kết (Port 8082)
1. Mở [http://localhost:8082/swagger-ui.html](http://localhost:8082/swagger-ui.html).
2. Vào nhóm **`Repository`** $\rightarrow$ `GET /api/v1/repositories`.
3. Bấm **Try it out** $\rightarrow$ **Execute**.
4. Bạn sẽ thấy kho `silasWorkSpace/HQTCSDL_UTH` với trạng thái `connected` và ID đại diện trong hệ thống (ví dụ: `7bc93bda-0885-4ea8-875e-3e7951e90b41`).

#### Bước 2: Xem lịch sử sự kiện Webhook đã nhận
1. Mở `GET /api/v1/repositories/{id}/events`.
2. Điền `{id}` là ID của repository ở Bước 1.
3. Bấm **Execute**. Danh sách các commit và pull request từ GitHub kèm digest chữ ký SHA-256 đã được ghi nhận trong bảng `ws_demo.source_event`.

---

## 3. KỊCH BẢN CHẠY TEST TỰ ĐỘNG BẰNG SCRIPT

Nếu muốn kiểm thử nhanh toàn bộ các luồng chỉ bằng một dòng lệnh PowerShell:

```powershell
cd backend

# Kiểm thử luồng Quản lý tài liệu & Duyệt 2 cấp & Kafka Notification
.\test-flow.ps1

# Kiểm thử tích hợp GitHub thật & Webhook HMAC SHA-256 & Bóc tách AST bằng AI Engine
.\test-github-demo.ps1
```

---

## 4. Hướng dẫn khởi động lại hạ tầng và Services

```powershell
# 1. Khởi động SQL Server, Redis, Kafka
cd backend\infra
.\db.ps1 up
.\db.ps1 rebuild
.\kafka-topics.ps1

# 2. Khởi chạy từng service
cd backend
.\mvnw.cmd -pl services/identity-service spring-boot:run "-Dspring-boot.run.profiles=dev"
.\mvnw.cmd -pl services/document-service spring-boot:run "-Dspring-boot.run.profiles=dev"
.\mvnw.cmd -pl services/workflow-service spring-boot:run "-Dspring-boot.run.profiles=dev"
.\mvnw.cmd -pl services/notification-service spring-boot:run "-Dspring-boot.run.profiles=dev"

# Integration Service (Port 8082):
cd backend\services\integration-service
..\..\mvnw.cmd spring-boot:run
```
