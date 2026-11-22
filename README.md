# HQTCSDL_UTH – LivingDocs
## Hệ Thống Quản Lý & Tự Động Đồng Bộ Tài Liệu Kỹ Thuật Hỗ Trợ AI (AI-Assisted Self-Updating Documentation System)

[![Microservices](https://img.shields.io/badge/Architecture-Microservices%20%26%20EDA-blue.svg)](https://spring.io/)
[![Java](https://img.shields.io/badge/Backend-Java%2021%20%7C%20Spring%20Boot%203-brightgreen.svg)](https://adoptium.net/)
[![Python](https://img.shields.io/badge/AI%20Engine-FastAPI%20%7C%20Tree--Sitter-yellow.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite-61dafb.svg)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Infrastructure-Docker%20Compose-2496ed.svg)](https://www.docker.com/)

---

## 1. Giới thiệu tổng quan

**LivingDocs** là giải pháp quản trị vòng đời tài liệu kỹ thuật phần mềm thế hệ mới, giải quyết triệt để vấn đề "tài liệu bị lỗi thời so với mã nguồn" (Documentation Drift) trong các dự án phần mềm quy mô lớn:

- **Đồng bộ mã nguồn thời gian thực (Git & GitHub App Integration)**: Tự động ghi nhận các sự kiện Git (Commit, Push, Pull Request) thông qua Webhook có chữ ký bảo mật HMAC-SHA256 (`x-hub-signature-256`).
- **Phát hiện lệch lạc tài liệu (Drift Detection Engine)**: Ứng dụng Tree-Sitter bóc tách cây cú pháp trừu tượng (AST) của Java và Python để phát hiện sai lệch ở các cấp độ: Semantic (ngữ nghĩa), Signature (chữ ký hàm/API), Referential (tham chiếu thực thể).
- **Quy trình kiểm duyệt 2 cấp nghiêm ngặt (Two-Stage Review Workflow & SoD)**: Đảm bảo nguyên tắc Tách biệt nhiệm vụ (Segregation of Duties) — Developer soạn thảo, Staff kiểm duyệt kỹ thuật Cấp 1, Manager phê duyệt phát hành Cấp 2.
- **Bảo chứng toàn vẹn dữ liệu chuỗi Hash SHA-256**: Mỗi phiên bản tài liệu được liên kết và kiểm tra bằng chuỗi mã băm mã hóa SHA-256, ngăn chặn việc can thiệp trái phép trực tiếp vào CSDL.
- **Kiến trúc Hướng sự kiện (EDA) với Apache Kafka**: Toàn bộ luồng phát hiện drift, sinh gợi ý, chuyển trạng thái duyệt và gửi thông báo In-App đều hoạt động bất đồng bộ với độ trễ thấp.
- **Giao diện người dùng hiện đại**: Soạn thảo Markdown trực quan, so sánh Diff theo thời gian thực (highlight trực quan thêm/xóa), quản lý hàng đợi duyệt và lịch sử drift linh hoạt.

---

## 2. Cấu trúc Thư mục Dự án

```text
HQTCSDL_UTH/
├── backend/                       # Toàn bộ mã nguồn Backend & AI Engine
│   ├── services/                  # 6 Microservices Spring Boot độc lập
│   │   ├── identity-service/      # Quản lý danh tính, phân quyền RBAC, GitHub OAuth 2.0 (Port 8081)
│   │   ├── integration-service/   # Kết nối GitHub App, Ingestion Webhook HMAC (Port 8082)
│   │   ├── document-service/      # Quản lý bản thảo, SHA-256 Hash Chain Integrity (Port 8083)
│   │   ├── workflow-service/      # Quy trình duyệt 2 cấp, Drift Alerts & Suggestions (Port 8084)
│   │   ├── governance-service/    # Quản lý biểu mẫu (Templates) và chính sách (Port 8085)
│   │   └── notification-service/  # Tiêu thụ sự kiện Kafka, thông báo In-App (Port 8086)
│   ├── libs/                      # Thư viện chia sẻ dùng chung
│   │   ├── common-security/       # JWT Parser, AuthFilter, RBAC & TenantContext
│   │   ├── common-web/            # RFC 7807 Problem Details, Correlation ID, Audit
│   │   └── common-events/         # Event Envelopes, Kafka Topics
│   ├── ai-engine/                 # Microservice Python FastAPI: AST Tree-Sitter & LLM (Port 8090)
│   ├── infra/                     # Hạ tầng Docker Compose, Caddy Reverse Proxy & CSDL MSSQL
│   │   ├── docker/                # docker-compose.yml, Caddyfile, file .env
│   │   └── mssql/                 # DDL, Stored Procedures và Seed Data cho SQL Server
│   ├── test-flow.ps1              # Kịch bản kiểm thử tự động toàn bộ luồng Backend
│   └── mvnw.cmd                   # Maven Wrapper cho Windows
├── frontend/                      # Ứng dụng Web Single Page App (React 18 + Vite)
│   ├── src/                       # Mã nguồn giao diện, routing, state management
│   ├── tests/                     # 54 bài kiểm thử Unit Test hợp đồng API & logic nghiệp vụ
│   ├── vite.config.js             # Cấu hình proxy định tuyến API về các backend service
│   └── package.json               # Dependencies Node.js
├── docs/                          # Tài liệu kiến trúc, sơ đồ CSDL và báo cáo phân hệ
├── start-all.ps1                  # Kịch bản khởi động 1-click toàn bộ hệ thống
├── stop-all.ps1                   # Kịch bản dọn dẹp sạch sẽ tài nguyên khi dừng hệ thống
└── README.md                      # Hướng dẫn chi tiết dự án (Tài liệu này)
```

---

## 3. Yêu cầu Môi trường (Prerequisites)

Cần cài đặt các công cụ sau trước khi khởi chạy hệ thống:

| Công cụ | Phiên bản tối thiểu | Mục đích | Link tải chính thức |
| :--- | :---: | :--- | :--- |
| **Git** | `>= 2.40` | Quản lý mã nguồn | [git-scm.com](https://git-scm.com/downloads) |
| **Node.js & npm** | `>= 20.x LTS` | Chạy ứng dụng Frontend React | [nodejs.org](https://nodejs.org/en/download) |
| **Docker Desktop** | `>= 4.25` | Chạy toàn bộ hạ tầng (MSSQL, Kafka, Redis, Caddy, Services) | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Java JDK** | `21 LTS` | Chạy Backend Spring Boot (khi chạy Local Dev) | [adoptium.net](https://adoptium.net/) |
| **Python** | `3.11` hoặc `3.12` | Chạy AI Engine AST (khi chạy Local Dev) | [python.org](https://www.python.org/downloads/) |

---

## 4. Hướng dẫn Cài đặt & Cấu hình Biến Môi trường (`.env`)

Dự án quản lý các thông tin nhạy cảm qua 2 file môi trường chính:
1. `backend/infra/docker/.env`: Cấu hình cho toàn bộ Backend, Database, Kafka, Redis, Caddy và AI Engine.
2. `frontend/.env.local`: Cấu hình chế độ hoạt động và GitHub App Slug cho Frontend Vite.

> [!IMPORTANT]
> Tuyệt đối **KHÔNG** commit các file `.env` hoặc `.env.local` lên Git. Các file này đã được liệt kê trong `.gitignore`.

### 4.1. Tạo file `.env` từ file mẫu

Mở PowerShell tại thư mục gốc của repository và chạy:

```powershell
# 1. Tạo file .env cho Backend & Hạ tầng Docker
Copy-Item backend/infra/docker/.env.example backend/infra/docker/.env

# 2. Tạo file .env.local cho Frontend
Copy-Item frontend/.env.example frontend/.env.local
```

---

### 4.2. Bảng Phân tích Chi tiết & Cách lấy/sinh Từng Biến trong `.env`

Dưới đây là bảng giải thích đầy đủ mục đích, định dạng và cách lấy giá trị cho từng thành phần trong `backend/infra/docker/.env`:

| Tên biến môi trường | Dịch vụ sử dụng | Mô tả & Định dạng | Cách lấy / Lệnh sinh giá trị |
| :--- | :--- | :--- | :--- |
| **`MSSQL_SA_PASSWORD`** | SQL Server (`mssql`) | Mật khẩu quản trị `sa` của Microsoft SQL Server. Cần đáp ứng độ phức tạp: tối thiểu 8 ký tự, có chữ hoa, chữ thường, số và ký hiệu. Không dùng ký tự `$`, `#` hoặc dấu nháy. | Tự đặt hoặc chạy lệnh PowerShell sinh chuỗi ngẫu nhiên:<br>`powershell -Command "$p = -join ((65..90) + (97..122) + (48..57) \| Get-Random -Count 24 \| ForEach-Object {[char]$_}); 'LD!' + $p + '9aZ'"` |
| **`DB_USER`** | Tất cả Backend Microservices | Tên người dùng CSDL ứng dụng có quyền tối thiểu trên các schema tenant (mặc định: `livingdocs_app`). | Giữ nguyên giá trị mặc định: `livingdocs_app` |
| **`DB_PASSWORD`** | Tất cả Backend Microservices | Mật khẩu tài khoản `livingdocs_app` truy cập SQL Server. | Tự đặt chuỗi mật khẩu mạnh tương tự `MSSQL_SA_PASSWORD`. |
| **`JWT_SECRET`** | Identity, Workflow, Document, Governance, Notification | Khóa ký số JWT Token (thuật toán HS256). Yêu cầu tối thiểu 32 ký tự ngẫu nhiên bảo mật cao. | Sinh nhanh bằng PowerShell:<br>`powershell -Command "$b = [byte[]]::new(32); [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)"` |
| **`TOKEN_ENCRYPTION_KEY`** | Identity Service, Integration Service | Khóa đối xứng AES-256 (dạng Base64 của 32 bytes ngẫu nhiên) dùng để mã hóa Access Token của GitHub trước khi lưu vào CSDL. | Dùng lệnh sinh Base64 32 bytes tương tự `JWT_SECRET`. |
| **`INTERNAL_SERVICE_TOKEN`** | Identity, Integration, AI Engine | Token bảo vệ giao tiếp API nội bộ trực tiếp giữa các microservice (service-to-service). | Dùng lệnh sinh Base64 32 bytes tương tự `JWT_SECRET`. |
| **`GITHUB_WEBHOOK_SECRET`** | Integration Service, GitHub App | Khóa bí mật dùng để ký và xác thực chữ ký số HMAC-SHA256 (`x-hub-signature-256`) của các sự kiện Webhook từ GitHub. | Dùng lệnh sinh Base64 32 bytes. Chuỗi này sẽ được điền đồng thời vào cấu hình Webhook trên GitHub App. |
| **`GITHUB_CLIENT_ID`** | Identity Service | Mã Client ID của **GitHub OAuth App** dùng cho chức năng đăng nhập tài khoản người dùng và yêu cầu quyền `repo`. | Lấy từ trang quản lý OAuth App trên GitHub (Xem chi tiết mục 5.1 bên dưới). |
| **`GITHUB_CLIENT_SECRET`** | Identity Service | Mã bí mật Client Secret tương ứng của **GitHub OAuth App**. | Lấy từ trang quản lý OAuth App trên GitHub (Xem chi tiết mục 5.1 bên dưới). |
| **`GITHUB_REDIRECT_URI`** | Identity Service | URL chuyển hướng callback sau khi người dùng đồng ý ủy quyền trên GitHub. | Môi trường local: `http://localhost:5173/auth/callback` |
| **`GITHUB_SCOPE`** | Identity Service | Danh sách phạm vi quyền OAuth yêu cầu người dùng cấp phép. | Giữ mặc định: `read:user,user:email,repo` |
| **`GITHUB_APP_ID`** | Integration Service | ID của **GitHub App** dùng để kết nối và nhận sự kiện Webhook mã nguồn tự động. | Lấy từ trang cài đặt General của GitHub App (Xem chi tiết mục 5.2). |
| **`GITHUB_APP_PRIVATE_KEY_PEM`** | Integration Service | Khóa bí mật RSA Private Key (`.pem`) do GitHub cấp cho GitHub App, dùng để sinh JWT ký gửi request tới GitHub API. | Tải file `.pem` từ GitHub App và chuyển thành một chuỗi duy nhất có `\n` (Xem chi tiết mục 5.3). |
| **`GEMINI_API_KEY`** | AI Engine | Khóa API của Google Gemini để thực hiện tóm tắt thay đổi mã nguồn và sinh tài liệu kỹ thuật tự động. | Đăng ký miễn phí tại [Google AI Studio](https://aistudio.google.com/app/apikey) -> Bấm **Create API Key**. |
| **`GEMINI_MODEL`** | AI Engine | Phiên bản mô hình AI Gemini sử dụng. | Khuyến nghị: `gemini-3.5-flash-lite`, `gemini-2.5-flash` hoặc `gemini-1.5-flash`. |
| **`COOKIE_SECURE`** | Identity Service | Thiết lập cờ `Secure` cho cookie phiên làm việc. | Chạy HTTP local: `false`. Chạy HTTPS / Production: `true`. |
| **`API_DOMAIN`** | Caddy / Backend | Tên miền định tuyến API. | Môi trường local: `localhost`. |

---

### 4.3. Cấu hình Frontend (`frontend/.env.local`)

Mở file `frontend/.env.local` và kiểm tra hai thông số sau:

```env
# Chế độ kết nối: 'real' kết nối backend thật qua Vite proxy; 'mock' dùng dữ liệu giả lập offline
VITE_API_MODE=real

# Tên slug định danh của GitHub App để hiển thị nút cài đặt App trực tiếp cho người dùng
VITE_GITHUB_APP_SLUG=ten-slug-app-cua-ban
```

---

## 5. Hướng dẫn Tạo & Cấu hình GitHub App & GitHub OAuth App

Hệ thống LivingDocs sử dụng hai cơ chế tích hợp GitHub bổ trợ cho nhau:
1. **GitHub OAuth App**: Cho phép người dùng đăng nhập SSO, JIT Provisioning và truy cập kho mã nguồn của họ.
2. **GitHub App**: Nhận các sự kiện Webhook (Push, Pull Request) và tự động đồng bộ tài liệu khi code thay đổi.

---

### 5.1. Tạo GitHub OAuth App (Đăng nhập & Xác thực Người dùng)

1. Đăng nhập vào GitHub, truy cập: **[https://github.com/settings/developers](https://github.com/settings/developers)**.
2. Chọn thẻ **OAuth Apps** ở menu bên trái $\rightarrow$ bấm nút **New OAuth App**.
3. Điền các trường cấu hình:
   - **Application name**: `LivingDocs Dev` (hoặc tên tùy chọn).
   - **Homepage URL**: `http://localhost:5173`
   - **Application description**: `Hệ thống đồng bộ tài liệu kỹ thuật LivingDocs`
   - **Authorization callback URL**: `http://localhost:5173/auth/callback`
4. Bấm **Register application**.
5. Copy chuỗi **Client ID** hiển thị trên màn hình và dán vào `GITHUB_CLIENT_ID` trong `backend/infra/docker/.env`.
6. Tại mục **Client secrets**, bấm nút **Generate a new client secret**. Copy ngay chuỗi bí mật vừa sinh và dán vào `GITHUB_CLIENT_SECRET` trong `.env`.

---

### 5.2. Tạo GitHub App (Webhook Ingestion & Đồng bộ Mã nguồn)

1. Vẫn tại trang **[https://github.com/settings/developers](https://github.com/settings/developers)**, chọn thẻ **GitHub Apps** $\rightarrow$ bấm **New GitHub App**.
2. Điền thông tin cơ bản:
   - **GitHub App name**: `LivingDocs-Integration-<ten-ban>` (tên duy nhất toàn cầu trên GitHub).
   - **Homepage URL**: `http://localhost:5173`
   - **Callback URL**: `http://localhost:5173/auth/callback`
3. Cấu hình **Webhook**:
   - Tích chọn **Active**.
   - **Webhook URL**: Điền URL nhận sự kiện từ Integration Service.
     - *Nếu test qua Caddy local*: `http://localhost/api/v1/webhooks/github` (hoặc domain công khai qua Ngrok/Cloudflare Tunnel nếu muốn nhận event trực tiếp từ GitHub thật: `https://<subdomain>.ngrok-free.app/api/v1/webhooks/github`).
   - **Webhook secret**: Dán giá trị bí mật ngẫu nhiên bạn đã tạo cho `GITHUB_WEBHOOK_SECRET` trong file `.env`.
4. Cấu hình **Permissions (Quyền hạn)**:
   - Tại mục **Repository permissions**:
     - **Contents**: Chọn `Read and write` (để đọc file mã nguồn và tạo PR đồng bộ).
     - **Pull requests**: Chọn `Read and write` (để theo dõi trạng thái PR và gửi comment).
     - **Metadata**: Mặc định là `Read-only`.
5. Cấu hình **Subscribe to events (Đăng ký sự kiện)**:
   - Tích chọn: **Push**
   - Tích chọn: **Pull request**
6. Tại mục **Where can this GitHub App be installed?**:
   - Chọn **Only on this account** (hoặc **Any account** tùy nhu cầu).
7. Bấm **Create GitHub App**.
8. Sau khi tạo thành công:
   - Ghi lại **App ID** hiển thị ở mục General $\rightarrow$ dán vào `GITHUB_APP_ID` trong `.env`.
   - Ghi lại **App Slug** (chuỗi nằm trong URL của App trên GitHub, ví dụ `silas-livingdocs`) $\rightarrow$ dán vào `VITE_GITHUB_APP_SLUG` trong `frontend/.env.local`.

---

### 5.3. Tạo & Định dạng Khóa Bí mật Private Key (`.pem`)

1. Tại trang cấu hình GitHub App vừa tạo, cuộn xuống mục **Private keys**.
2. Bấm nút **Generate a private key**. Trình duyệt sẽ tự động tải về một tệp có định dạng `.pem` (ví dụ: `livingdocs.2026-11-22.private-key.pem`).
3. Khóa PEM là một khối RSA nhiều dòng có định dạng:
   ```text
   -----BEGIN RSA PRIVATE KEY-----
   MIIEpAIBAAKCAQEA...
   ...
   -----END RSA PRIVATE KEY-----
   ```
4. Để đưa vào biến `GITHUB_APP_PRIVATE_KEY_PEM` trong file `.env` trên một dòng duy nhất, mở PowerShell tại nơi lưu file PEM và chạy lệnh chuyển đổi:

   ```powershell
   # Đọc file PEM và chuyển đổi các ký tự xuống dòng thành chuỗi "\n"
   $pemContent = (Get-Content -Path "duong-dan-toi-file.private-key.pem" -Raw) -replace "\r?\n", "\n"
   # Sao chép vào Clipboard để dán vào file .env
   Set-Clipboard -Value "`"$pemContent`""
   ```

5. Mở `backend/infra/docker/.env`, tìm dòng `GITHUB_APP_PRIVATE_KEY_PEM=` và dán giá trị vào giữa hai dấu ngoặc kép:
   ```env
   GITHUB_APP_PRIVATE_KEY_PEM="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n...-----END RSA PRIVATE KEY-----"
   ```

---

### 5.4. Cài đặt App vào Kho Repository (Install App)

1. Ở menu bên trái của trang GitHub App, chọn mục **Install App**.
2. Bấm nút **Install** bên cạnh tài khoản hoặc Organization của bạn.
3. Chọn quyền truy cập:
   - **All repositories** (Tất cả kho) hoặc **Only select repositories** (chỉ định repository cụ thể bạn muốn demo, ví dụ: `silasWorkSpace/HQTCSDL_UTH`).
4. Bấm **Save / Install** để hoàn tất liên kết.

---

## 6. Hướng dẫn Khởi chạy Dự án (Cách chạy Project)

Hệ thống hỗ trợ 3 phương thức khởi chạy linh hoạt tùy theo mục đích phát triển và kiểm thử:

---

### 6.1. Cách 1: Khởi chạy 1-Click tự động (Khuyến nghị cho Demo & Thuyết trình)

Kịch bản PowerShell `start-all.ps1` tự động kiểm tra cổng trống, khởi tạo cơ sở dữ liệu nếu thiếu, nạp dữ liệu mẫu và chạy toàn bộ các dịch vụ:

```powershell
# Chạy toàn bộ hạ tầng Docker (MSSQL, Kafka, Redis, Caddy) và khởi động 6 Spring Boot + AI Engine + Vite Frontend
.\start-all.ps1 -Docker
```

Các cờ tùy chọn hữu ích của `start-all.ps1`:
- `-Docker`: Khởi chạy toàn bộ 11 service trong Docker Compose (thay vì chạy Java qua Maven local).
- `-OpenDemoSignup`: Cho phép người dùng GitHub tự do đăng ký mới vào workspace demo local.
- `-NoBrowser`: Không tự động mở trình duyệt sau khi khởi động xong.
- `-NoFrontend`: Chỉ khởi động Backend và hạ tầng, bỏ qua Frontend Vite.

---

### 6.2. Cách 2: Khởi chạy hoàn chỉnh bằng Docker Compose thủ công

Nếu bạn quen dùng Docker CLI, có thể khởi chạy trực tiếp thông qua Docker Compose:

```powershell
# Bước 1: Di chuyển vào thư mục hạ tầng Docker
cd backend/infra/docker

# Bước 2: Build và khởi động toàn bộ 11 container
docker compose --profile full up -d --build

# Bước 3: Kiểm tra trạng thái sức khỏe của các container
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Sau khi các container đạt trạng thái `healthy`, khởi động giao diện Frontend:

```powershell
cd ../../../frontend
npm install
npm run dev
```

Truy cập hệ thống tại: **[http://localhost:5173](http://localhost:5173)**.

---

### 6.3. Cách 3: Khởi chạy Local Development (Chạy từng Service riêng biệt)

Dành cho lập trình viên muốn debug chi tiết từng service bằng IDE (IntelliJ IDEA / VS Code):

1. **Khởi động các dịch vụ phụ trợ (Database, Message Queue, Cache)**:
   ```powershell
   cd backend/infra/docker
   docker compose up -d mssql redis kafka
   ```

2. **Chạy từng Spring Boot Microservice bằng Maven Wrapper**:
   Mở terminal tại thư mục `backend/` và chạy lệnh cho service tương ứng:
   ```powershell
   cd backend
   # Ví dụ chạy Identity Service
   .\mvnw.cmd spring-boot:run -pl services/identity-service
   # Ví dụ chạy Workflow Service
   .\mvnw.cmd spring-boot:run -pl services/workflow-service
   ```

3. **Chạy AI Engine (Python FastAPI)**:
   ```powershell
   cd backend/ai-engine
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   uvicorn app.main:app --host 0.0.0.0 --port 8090 --reload
   ```

4. **Chạy Frontend**:
   ```powershell
   cd frontend
   npm run dev
   ```

---

### 6.4. Dừng Hệ thống An toàn (`stop-all.ps1`)

Để dọn dẹp sạch sẽ tài nguyên, đóng các tiến trình chạy ngầm và dừng Docker containers:

```powershell
# Dừng toàn bộ tiến trình ứng dụng và tắt toàn bộ Docker containers (volume CSDL vẫn được bảo lưu)
.\stop-all.ps1 -Docker
```

---

## 7. Danh mục Cổng & Bảng điều khiển (Dashboards & Endpoints)

| Thành phần | Cổng (Port) | Đường dẫn trực tiếp | Mô tả chức năng |
| :--- | :---: | :--- | :--- |
| **Frontend Web UI** | `5173` | [http://localhost:5173](http://localhost:5173) | Giao diện React SPA, Đăng nhập, Soạn thảo Markdown, Duyệt bài |
| **Caddy Reverse Proxy** | `80` / `443` | [http://localhost](http://localhost) | Cổng ngõ định tuyến duy nhất, cân bằng tải và cấp phát SSL cục bộ |
| **Identity Service** | `8081` | [http://localhost:8081/swagger-ui.html](http://localhost:8081/swagger-ui.html) | Xác thực OAuth 2.0, cấp JWT token, phân quyền RBAC và switch role |
| **Integration Service** | `8082` | [http://localhost:8082/swagger-ui.html](http://localhost:8082/swagger-ui.html) | Kết nối GitHub App, tiếp nhận Webhook HMAC SHA-256 |
| **Document Service** | `8083` | [http://localhost:8083/swagger-ui.html](http://localhost:8083/swagger-ui.html) | Quản lý bản thảo, phiên bản và chuỗi bảo chứng Hash SHA-256 |
| **Workflow Service** | `8084` | [http://localhost:8084/swagger-ui.html](http://localhost:8084/swagger-ui.html) | Hàng đợi duyệt 2 cấp (Staff -> Manager), Code Drift & Suggestions |
| **Governance Service** | `8085` | [http://localhost:8085/swagger-ui.html](http://localhost:8085/swagger-ui.html) | Quản lý biểu mẫu kỹ thuật (Templates) và chính sách kiểm định |
| **Notification Service** | `8086` | [http://localhost:8086/swagger-ui.html](http://localhost:8086/swagger-ui.html) | Tiêu thụ Kafka event, quản lý hộp thư thông báo In-App |
| **AI Engine (FastAPI)** | `8090` | [http://localhost:8090/docs](http://localhost:8090/docs) | OpenAPI Docs bóc tách AST Tree-Sitter và Secret Masker |
| **SQL Server (MSSQL)** | `1433` | `localhost:1433` | Cơ sở dữ liệu quan hệ lưu trữ dữ liệu đa phân vùng (Multi-Tenant) |

---

## 8. Kịch bản Kiểm thử Tiêu chuẩn (Standard Testing Scenarios)

Dưới đây là chuỗi 8 kịch bản kiểm thử tiêu chuẩn bao phủ toàn diện tính năng nghiệp vụ của hệ thống:

```mermaid
flowchart LR
    A["Kịch bản 1: Đăng nhập & Chọn vai trò"] --> B["Kịch bản 2: Soạn thảo & SHA-256 Hash"]
    B --> C["Kịch bản 3: Nộp duyệt & Quy trình 2 cấp (SoD)"]
    C --> D["Kịch bản 4: Nhận thông báo Kafka Real-time"]
    D --> E["Kịch bản 5: Giám sát Lịch sử Drift & Gợi ý"]
    E --> F["Kịch bản 6: Webhook GitHub & AST AI Engine"]
```

---

### KỊCH BẢN 1: Đăng nhập, JIT Provisioning & Chuyển đổi Vai trò Linh hoạt (Role Switcher)

**Mục tiêu**: Xác thực người dùng, tự động tạo tài khoản khi đăng nhập lần đầu và kiểm tra tính năng chuyển đổi vai trò nhanh phục vụ demo.

1. **Đăng nhập GitHub OAuth**:
   - Truy cập `http://localhost:5173/login`.
   - Bấm nút **"Đăng nhập với GitHub"** $\rightarrow$ Ủy quyền ứng dụng trên trang GitHub.
   - Hệ thống tự động tạo người dùng mới với vai trò `Developer` (JIT Provisioning), cấp JWT Token và đưa vào trang `/documents`.
2. **Đăng nhập nhanh bằng Hồ sơ Mẫu (1-Click Demo Profiles)**:
   - Trên trang Login, bấm vào một trong các tài khoản demo:
     - `Dev Minh` (Developer)
     - `Staff Lan` (Reviewer Cấp 1)
     - `Manager Tuấn` (Reviewer Cấp 2)
     - `Admin Hiếu` (Administrator)
3. **Chuyển đổi Vai trò Trực tiếp (Role Switcher)**:
   - Khi đã đăng nhập, trên thanh Header góc trên bên phải hiển thị huy hiệu vai trò hiện tại (ví dụ: `Developer`).
   - Bấm vào biểu tượng đổi vai trò hoặc chọn vai trò mới từ menu: `Developer` $\leftrightarrow$ `Staff` $\leftrightarrow$ `Manager` $\leftrightarrow$ `Administrator`.
   - Giao diện và quyền hạn của các menu (Hàng đợi duyệt, Tạo biểu mẫu, Lịch sử drift) sẽ lập tức thích ứng tương ứng với vai trò mới mà không cần đăng nhập lại.

---

### KỊCH BẢN 2: Soạn thảo Tài liệu, Quản lý Bản thảo & Kiểm tra Chuỗi Hash SHA-256

**Mục tiêu**: Kiểm tra tính năng tạo tài liệu kỹ thuật, lưu bản thảo và cơ chế toàn vẹn dữ liệu chống can thiệp trái phép.

1. **Tạo tài liệu mới**:
   - Đăng nhập vai trò `Developer`, bấm nút **"Tạo tài liệu mới"** tại `/documents/new`.
   - Nhập tiêu đề: `Tài liệu Hướng dẫn Thanh toán API v1.0`.
   - Nhập đường dẫn mã nguồn liên kết: `services/payment/PaymentService.java`.
   - Soạn thảo nội dung Markdown, xem trước (Preview) thời gian thực.
   - Bấm **"Lưu bản thảo"**. Tài liệu được tạo với trạng thái `DRAFT`, phiên bản `v1`.
2. **Cập nhật nội dung & So sánh Diff trực quan**:
   - Chỉnh sửa thêm một vài dòng nội dung mới trong tài liệu $\rightarrow$ bấm **"Cập nhật phiên bản"**.
   - Mở tab **"Lịch sử phiên bản & So sánh Diff"**:
     - Các dòng mới thêm vào được highlight màu xanh lục (`+`).
     - Các dòng bị xóa hoặc sửa đổi được highlight màu đỏ (`-`).
3. **Xác thực Tính Toàn vẹn Chuỗi Hash (SHA-256 Integrity Check)**:
   - Mở Swagger Document Service tại [http://localhost:8083/swagger-ui.html](http://localhost:8083/swagger-ui.html).
   - Gọi `GET /api/v1/documents/{id}/integrity`.
   - **Kết quả kỳ vọng**: Trả về `valid: true` kèm chuỗi băm SHA-256 của nội dung tài liệu. Nếu có bất kỳ sự can thiệp trực tiếp nào vào CSDL làm sai lệch nội dung, API sẽ lập tức báo `valid: false`.

---

### KỊCH BẢN 3: Quy trình Phê duyệt 2 Cấp (Workflow) & Tách biệt Nhiệm vụ (SoD)

**Mục tiêu**: Chứng minh nguyên tắc Segregation of Duties (SoD) — ngăn chặn triệt để tình trạng "vừa đá bóng vừa thổi còi".

1. **Developer nộp tài liệu vào hàng đợi**:
   - Tại trang chi tiết tài liệu vừa tạo, Developer bấm **"Nộp phê duyệt"** (Submit for Review).
   - Trạng thái tài liệu chuyển thành `IN_REVIEW`. Một nhiệm vụ phê duyệt cấp 1 được khởi tạo với trạng thái `PENDING_STAFF`.
2. **Kiểm tra vi phạm Tách biệt nhiệm vụ (SoD Violation)**:
   - Vẫn giữ nguyên tài khoản `Developer` (người tạo tài liệu), truy cập trang **Hàng đợi xét duyệt** (`/reviews`).
   - Thử bấm nút phê duyệt trên tài liệu của chính mình.
   - **Kết quả kỳ vọng**: Hệ thống khóa nút hành động và thông báo: *"Người nộp tài liệu không được phép tự duyệt tài liệu của chính mình (Quy tắc SoD-01)"*.
3. **Staff thực hiện Kiểm duyệt Cấp 1**:
   - Chuyển sang vai trò `Staff` (bằng Role Switcher trên thanh Header).
   - Vào mục **Hàng đợi xét duyệt** $\rightarrow$ chọn tài liệu cần duyệt.
   - Staff có thể chọn từng dòng code để thêm nhận xét (Line Comment).
   - Nhập lý do và bấm **"Phê duyệt Cấp 1"** (Approve).
   - Trạng thái nhiệm vụ chuyển sang `PENDING_MANAGER` (chờ cấp quản lý phê duyệt vòng cuối).
4. **Manager Phê duyệt Cấp 2 & Xuất bản**:
   - Chuyển sang vai trò `Manager`.
   - Vào **Hàng đợi xét duyệt** $\rightarrow$ mở tài liệu.
   - Manager có 3 lựa chọn: **Phê duyệt xuất bản**, **Từ chối (Reject)** hoặc **Trả lại yêu cầu (Return)** kèm nhận xét bắt buộc.
   - Bấm **"Phê duyệt & Xuất bản"**.
   - **Kết quả kỳ vọng**: Tài liệu chính thức đạt trạng thái `PUBLISHED`. Workflow Service tự động bắn sự kiện `DOCUMENT_PUBLISHED` sang Kafka topic `ld.notifications`.

---

### KỊCH BẢN 4: Nhận Thông báo Thời gian thực qua Apache Kafka

**Mục tiêu**: Kiểm chứng luồng xử lý bất đồng bộ Event-Driven qua message broker Apache Kafka.

1. Ngay sau khi Manager phê duyệt ở Kịch bản 3, chuyển lại vai trò `Developer` (người nộp tài liệu).
2. Quan sát biểu tượng quả chuông thông báo ở thanh điều hướng trên cùng:
   - Huy hiệu đỏ hiển thị số lượng thông báo chưa đọc mới.
3. Bấm vào quả chuông để mở ngăn kéo thông báo:
   - Xuất hiện thông báo: *"Tài liệu 'Tài liệu Hướng dẫn Thanh toán API v1.0' đã được phê duyệt và xuất bản chính thức."*
   - Kèm thời gian chính xác và trạng thái `Chưa đọc`.
4. Bấm vào thông báo để dẫn thẳng tới tài liệu đã xuất bản và tự động đánh dấu đã đọc.

---

### KỊCH BẢN 5: Giám sát Lệch lạc Tài liệu (Drift History) & Gợi ý Cập nhật (Suggestions)

**Mục tiêu**: Quản lý các cảnh báo thay đổi mã nguồn ảnh hưởng đến tài liệu kỹ thuật và xử lý các đề xuất do AI gợi ý.

1. **Kiểm tra Lịch sử Drift (Drift History Page)**:
   - Vào menu **Lịch sử drift** (`/drift-history`).
   - **Mặc định**: Hệ thống tự động hiển thị danh sách **tất cả cảnh báo drift** của mọi tài liệu trên toàn bộ workspace mà không yêu cầu người dùng phải chọn tài liệu trước.
   - Mỗi thẻ cảnh báo hiển thị đầy đủ:
     - Tên tài liệu liên kết (`documentTitle`) kèm đường dẫn bấm xem chi tiết tài liệu.
     - Loại drift: `Semantic` (thay đổi ngữ nghĩa), `Signature` (thay đổi hàm/class), `Referential` (thay đổi tham chiếu).
     - Mức độ nghiêm trọng (`Critical`, `High`, `Medium`, `Low`).
     - Commit SHA, tên file bị thay đổi và danh sách thực thể mã nguồn bị tác động.
     - Khối chi tiết JSON Evidence Payload.
   - **Bộ lọc linh hoạt**: Lọc theo từng tài liệu cụ thể, lọc theo Mức độ nghiêm trọng hoặc Trạng thái xử lý (`Open`, `Handled`).
2. **Xử lý Hàng đợi Gợi ý Cập nhật (Update Suggestions Queue)**:
   - Vào menu **Gợi ý cập nhật** (`/suggestions`).
   - Developer xem danh sách các đề xuất cập nhật do AI Engine sinh ra khi phát hiện drift.
   - Bấm xem chi tiết gợi ý: Xem bản diff đề xuất nội dung mới thay thế cho nội dung cũ.
   - Bấm **"Áp dụng vào bản thảo"** (tạo bản draft mới mang nội dung sửa đổi) hoặc **"Từ chối gợi ý"** (kèm lý do bỏ qua).

---

### KỊCH BẢN 6: Tích hợp Kho GitHub Thật & Webhook Ingestion Xác thực HMAC SHA-256

**Mục tiêu**: Xác thực khả năng nhận webhook thực tế từ kho GitHub và kiểm tra tính toàn vẹn chữ ký số.

1. Mở Swagger Integration Service tại [http://localhost:8082/swagger-ui.html](http://localhost:8082/swagger-ui.html).
2. **Xem danh sách kho mã nguồn đã kết nối**:
   - Gọi `GET /api/v1/repositories`.
   - Kết quả: Hiển thị kho `silasWorkSpace/HQTCSDL_UTH` với trạng thái `connected: true` và nhánh theo dõi `main`.
3. **Kiểm tra nhật ký sự kiện Webhook**:
   - Gọi `GET /api/v1/repositories/{id}/events` (với `{id}` của repository ở bước trên).
   - Kết quả: Danh sách toàn bộ các sự kiện `Push` và `Pull Request` thật gửi từ GitHub, kèm mã băm chữ ký `x-hub-signature-256` đã được hệ thống giải mã và xác thực thành công.

---

### KỊCH BẢN 7: AI Engine - Bóc tách Cú pháp AST & Tự động Che giấu Bí mật (Secret Masker)

**Mục tiêu**: Kiểm tra năng lực trích xuất cấu trúc code bằng Tree-Sitter và tính năng bảo mật che giấu thông tin nhạy cảm.

1. Mở tài liệu API của AI Engine: [http://localhost:8090/docs](http://localhost:8090/docs).
2. **Kiểm tra phân tích cây cú pháp AST (Tree-Sitter)**:
   - Gọi `POST /api/v1/ast/analyze` với payload đoạn code Java:
     ```json
     {
       "language": "java",
       "code": "public class OrderController { @GetMapping(\"/orders\") public List<Order> list() { return null; } }"
     }
     ```
   - **Kết quả kỳ vọng**: Trả về cấu trúc JSON phân cấp gồm tên class (`OrderController`), phương thức (`list`), HTTP verb (`GET`) và đường dẫn endpoint (`/orders`).
3. **Kiểm tra cơ chế Che giấu Bí mật (Secret Masker - NFR-SEC-08)**:
   - Gọi `POST /api/v1/ai/generate-doc` với đầu vào chứa thông tin nhạy cảm (ví dụ chuỗi chứa `db_password="SuperSecretPassword123!"` hoặc `api_key="sk-live-123456789"`).
   - **Kết quả kỳ vọng**: Bản thảo tài liệu do LLM sinh ra tự động chuyển đổi toàn bộ chuỗi nhạy cảm thành định dạng an toàn: `***MASKED***`.

---

### KỊCH BẢN 8: Bộ Kiểm thử Tự động hóa (Automated Test Suites)

Hệ thống tích hợp sẵn các bộ kiểm thử tự động toàn diện từ Frontend, Backend đến AI Engine:

```powershell
# 1. Chạy toàn bộ 54 bài Unit Test Frontend
cd frontend
npm test -- --run

# 2. Kiểm tra đóng gói build Frontend
npm run build

# 3. Chạy kịch bản kiểm thử tích hợp toàn bộ luồng Backend tự động
cd ../backend
.\test-flow.ps1

# 4. Chạy kiểm thử tự động bộ Unit Test của AI Engine (56 tests)
docker run --rm livingdocs-ai-engine python -m pytest tests
```

---

## 9. Quy tắc Làm việc với Git & Đóng góp Dự án

Nhằm đảm bảo tính ổn định và tránh xung đột mã nguồn giữa các thành viên:

1. **Nhánh làm việc**: Luôn tạo nhánh mới từ nhánh `main` mới nhất:
   ```bash
   git switch main
   git pull origin main
   git switch -c feature/ten-tinh-nang-moi
   ```
2. **Quy tắc Commit Message**: Đặt thông điệp commit theo chuẩn Conventional Commits:
   - `feat(...)`: Phát triển tính năng mới.
   - `fix(...)`: Sửa lỗi phát sinh.
   - `docs(...)`: Cập nhật tài liệu kỹ thuật hoặc README.
   - `test(...)`: Bổ sung kịch bản kiểm thử.
   - `refactor(...)`: Tối ưu cấu trúc mã nguồn.
3. **Quy trình Đóng góp**:
   - Chạy `npm test -- --run` và kiểm tra build trước khi tạo Pull Request.
   - Tạo Pull Request hướng về `main` kèm mô tả chi tiết các thay đổi.
   - Ít nhất một thành viên khác trong nhóm review và approve trước khi tiến hành merge.

---

## 10. Bản quyền & Thông tin Nhóm Phát triển

Dự án được xây dựng phục vụ học phần **Hệ Quản Trị Cơ Sở Dữ Liệu Nâng Cao** – Trường Đại học Giao thông Vận tải TP.HCM (UTH).

- **Repository Chính thức**: [https://github.com/silasWorkSpace/HQTCSDL_UTH](https://github.com/silasWorkSpace/HQTCSDL_UTH)
- **Bản quyền**: © 2026 LivingDocs Project Team. Bảo lưu mọi quyền.
