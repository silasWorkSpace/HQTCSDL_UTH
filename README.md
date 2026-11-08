# HQTCSDL_UTH – LivingDocs

## 1. Giới thiệu

**LivingDocs** là dự án phát triển hệ thống quản lý và cập nhật tài liệu kỹ thuật có hỗ trợ AI.

Repository này chứa source code và tài liệu phục vụ quá trình phát triển dự án của nhóm.

## 2. Cấu trúc repository

HQTCSDL_UTH/
├── backend/       # Source code backend
├── frontend/      # Source code frontend React + Vite
├── docs/          # Tài liệu, sơ đồ và đặc tả dự án
└── README.md      # Hướng dẫn dự án

## 3. Yêu cầu môi trường

Trước khi chạy dự án, cần cài đặt:

- Git  https://git-scm.com/install/windows
- Node.js và npm (để chạy frontend)  https://nodejs.org/en/download
- Môi trường chạy backend phù hợp với công nghệ được sử dụng

## 4. Clone repository

Mở Terminal hoặc PowerShell và chạy:

`git clone https://github.com/silasWorkSpace/HQTCSDL_UTH.git`

`cd HQTCSDL_UTH`

Nếu đã clone repository trước đó, cập nhật mã nguồn mới nhất:

`git switch main`

`git pull origin main`

## 5. Chạy Frontend

Di chuyển vào thư mục frontend:

** `cd frontend`

** `npm install`

** `npm run dev`

Sau khi chạy thành công, mở địa chỉ local được hiển thị trong Terminal (thường là `http://localhost:5173`).

## 6. Chạy Backend

Backend hiện được quản lý trong thư mục `backend/` bao gồm hệ thống Microservices Spring Boot, AI Engine FastAPI, Apache Kafka, Redis và SQL Server.

Chi tiết cài đặt xem tại: [`backend/README.md`](backend/README.md).

## 7. Hướng dẫn Demo tay (Manual Demo Guide)

Hệ thống hỗ trợ kiểm thử và demo hoàn toàn thông qua giao diện trực quan **Swagger UI** (không bắt buộc dùng Terminal):

### 7.1. Danh sách Swagger UI trực tiếp trên Trình duyệt

| Dịch vụ | Cổng | Đường dẫn Swagger UI | Chức năng chính |
| :--- | :---: | :--- | :--- |
| **Identity Service** | `8081` | [http://localhost:8081/swagger-ui.html](http://localhost:8081/swagger-ui.html) | Cấp Dev Token (Developer, Staff, Manager) |
| **Integration Service** | `8082` | [http://localhost:8082/swagger-ui.html](http://localhost:8082/swagger-ui.html) | Quản lý kho GitHub thật & Webhook Ingestion |
| **Document Service** | `8083` | [http://localhost:8083/swagger-ui.html](http://localhost:8083/swagger-ui.html) | Quản lý tài liệu, kiểm tra chuỗi Hash SHA-256 |
| **Workflow Service** | `8084` | [http://localhost:8084/swagger-ui.html](http://localhost:8084/swagger-ui.html) | Hàng đợi duyệt 2 cấp (Staff -> Manager) |
| **Notification Service** | `8086` | [http://localhost:8086/swagger-ui.html](http://localhost:8086/swagger-ui.html) | Nhận thông báo In-App qua Kafka broker |

### 7.2. Các kịch bản Demo nhanh

1. **Quy trình Quản lý Tài liệu & Phê duyệt 2 cấp**:
   * **Bước 1**: Lấy token tại `POST /api/v1/auth/dev-token` (cổng `8081`).
   * **Bước 2**: Nhấn nút xanh **Authorize** (hình ổ khóa 🔓) trên các cổng Swagger dán token vào.
   * **Bước 3**: Tạo tài liệu tại `POST /api/v1/documents` (cổng `8083`).
   * **Bước 4**: Nộp duyệt tại `POST /api/v1/documents/{id}/submit` (cổng `8084`).
   * **Bước 5**: Duyệt 2 cấp Staff $\rightarrow$ Manager tại `POST /api/v1/reviews/{id}/decisions` (cổng `8084`). Tài liệu đạt trạng thái `PUBLISHED`.
   * **Bước 6**: Xem thông báo đẩy qua Kafka tại `GET /api/v1/notifications` (cổng `8086`).

2. **Tích hợp GitHub thật (silasWorkSpace/HQTCSDL_UTH)**:
   * Xem kho GitHub thật đã liên kết tại `GET /api/v1/repositories` (cổng `8082`).
   * Xem các sự kiện commit/push từ Webhook tại `GET /api/v1/repositories/{id}/events`.

3. **Chạy kịch bản tự động bằng một dòng lệnh**:
   * `cd backend; .\test-flow.ps1` (Luồng phê duyệt tài liệu)
   * `cd backend; .\test-github-demo.ps1` (Luồng tích hợp GitHub & AST Analyzer)

Chi tiết từng bước kèm JSON mẫu xem tại: [`backend/README.md`](backend/README.md).

## 8. Quy tắc làm việc với Git

Để tránh xung đột mã nguồn, thành viên nên tạo nhánh riêng cho từng tính năng hoặc nhiệm vụ.

Tạo nhánh mới từ `main` đã cập nhật:

`git switch main`
`git pull origin main`
`git switch -c feature/ten-tinh-nang`

Sau khi hoàn thành công việc:

`git add .`
`git commit -m "feat: mô tả chức năng"`
`git push -u origin feature/ten-tinh-nang`

Sau đó tạo **Pull Request (PR)** trên GitHub để xem xét và merge vào `main`.

**Lưu ý:**
- Không commit thư mục `node_modules/`.
- Không commit file `.env` chứa mật khẩu, API key hoặc thông tin bí mật.
- Không push trực tiếp lên `main` khi chưa được nhóm thống nhất.
- Luôn cập nhật `main` trước khi tạo nhánh làm việc mới.
- Không tự ý xóa hoặc thay đổi các tài liệu trong `docs/` khi chưa thống nhất với nhóm.

## 8. Đóng góp

Mọi thành viên cần đọc tài liệu trong `docs/`, thống nhất nhiệm vụ được giao và tuân thủ quy trình Git của nhóm trước khi phát triển tính năng mới.
