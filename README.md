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

## 5. Khởi động TOÀN BỘ Hệ thống với 1 lệnh duy nhất (1-Click Startup)

Thay vì phải mở từng terminal để chạy từng dịch vụ riêng lẻ, bạn chỉ cần mở PowerShell tại thư mục gốc và chạy:

```powershell
# Khởi động toàn bộ: SQL Server, Redis, Kafka + 6 Microservices + AI Engine + Frontend Web
.\start-all.ps1
```

Script sẽ tự động:
1. Khởi động hạ tầng Docker (SQL Server, Redis, Kafka).
2. Tự động giải phóng các port bị chiếm dụng (nếu có).
3. Mở đồng thời toàn bộ microservices backend, AI engine và frontend trong các Tab của Windows Terminal (hoặc các cửa sổ console có gắn nhãn tên rõ ràng).
4. Tự động mở trình duyệt web tại `http://localhost:5173`.

**Tùy chọn:**
* Chạy hoàn toàn bên trong Docker container: `.\start-all.ps1 -Docker`
* Chỉ chạy backend và AI (không mở frontend): `.\start-all.ps1 -NoFrontend`

Khi muốn dừng toàn bộ các service:
```powershell
# Tắt sạch các service đang chạy
.\stop-all.ps1

# Tắt cả các container Docker hạ tầng
.\stop-all.ps1 -Docker
```

## 6. Chạy Frontend thủ công

Di chuyển vào thư mục frontend:

** `cd frontend`

** `npm install`

** `npm run dev`

Sau khi chạy thành công, mở địa chỉ local được hiển thị trong Terminal (thường là `http://localhost:5173`).

## 6. Chạy Backend

Backend hiện được quản lý trong thư mục `backend/` bao gồm hệ thống Microservices Spring Boot, AI Engine FastAPI, Apache Kafka, Redis và SQL Server.

Chi tiết cài đặt xem tại: [`backend/README.md`](backend/README.md).

## 7. Hướng dẫn Kiểm thử Thủ công (Manual Testing Guide)

Toàn bộ hệ thống hỗ trợ kiểm thử thủ công qua 2 phương thức trực quan:
1. **Swagger UI & OpenAPI Docs**: Kiểm thử chuyên sâu từng API endpoint của Backend & AI Engine.
2. **Frontend Web UI**: Trải nghiệm giao diện người dùng thực tế tại `http://localhost:5173`.

### 7.1. Bảng điều khiển & Đường dẫn truy cập trực tiếp

