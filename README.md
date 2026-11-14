# HQTCSDL_UTH – LivingDocs

## 1. Giới thiệu

**LivingDocs** là hệ thống quản lý, đồng bộ và tự động cập nhật tài liệu kỹ thuật có hỗ trợ AI (AI-Assisted Self-Updating Document System), được xây dựng trên kiến trúc hướng sự kiện (EDA) và Microservices hiện đại:
- **Xác thực GitHub OAuth 2.0 & JIT Provisioning**: Đăng nhập trực tiếp bằng tài khoản GitHub, yêu cầu cấp quyền truy cập mã nguồn (`repo` scope), tự động tạo tài khoản người dùng với vai trò `Developer`, và lấy danh sách kho mã nguồn từ GitHub API.
- **Tích hợp Kho mã nguồn GitHub**: Đồng bộ nhánh theo dõi, nhận sự kiện Git Webhook (Commit/Push, Pull Request) với chữ ký bảo mật HMAC SHA-256.
- **Quy trình Phê duyệt 2 Cấp (Workflow & SoD)**: Đảm bảo nguyên tắc Tách biệt nhiệm vụ (Segregation of Duties): Developer soạn thảo, Staff kiểm duyệt kỹ thuật cấp 1, Manager phê duyệt xuất bản cấp 2.
- **Tính toàn vẹn Dữ liệu SHA-256**: Kiểm tra chuỗi Hash liên kết bảo đảm tài liệu không bị chỉnh sửa trái phép ngoài quy trình.
- **Thông báo Bất đồng bộ qua Apache Kafka**: Cập nhật thông báo sự kiện real-time cho các bên liên quan.
- **AI Engine (FastAPI & AST)**: Trích xuất cú pháp cây mã nguồn (Tree-Sitter), phát hiện lệch lạc tài liệu (Drift Detection) và tự động che giấu thông tin nhạy cảm (Secret Masker).

Repository này chứa toàn bộ mã nguồn backend, frontend, hạ tầng Docker và tài liệu phục vụ quá trình phát triển dự án của nhóm.

---

## 2. Cấu trúc repository

```
HQTCSDL_UTH/
├── backend/                  # Toàn bộ mã nguồn Backend
│   ├── services/             # 6 Microservices Spring Boot (Identity, Integration, Document, Workflow, Governance, Notification)
│   ├── libs/                 # Thư viện dùng chung (common-security, common-web, common-events)
│   ├── ai-engine/            # Dịch vụ AI trích xuất AST và LLM (Python FastAPI)
│   └── infra/                # Cấu hình Docker Compose, file .env và kịch bản CSDL SQL Server (mssql/)
├── frontend/                 # Ứng dụng Frontend React + Vite
├── docs/                     # Tài liệu thiết kế, sơ đồ CSDL và báo cáo phân hệ
├── start-all.ps1             # Kịch bản khởi động 1-click toàn bộ hệ thống
├── stop-all.ps1              # Kịch bản dừng sạch toàn bộ hệ thống
└── README.md                 # Hướng dẫn dự án chi tiết
```

---

## 3. Yêu cầu môi trường

Trước khi chạy dự án, máy tính cần cài đặt:

