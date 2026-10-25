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

Backend hiện được quản lý riêng trong thư mục `backend/`.

Thành viên vui lòng kiểm tra README hoặc hướng dẫn bên trong thư mục `backend/` để biết cách cài đặt dependencies, cấu hình môi trường và khởi động server.

## 7. Quy tắc làm việc với Git

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
