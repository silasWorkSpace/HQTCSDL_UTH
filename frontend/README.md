# LivingDocs Frontend

Giao diện người dùng cho nền tảng quản lý tài liệu kỹ thuật LivingDocs, phụ trách cụm phân hệ **Tài liệu (Documents)**, **Phiên bản (Versions)**, **Tài liệu mẫu (Templates)** và các thành phần dùng chung.

---

## 1. Yêu cầu Môi trường & Cài đặt

- **Node.js**: Phiên bản LTS (>= 20.x hoặc 26.x).
- **Trình quản lý gói**: `npm` đi kèm Node.js.

### Cài đặt dependencies:
```bash
cd frontend
npm ci
```

---

## 2. Hướng dẫn Khởi chạy & Kiểm tra

### Khởi chạy chế độ phát triển (Dev Server):
```bash
npm run dev
```
Ứng dụng sẽ khả dụng tại địa chỉ: `http://localhost:5173`.

### Kiểm tra cú pháp (Linting):
```bash
npm run lint
```

### Đóng gói ứng dụng (Production Build):
```bash
npm run build
```

### Chạy bộ kiểm thử tự động (Unit / Integration Tests):
```bash
npm run test
```

---

## 3. Cấu hình Môi trường & Chế độ Dữ liệu (`.env`)

Sao chép tệp mẫu để thiết lập cấu hình:
```bash
cp .env.example .env
```

| Biến môi trường | Giá trị mặc định | Giải thích |
|---|---|---|
| `VITE_API_MODE` | `mock` | Chế độ dữ liệu. Đặt `mock` để phát triển offline với dữ liệu giả lập đầy đủ; đổi sang `real` để gọi trực tiếp các API backend. |
| `VITE_API_BASE_URL` | `/api/v1/documents` | Đường dẫn gốc cho dịch vụ `document-service` (cổng 8083). |
| `VITE_GOVERNANCE_API_URL` | `/api/v1/governance` | Đường dẫn gốc cho dịch vụ `governance-service` (cổng 8085). |

### Chuyển đổi giữa Mock và Real API:
- Để kiểm thử ngoại tuyến: `VITE_API_MODE=mock`.
- Để kết nối backend thực tế: `VITE_API_MODE=real`.
- Khởi động lại dev server sau khi thay đổi tệp `.env`.

---

## 4. Danh sách Màn hình & Đường dẫn

| Màn hình | Đường dẫn | Vai trò được phép | Mô tả |
|---|---|---|---|
| **Danh sách tài liệu** | `/documents` | Developer, Staff, Manager, TechLead | Bảng tài liệu kèm bộ lọc repo/trạng thái, 3 chỉ báo trạng thái độc lập (DocStatusBadges), nút sinh tài liệu AI. |
| **Chi tiết tài liệu** | `/documents/:id` | Developer, Staff, Manager, TechLead | Hiển thị nội dung bằng MarkdownView, điểm tin cậy AI, danh sách grounding evidence, liên kết mã nguồn và kiểm tra chuỗi hash (Integrity). |
| **Chỉnh sửa bản nháp** | `/documents/:id/edit` | Developer (khi DRAFT hoặc CHANGES_REQUESTED) | Soạn thảo 2 cột (Markdown trái, Live Preview phải), xử lý xung đột 409 và cảnh báo thay đổi chưa lưu. |
| **So sánh phiên bản** | `/documents/:id/diff` | Developer, Staff, Manager, TechLead | So sánh khác biệt trực quan giữa 2 phiên bản bằng DiffViewer (hỗ trợ cả side-by-side và unified). |
| **Thư viện Template** | `/templates` | Developer, TechLead | Danh sách 5 template mặc định (API Reference, README, Module Guide, Onboarding Guide, ADR) và bộ sưu tập. |
| **Tạo/Sửa Template** | `/templates/new`, `/templates/:id` | TechLead (tạo/sửa), Developer (chỉ xem) | Thiết lập thông tin chung, bộ dựng danh sách các mục (Section Builder) kèm kiểm tra khóa duy nhất và formatRules JSON. |

---

## 5. Hiện trạng Tích hợp Mock / Real

- **Đã hỗ trợ kết nối API thật**: Toàn bộ các API `document-service` (`GET /`, `GET /{id}`, `PUT /draft`, `GET /versions`, `GET /diff`, `POST /rollback`, `GET /integrity`, `GET /links`, `POST /generate`) và `governance-service` (`GET /templates`, `GET /templates/{id}`, `POST /templates`, `PUT /templates/{id}`, `POST /templates/{id}/clone`, `GET /collections`).
- **Tạm thời sử dụng Mock**:
  - `POST /documents/{id}/submit` (thuộc dịch vụ workflow-service của Huy, đang chờ hợp đồng hoàn thiện).
  - Tìm kiếm toàn cục `GET /search` (thuộc phân hệ của Hiếu).