- **Git**: [https://git-scm.com/install/windows](https://git-scm.com/install/windows)
- **Node.js & npm** (LTS >= 20.x): [https://nodejs.org/en/download](https://nodejs.org/en/download)
- **Java JDK 21**: [https://adoptium.net/](https://adoptium.net/) (nếu chạy Local Dev không qua Docker)
- **Python 3.12**: [https://www.python.org/downloads/](https://www.python.org/downloads/) (nếu chạy AI Engine local)
- **Docker Desktop**: [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/) (khuyến nghị cho chạy toàn bộ hệ thống)

---

## 4. Clone repository

Mở Terminal hoặc PowerShell và chạy:

```bash
git clone https://github.com/silasWorkSpace/HQTCSDL_UTH.git
cd HQTCSDL_UTH
```

Nếu đã clone repository trước đó, hãy cập nhật mã nguồn mới nhất:

```bash
git switch main
git pull origin main
```

---

## 5. Khởi động & Dừng TOÀN BỘ Hệ thống (1-Click `start-all.ps1` & `stop-all.ps1`)

Thay vì phải mở hàng loạt terminal thủ công để cấu hình và bật từng dịch vụ riêng lẻ, bạn chỉ cần mở PowerShell tại thư mục gốc dự án và sử dụng kịch bản 1-click:

### 5.1. Khởi động hệ thống (`start-all.ps1`)

```powershell
# Chế độ 1: Full Docker Container (Khuyến nghị cho kiểm thử đóng gói & Demo hoàn chỉnh)
.\start-all.ps1 -Docker

# Chế độ 2: Local Dev (Khuyến nghị cho lập trình & Debug log trực tiếp từng service)
.\start-all.ps1
```

* **Chế độ Full Docker (`-Docker`)**:
  1. Tự động kiểm tra Docker Desktop đã bật hay chưa.
  2. Tự động biên dịch nhanh các file JAR trên máy host (tận dụng cache `.m2` có sẵn, không lỗi SSL mạng).
  3. Bật hạ tầng SQL Server, Redis, Kafka; chờ SQL Server sẵn sàng và tự động chạy `db.ps1 init` + `tenant demo` + `seed demo` nếu database chưa tồn tại.
  4. Đóng gói và khởi chạy **10 containers** Docker (`mssql`, `redis`, `kafka`, 6 Spring Boot Services, FastAPI AI Engine) trong trạng thái Healthy.
  5. Tự động khởi chạy Frontend Vite và mở trình duyệt web tại `http://localhost:5173`.

* **Chế độ Local Dev (Mặc định)**:
  1. Tự động giải phóng các port nếu đang bị tiến trình cũ chiếm dụng (8081–8086, 8090, 5173).
  2. Tự động bật cụm hạ tầng Docker (SQL Server, Redis, Kafka).
  3. Mở đồng thời toàn bộ microservices backend, AI engine và frontend trong các Tab của Windows Terminal (hoặc các cửa sổ console có gắn nhãn tên và icon màu) để tiện theo dõi log thời gian thực.
  4. Tự động mở trình duyệt web tại `http://localhost:5173`.

* **Tùy chọn bổ sung:**
  * Chỉ chạy Backend & AI Engine (không mở Frontend): `.\start-all.ps1 -NoFrontend`
  * Mở cửa sổ Console riêng biệt thay vì gom Tab: `.\start-all.ps1 -WindowMode windows`

---

### 5.2. Dừng hệ thống (`stop-all.ps1`)

Khi kết thúc phiên làm việc hoặc kiểm thử, bạn có thể dọn dẹp sạch sẽ tài nguyên chỉ với 1 lệnh:

```powershell
# Dừng toàn bộ các ứng dụng cục bộ (giữ lại container hạ tầng SQL Server, Redis, Kafka)
.\stop-all.ps1

# Dừng SẠCH SẼ toàn bộ (tắt cả ứng dụng lẫn toàn bộ container Docker)
.\stop-all.ps1 -Docker
```

---

## 6. Cấu hình Biến Môi trường & GitHub OAuth 2.0 (`.env`)

Dự án sử dụng file `backend/infra/docker/.env` để quản lý biến môi trường bảo mật. File này đã được thêm vào `.gitignore` để không bao giờ bị lộ lên git.

### 6.1. Thiết lập file `.env`
Sao chép từ file mẫu:
```powershell
Copy-Item backend/infra/docker/.env.example backend/infra/docker/.env
```

Nội dung cấu hình cơ bản trong `.env`:
```env
# Mật khẩu SQL Server sa
MSSQL_SA_PASSWORD=Living_Docs_2026!

# Khóa ký JWT nội bộ (HS256, tối thiểu 32 ký tự)
JWT_SECRET=dev-only-secret-change-me-dev-only-secret-change-me

# Cấu hình GitHub OAuth App (FR-AUTH-02)
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
GITHUB_REDIRECT_URI=http://localhost:5173/auth/callback
GITHUB_SCOPE=read:user,user:email,repo
```

### 6.2. Các bước tạo GitHub OAuth App thật để đăng nhập:
1. Truy cập **[https://github.com/settings/developers](https://github.com/settings/developers)**.
2. Chọn mục **OAuth Apps** $\rightarrow$ nhấn **New OAuth App**.
3. Điền các trường:
   - **Application name**: `LivingDocs`
   - **Homepage URL**: `http://localhost:5173` *(hoặc domain deploy thực tế)*
   - **Authorization callback URL**: `http://localhost:5173/auth/callback`
4. Nhấn **Register application**.
5. Copy **Client ID** dán vào `GITHUB_CLIENT_ID` trong `.env`.
6. Nhấn **Generate a new client secret**, copy mã bí mật dán vào `GITHUB_CLIENT_SECRET` trong `.env`.

---

## 7. Chạy Frontend Thủ công

Di chuyển vào thư mục frontend:

```bash
cd frontend
npm install
npm run dev
```

Sau khi chạy thành công, mở địa chỉ `http://localhost:5173` trên trình duyệt.

---

## 8. Chạy Backend Thủ công

Chi tiết cấu trúc và cách khởi chạy từng service riêng biệt bằng Maven hoặc Python, xem tại: [`backend/README.md`](backend/README.md).

---

## 9. Hướng dẫn Kiểm thử Thủ công (Manual Testing Guide)

Toàn bộ hệ thống hỗ trợ kiểm thử thủ công qua 2 phương thức trực quan:
1. **Swagger UI & OpenAPI Docs**: Kiểm thử chuyên sâu từng API endpoint của Backend & AI Engine.
2. **Frontend Web UI**: Trải nghiệm giao diện người dùng thực tế tại `http://localhost:5173`.

---

### 9.1. Bảng điều khiển & Đường dẫn truy cập trực tiếp

| Thành phần | Cổng (Port) | Đường dẫn trực tiếp | Mục đích kiểm thử |
| :--- | :---: | :--- | :--- |
| **Frontend Web** | `5173` | [http://localhost:5173](http://localhost:5173) | Giao diện React + Vite, Đăng nhập GitHub OAuth, Soạn thảo, Duyệt bài |
| **Identity Service** | `8081` | [http://localhost:8081/swagger-ui.html](http://localhost:8081/swagger-ui.html) | Đăng nhập GitHub OAuth, JIT User Provisioning, Lấy danh sách Repo |
| **Integration Service** | `8082` | [http://localhost:8082/swagger-ui.html](http://localhost:8082/swagger-ui.html) | Tích hợp GitHub App thật, Ingestion Webhook HMAC SHA-256 |
| **Document Service** | `8083` | [http://localhost:8083/swagger-ui.html](http://localhost:8083/swagger-ui.html) | Quản lý bản thảo tài liệu, kiểm tra chuỗi Hash SHA-256 |
| **Workflow Service** | `8084` | [http://localhost:8084/swagger-ui.html](http://localhost:8084/swagger-ui.html) | Hàng đợi duyệt 2 cấp (Staff -> Manager), Code Drift Alerts |
| **Governance Service** | `8085` | [http://localhost:8085/swagger-ui.html](http://localhost:8085/swagger-ui.html) | Biểu mẫu tài liệu (Templates), Quy chuẩn tài liệu |
| **Notification Service** | `8086` | [http://localhost:8086/swagger-ui.html](http://localhost:8086/swagger-ui.html) | Nhận thông báo In-App qua Kafka broker |
| **AI Engine (FastAPI)** | `8090` | [http://localhost:8090/docs](http://localhost:8090/docs) | AST Tree-Sitter, Secret Masker, LLM Doc Generation |

---

### 9.2. Kịch bản Kiểm thử Thủ công Chi tiết

#### KỊCH BẢN 1: Xác thực GitHub OAuth 2.0 & Lấy danh sách Repositories (Identity Service - Port 8081 & Frontend - Port 5173)

1. **Đăng nhập trên giao diện Web UI**:
   * Truy cập `http://localhost:5173/login`.
   * Nhấn nút **"Đăng nhập với GitHub"** (biểu tượng GitHub).
   * Trình duyệt sẽ chuyển hướng sang trang ủy quyền chính thức của GitHub yêu cầu cấp quyền truy cập tài khoản và Repositories (`repo` scope).
   * Bấm **Authorize**: Hệ thống nhận authorization code, tự động tạo user mới trong CSDL với role `Developer` (JIT Provisioning), cấp phát JWT token và chuyển hướng bạn vào trang `/documents`.
   * Kiểm tra `localStorage`: Token JWT và `ld_github_token` được lưu tự động cho phiên làm việc.

2. **Kiểm tra API lấy danh sách Repositories trên Swagger**:
   * Mở [http://localhost:8081/swagger-ui.html](http://localhost:8081/swagger-ui.html).
   * Vào `GET /api/v1/auth/github/repos`, bấm **Try it out**.
   * Dán GitHub Access Token vào header `X-GitHub-Token` (hoặc truyền qua query parameter).
   * Nhấn **Execute**: Hệ thống trả về danh sách toàn bộ kho mã nguồn thật của tài khoản GitHub kèm tên, nhánh mặc định, trạng thái private/public và URL.

---

#### KỊCH BẢN 2: Quản lý Bản thảo & Kiểm tra Chuỗi Hash SHA-256 (Document Service - Port 8083)

1. **Chuẩn bị Token Developer**:
   * Mở [http://localhost:8081/swagger-ui.html](http://localhost:8081/swagger-ui.html) $\rightarrow$ `POST /api/v1/auth/dev-token` với `role: "Developer"`, copy token.
   * Mở [http://localhost:8083/swagger-ui.html](http://localhost:8083/swagger-ui.html), bấm **Authorize** và dán token vào.
2. **Tạo tài liệu mới**:
   * Gọi `POST /api/v1/documents` với payload:
     ```json
     {
       "title": "Tài liệu API Xác thực Người dùng",
       "content": "# API Authentication\nEndpoint xác thực người dùng qua JWT.",
       "pathInRepo": "docs/auth-api.md"
     }
     ```
   * Kết quả: Trả về HTTP `201 Created` kèm `id` của tài liệu và `currentVersionNo: 1`.
3. **Kiểm tra tính toàn vẹn chuỗi Hash (SHA-256)**:
   * Gọi `GET /api/v1/documents/{id}/integrity` (điền `{id}` vừa tạo).
   * Kết quả: Trả về `valid: true` kèm `hash` SHA-256 của nội dung tài liệu.
4. **Cập nhật nội dung phiên bản mới**:
   * Gọi `PUT /api/v1/documents/{id}` kèm `baseVersionNo: 1` và nội dung sửa đổi.
   * Hệ thống tự động tăng lên `versionNo: 2` và tính toán SHA-256 hash mới liên kết với hash cũ.

---

#### KỊCH BẢN 3: Quy trình Phê duyệt 2 Cấp & Tách biệt Nhiệm vụ (Workflow Service - Port 8084)

1. **Developer nộp tài liệu vào hàng đợi duyệt**:
   * Mở [http://localhost:8084/swagger-ui.html](http://localhost:8084/swagger-ui.html), giữ token **Developer**.
   * Gọi `POST /api/v1/documents/{id}/submit` với `{id}` tài liệu ở Kịch bản 2.
   * Kết quả: Trả về `reviewTask` với trạng thái `PENDING_STAFF` và `stage: "Staff"`. Lưu lại `reviewTask.id`.
2. **Kiểm tra quy tắc Tách biệt nhiệm vụ (Segregation of Duties - SoD)**:
   * Giữ token **Developer** (người tạo tài liệu), thử gọi `POST /api/v1/reviews/{reviewTaskId}/decisions` với `{"decision": "approve"}`.
   * **Kết quả kỳ vọng**: Hệ thống từ chối với mã lỗi `400 Bad Request` hoặc `403 Forbidden`: *Người tạo không được phép tự duyệt tài liệu của chính mình*.
3. **Staff thực hiện duyệt Cấp 1**:
   * Lấy token của vai trò **Staff** từ Identity Service (`8081`), dán vào nút **Authorize** của cổng `8084`.
   * Gọi `POST /api/v1/reviews/{reviewTaskId}/decisions`:
     ```json
     {
       "decision": "approve",
       "comment": "Nội dung chuẩn kỹ thuật, đồng ý chuyển duyệt cấp quản lý."
     }
     ```
   * Kết quả: Nhiệm vụ tự động chuyển sang cấp 2 `PENDING_MANAGER` (`stage: "Manager"`).
4. **Manager thực hiện duyệt Cấp 2 (Xuất bản chính thức)**:
   * Lấy token vai trò **Manager**, dán vào nút **Authorize** của cổng `8084`.
   * Gọi `POST /api/v1/reviews/{reviewTaskId}/decisions`:
     ```json
     {
       "decision": "approve",
       "comment": "Phê duyệt xuất bản tài liệu lên hệ thống chính thức."
     }
     ```
   * **Kết quả**: Trạng thái tài liệu chuyển thành `PUBLISHED` và Workflow Service tự động xuất bản sự kiện Kafka `NOTIFICATION_EVENT` sang topic `ld.notifications`.

---

#### KỊCH BẢN 4: Tiêu thụ Thông báo Kafka Real-Time (Notification Service - Port 8086)

1. Mở [http://localhost:8086/swagger-ui.html](http://localhost:8086/swagger-ui.html).
2. Bấm **Authorize**, dán token của **Developer** (người nộp tài liệu).
3. Gọi `GET /api/v1/notifications`.
4. **Kết quả**: Nhận thông báo mới được tiêu thụ bất đồng bộ từ Kafka broker:
   * Nội dung: *"Tài liệu 'Tài liệu API Xác thực Người dùng' đã được phê duyệt và xuất bản."*
   * Trạng thái: `UNREAD`.
5. *(Tùy chọn)* Đánh dấu đã đọc bằng `PATCH /api/v1/notifications/{id}/read`.

---

#### KỊCH BẢN 5: Tích hợp Kho GitHub thật & Webhook Ingestion (Integration Service - Port 8082)

Hệ thống đã tích hợp trực tiếp với kho GitHub: **[silasWorkSpace/HQTCSDL_UTH](https://github.com/silasWorkSpace/HQTCSDL_UTH)** (GitHub Repo ID: `1404979837`).

1. Mở [http://localhost:8082/swagger-ui.html](http://localhost:8082/swagger-ui.html).
2. Gọi `GET /api/v1/repositories`: Xem thông tin kho đã kết nối (`connected: true`) và nhánh theo dõi mặc định (`main`).
3. Gọi `GET /api/v1/repositories/{id}/events`: Xem danh sách các sự kiện commit/push và Pull Request thực tế từ GitHub được xác thực chữ ký HMAC SHA-256 (`x-hub-signature-256`).

---

#### KỊCH BẢN 6: AI Engine - Bóc tách Cú pháp AST & Che giấu Bí mật (Port 8090)

1. Mở tài liệu API của AI Engine: [http://localhost:8090/docs](http://localhost:8090/docs).
2. **Kiểm tra bóc tách AST (Tree-Sitter Java Spring / Python FastAPI)**:
   * Gọi `POST /api/v1/ast/analyze` với tệp nguồn hoặc đoạn mã mẫu.
   * Kết quả: Trả về cấu trúc cây phân cấp gồm `class`, `method`, `endpoint` (kèm HTTP verb và sub-path).
3. **Kiểm tra cơ chế Che giấu Bí mật (Secret Masker - NFR-SEC-08)**:
   * Gọi `POST /api/v1/ai/generate-doc` với đoạn văn bản chứa API key hoặc mật khẩu giả định (ví dụ: `password="SuperSecret123!"`).
   * Kết quả: Bản thảo tài liệu do LLM sinh ra tự động che giấu các chuỗi nhạy cảm thành `***MASKED***`.

---

#### KỊCH BẢN 7: Kiểm thử Trực quan trên Giao diện Web (Frontend UI - Port 5173)

1. Mở trình duyệt tại [http://localhost:5173](http://localhost:5173).
2. **Chọn vai trò đăng nhập**: Sử dụng profile có sẵn ở thanh điều hướng trên cùng:
   * `Dev Minh` (Developer): Trải nghiệm soạn thảo tài liệu bằng Markdown Editor, xem so sánh Diff trực quan giữa 2 phiên bản (highlight xanh/đỏ), nộp yêu cầu phê duyệt.
   * `Staff Lan` (Reviewer Cấp 1): Truy cập màn hình **Hàng đợi xét duyệt**, xem chi tiết nội dung, thêm nhận xét (comment) tại từng số dòng cụ thể, bấm nút Phê duyệt / Từ chối.
   * `Manager Tuấn` (Reviewer Cấp 2): Thực hiện phê duyệt vòng cuối, duyệt xuất bản hoặc trả lại yêu cầu (Return) kèm lý do bắt buộc.
   * `Admin Hiếu` (Administrator): Toàn quyền xem xét cả 2 cấp, cấu hình mẫu biểu (Templates) và giám sát Lệch tài liệu (Drift Alerts).
3. **Kiểm tra tính năng Real-time**: Khi tài liệu được duyệt, biểu tượng quả chuông thông báo ở thanh điều hướng sẽ tự động cập nhật số lượng thông báo mới.

---

## 10. Chạy Kiểm thử Tự động (Automated Testing)

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

## 11. Quy tắc làm việc với Git

Để tránh xung đột mã nguồn, thành viên nên tạo nhánh riêng cho từng tính năng hoặc nhiệm vụ.

Tạo nhánh mới từ `main` đã cập nhật:

```bash
git switch main
git pull origin main
git switch -c feature/ten-tinh-nang
```

Sau khi hoàn thành công việc:

```bash
git add .
git commit -m "feat: mô tả chức năng"
git push -u origin feature/ten-tinh-nang
```

Sau đó tạo **Pull Request (PR)** trên GitHub để xem xét và merge vào `main`.

**Lưu ý:**
- Không commit thư mục `node_modules/`.
- Không commit file `.env` chứa mật khẩu, API key hoặc thông tin bí mật.
- Không push trực tiếp lên `main` khi chưa được nhóm thống nhất.
- Luôn cập nhật `main` trước khi tạo nhánh làm việc mới.
- Không tự ý xóa hoặc thay đổi các tài liệu trong `docs/` khi chưa thống nhất với nhóm.

---

## 12. Đóng góp

Mọi thành viên cần đọc tài liệu trong `docs/`, thống nhất nhiệm vụ được giao và tuân thủ quy trình Git của nhóm trước khi phát triển tính năng mới.