| Thành phần | Cổng (Port) | Đường dẫn trực tiếp | Mục đích kiểm thử |
| :--- | :---: | :--- | :--- |
| **Frontend Web** | `5173` | [http://localhost:5173](http://localhost:5173) | Giao diện tương tác người dùng React + Vite |
| **Identity Service** | `8081` | [http://localhost:8081/swagger-ui.html](http://localhost:8081/swagger-ui.html) | Quản lý người dùng, tạo Dev Token (Developer, Staff, Manager) |
| **Integration Service** | `8082` | [http://localhost:8082/swagger-ui.html](http://localhost:8082/swagger-ui.html) | Tích hợp GitHub thật, Ingestion Webhook HMAC SHA-256 |
| **Document Service** | `8083` | [http://localhost:8083/swagger-ui.html](http://localhost:8083/swagger-ui.html) | Quản lý bản thảo tài liệu, kiểm tra chuỗi Hash SHA-256 |
| **Workflow Service** | `8084` | [http://localhost:8084/swagger-ui.html](http://localhost:8084/swagger-ui.html) | Hàng đợi duyệt 2 cấp (Staff -> Manager), Code Drift Alerts |
| **Governance Service** | `8085` | [http://localhost:8085/swagger-ui.html](http://localhost:8085/swagger-ui.html) | Biểu mẫu tài liệu (Templates), Quy chuẩn tài liệu |
| **Notification Service** | `8086` | [http://localhost:8086/swagger-ui.html](http://localhost:8086/swagger-ui.html) | Nhận thông báo In-App qua Kafka broker |
| **AI Engine (FastAPI)** | `8090` | [http://localhost:8090/docs](http://localhost:8090/docs) | AST Tree-Sitter, Secret Masker, LLM Doc Generation |

---

### 7.2. Chuẩn bị Token Phân quyền (Identity Service - Port 8081)

Hầu hết các API của hệ thống đều được bảo vệ bởi chuẩn JWT và phân quyền vai trò (Role-Based Access Control). Hãy chuẩn bị token trước khi thực hiện các kịch bản:

1. Mở Swagger UI của **Identity Service**: [http://localhost:8081/swagger-ui.html](http://localhost:8081/swagger-ui.html).
2. Vào endpoint `POST /api/v1/auth/dev-token` $\rightarrow$ bấm **Try it out**.
3. Điền payload theo từng vai trò bạn cần kiểm thử:
   * **Developer (Người soạn thảo)**:
     ```json
     {
       "userId": "11111111-1111-1111-1111-111111111111",
       "role": "Developer",
       "tenant": "demo"
     }
     ```
   * **Staff (Người duyệt cấp 1)**:
     ```json
     {
       "userId": "22222222-2222-2222-2222-222222222222",
       "role": "Staff",
       "tenant": "demo"
     }
     ```
   * **Manager (Người duyệt cấp 2 / Quyết định xuất bản)**:
     ```json
     {
       "userId": "33333333-3333-3333-3333-333333333333",
       "role": "Manager",
       "tenant": "demo"
     }
     ```
4. Bấm **Execute**. Copy chuỗi token trong trường `"token"` ở phần kết quả trả về.
5. **Cách gắn token trên Swagger:**
   * Tại Swagger của dịch vụ cần gọi (`8082`, `8083`, `8084`, `8085`, `8086`), bấm nút xanh **Authorize** (hình ổ khóa 🔓) ở góc trên bên phải.
   * Dán chuỗi token vừa copy vào ô `Value` (có thể gõ `Bearer <token>` hoặc dán thẳng token).
   * Bấm **Authorize** $\rightarrow$ **Close**. Ổ khóa sẽ chuyển sang trạng thái đã khóa 🔒.

---

### 7.3. Kịch bản Kiểm thử Thủ công Chi tiết

#### KỊCH BẢN 1: Quản lý Bản thảo & Kiểm tra Chuỗi Hash SHA-256 (Document Service - Port 8083)

1. **Tạo tài liệu mới**:
   * Mở [http://localhost:8083/swagger-ui.html](http://localhost:8083/swagger-ui.html), gắn token của **Developer**.
   * Gọi `POST /api/v1/documents` với payload:
     ```json
     {
       "title": "Tài liệu API Xác thực Người dùng",
       "content": "# API Authentication\nEndpoint xác thực người dùng qua JWT.",
       "pathInRepo": "docs/auth-api.md"
     }
     ```
   * Kết quả: Trả về HTTP `201 Created` kèm `id` của tài liệu và `currentVersionNo: 1`. Hãy lưu lại `id` này.

2. **Kiểm tra tính toàn vẹn chuỗi Hash (SHA-256)**:
   * Gọi `GET /api/v1/documents/{id}/integrity` (điền `{id}` vừa tạo).
   * Kết quả: Trả về `valid: true` kèm `hash` SHA-256 của nội dung tài liệu, chứng minh dữ liệu không bị can thiệp trái phép.

3. **Cập nhật nội dung phiên bản mới**:
   * Gọi `PUT /api/v1/documents/{id}` kèm `baseVersionNo: 1` và nội dung sửa đổi.
   * Hệ thống sẽ tự động tăng phiên bản lên `versionNo: 2` và tính toán lại SHA-256 hash mới liên kết với hash cũ.

---

#### KỊCH BẢN 2: Quy trình Phê duyệt 2 Cấp & Kiểm tra Tính Tách biệt Nhiệm vụ (Workflow Service - Port 8084)

1. **Developer nộp tài liệu vào hàng đợi duyệt**:
   * Mở [http://localhost:8084/swagger-ui.html](http://localhost:8084/swagger-ui.html), giữ token **Developer**.
   * Gọi `POST /api/v1/documents/{id}/submit` với `{id}` tài liệu ở Kịch bản 1.
   * Kết quả: Trả về `reviewTask` với trạng thái `PENDING_STAFF` và `stage: "Staff"`. Lưu lại trường `reviewTask.id`.

2. **Kiểm tra quy tắc Tách biệt nhiệm vụ (Segregation of Duties - SoD)**:
   * Giữ token **Developer** (người tạo tài liệu), thử gọi `POST /api/v1/reviews/{reviewTaskId}/decisions` với `{"decision": "approve"}`.
   * **Kết quả kỳ vọng**: Hệ thống từ chối với mã lỗi `400 Bad Request` hoặc `403 Forbidden` kèm thông báo vi phạm chính sách: *Người tạo không được phép tự duyệt tài liệu của chính mình*.

3. **Staff thực hiện duyệt Cấp 1**:
   * Bấm nút **Authorize**, dán token của vai trò **Staff**.
   * Gọi `POST /api/v1/reviews/{reviewTaskId}/decisions`:
     ```json
     {
       "decision": "approve",
       "comment": "Nội dung chuẩn kỹ thuật, đồng ý chuyển duyệt cấp quản lý."
     }
     ```
   * Kết quả: Nhiệm vụ tự động chuyển sang cấp 2 `PENDING_MANAGER` (`stage: "Manager"`).

4. **Manager thực hiện duyệt Cấp 2 (Xuất bản chính thức)**:
   * Bấm nút **Authorize**, dán token của vai trò **Manager**.
   * Gọi `POST /api/v1/reviews/{reviewTaskId}/decisions`:
     ```json
     {
       "decision": "approve",
       "comment": "Phê duyệt xuất bản tài liệu lên hệ thống chính thức."
     }
     ```
   * **Kết quả**:
     * Trạng thái tài liệu chuyển thành `PUBLISHED`.
     * Workflow Service tự động xuất bản sự kiện Kafka `NOTIFICATION_EVENT` sang topic `ld.notifications`.

---

#### KỊCH BẢN 3: Tiêu thụ Thông báo Kafka Real-Time (Notification Service - Port 8086)

1. Mở [http://localhost:8086/swagger-ui.html](http://localhost:8086/swagger-ui.html).
2. Bấm **Authorize**, dán token của **Developer** (người nộp tài liệu).
3. Gọi `GET /api/v1/notifications`.
4. **Kết quả**: Bạn sẽ thấy bản ghi thông báo mới được Notification Service tiêu thụ bất đồng bộ từ Kafka broker với nội dung:
   * Thông báo: *"Tài liệu 'Tài liệu API Xác thực Người dùng' đã được phê duyệt và xuất bản."*
   * Trạng thái: `UNREAD`.
5. *(Tùy chọn)* Đánh dấu đã đọc bằng `PATCH /api/v1/notifications/{id}/read`.

---

#### KỊCH BẢN 4: Tích hợp Kho GitHub thật & Webhook Ingestion (Integration Service - Port 8082)

Hệ thống đã tích hợp trực tiếp với kho GitHub thật: **[silasWorkSpace/HQTCSDL_UTH](https://github.com/silasWorkSpace/HQTCSDL_UTH)** (GitHub Repo ID: `1404979837`).

1. Mở [http://localhost:8082/swagger-ui.html](http://localhost:8082/swagger-ui.html).
2. Gọi `GET /api/v1/repositories`:
   * Xem thông tin kho đã kết nối (`connected: true`), nhánh theo dõi mặc định (`main`), và Webhook URL.
3. Gọi `GET /api/v1/repositories/{id}/events`:
   * Xem danh sách các sự kiện commit/push và Pull Request thực tế từ GitHub được xác thực chữ ký HMAC SHA-256 (`x-hub-signature-256`) và lưu vào CSDL.

---

#### KỊCH BẢN 5: AI Engine - Bóc tách Cú pháp AST & Che giấu Bí mật (Port 8090)

1. Mở tài liệu API của AI Engine: [http://localhost:8090/docs](http://localhost:8090/docs).
2. **Kiểm tra bóc tách AST (Tree-Sitter Java Spring / Python FastAPI)**:
   * Gọi `POST /api/v1/ast/analyze` với danh sách tệp nguồn hoặc đoạn mã mẫu.
   * Kết quả: Trả về cấu trúc cây phân cấp gồm `class`, `method`, `endpoint` (kèm route HTTP và sub-path), cùng liên kết `parent_id` chuẩn xác.
3. **Kiểm tra cơ chế Che giấu Bí mật (Secret Masker - NFR-SEC-08)**:
   * Gọi `POST /api/v1/ai/generate-doc` với đoạn văn bản chứa API key hoặc mật khẩu giả định (ví dụ: `password="SuperSecret123!"` hoặc `api_key: AIzaSyD...`).
   * Kết quả: Bản thảo tài liệu do LLM sinh ra tự động che giấu các chuỗi nhạy cảm thành `***MASKED***`, đảm bảo tuyệt đối an toàn dữ liệu.

---

#### KỊCH BẢN 6: Kiểm thử Trực quan trên Giao diện Web (Frontend UI - Port 5173)

1. Mở trình duyệt tại [http://localhost:5173](http://localhost:5173).
2. **Chọn vai trò đăng nhập**: Hệ thống cung cấp sẵn các profile tiện lợi ở góc trên màn hình:
   * `Dev Minh` (Developer): Trải nghiệm soạn thảo tài liệu bằng Markdown Editor, xem so sánh Diff trực quan giữa 2 phiên bản (highlight xanh/đỏ), nộp yêu cầu phê duyệt.
   * `Staff Lan` (Reviewer Cấp 1): Truy cập màn hình **Hàng đợi xét duyệt**, xem chi tiết nội dung, thêm nhận xét (comment) tại từng số dòng cụ thể, bấm nút Phê duyệt / Từ chối.
   * `Manager Tuấn` (Reviewer Cấp 2): Thực hiện phê duyệt vòng cuối, duyệt xuất bản hoặc trả lại yêu cầu (Return) kèm lý do bắt buộc.
   * `Admin Hiếu` (Administrator): Toàn quyền xem xét cả 2 cấp, cấu hình mẫu biểu (Templates) và giám sát Lệch tài liệu (Drift Alerts).
3. **Kiểm tra tính năng Real-time**: Khi tài liệu được duyệt, biểu tượng quả chuông thông báo ở thanh điều hướng sẽ tự động cập nhật số lượng thông báo mới.

---

## 8. Chạy Kiểm thử Tự động (Automated Testing)

Bên cạnh kiểm thử thủ công, nhóm phát triển có thể chạy nhanh các bộ kiểm thử tự động:

```powershell
# 1. Kiểm thử trọn vẹn luồng Backend bằng script tự động
cd backend; .\test-flow.ps1

# 2. Kiểm thử luồng GitHub Webhook & AI AST Analyzer
cd backend; .\test-github-demo.ps1

# 3. Kiểm thử bộ Unit Test Frontend (39/39 tests)
npm --prefix frontend test

# 4. Kiểm thử bộ Unit Test AI Engine (56/56 tests qua Docker)
docker run --rm livingdocs-ai-engine python -m pytest tests
```

---

## 9. Quy tắc làm việc với Git

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

## 10. Đóng góp

Mọi thành viên cần đọc tài liệu trong `docs/`, thống nhất nhiệm vụ được giao và tuân thủ quy trình Git của nhóm trước khi phát triển tính năng mới.
