# Hướng dẫn phát triển frontend

## Chạy

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local     # lần đầu; để trống VITE_API_BASE_URL
npm run dev                           # http://localhost:5173
```

Hai chế độ dữ liệu, đổi bằng `VITE_API_MODE` trong `.env.local` (khởi động lại `npm run dev` sau khi đổi):

| Chế độ | Ý nghĩa |
|---|---|
| `real` | Gọi backend thật qua proxy của Vite (`vite.config.js`). Cần `.\db.ps1 up` và identity-service đang chạy |
| `mock` | Dùng dữ liệu giả (MSW), không cần backend. Tài khoản mẫu `admin@`, `developer@`, `staff@`, `manager@`, `techlead@example.com`, mật khẩu `Passw0rd!23`, workspace nhập tùy ý (ví dụ `demo`) |

## Cấu trúc

```
src/
  app/           providers, router, routes.jsx (nơi khai báo màn hình), ProtectedRoute
  layouts/       AppLayout (khung chính), AuthLayout (đăng nhập, đăng ký)
  components/    ErrorAlert, QueryState, PageHeader, ComingSoon, LanguageSwitcher
  constants/     roles.js
  services/      apiClient.js (axios), tokenStore.js, authApi.js, adminApi.js, notificationApi.js
  i18n/          vi/<nhóm>.json, en/<nhóm>.json (tự gom theo tên file)
  mocks/         browser.js, handlers/<tên>.js (tự gom)
  features/      mỗi tính năng một thư mục, mỗi người sở hữu thư mục của mình
```

## Thêm một màn hình (làm theo thứ tự)

1. **Trang:** thay file trang giữ chỗ trong `features/<tên>/` bằng trang thật (giữ tên file và `export default`). Màn hình mới hoàn toàn thì tạo thư mục mới và thêm một mục vào `app/routes.jsx` (`path`, `labelKey`, `icon`, `roles`, `Component`). Menu và route tự sinh từ file này.
2. **Dịch:** thêm `i18n/vi/<tên>.json` và `i18n/en/<tên>.json`, dùng `t('<tên>.khóa')`. Không viết cứng chuỗi chữ trong JSX. Hai file phải có cùng khóa.
3. **Mock:** thêm `mocks/handlers/<tên>.js` export mảng `handlers` (xem `notifications.js`). File được tự gom, không cần sửa nơi khác.
4. **API:** thêm hàm vào file trong `services/` (dùng `api` từ `apiClient.js`, đã gắn token, tự làm mới khi 401, gắn `X-Correlation-Id`).

## Quy ước

- **Dữ liệu từ server:** dùng `useQuery` và `useMutation` của TanStack Query. Bọc kết quả `useQuery` bằng `<QueryState query={...} isEmpty={...}>` để có đủ ba trạng thái đang tải, rỗng, lỗi (có nút thử lại).
- **Báo lỗi:** dùng `toUserError(error)` hoặc `<ErrorAlert error={...}>`, không tự viết thông báo lỗi. Với `useMutation`: `onError: (e) => message.error(toUserError(e).detail)`.
- **Phân quyền giao diện:** khai báo `roles` trong `routes.jsx`; ẩn nút bằng `hasAnyRole([...])` từ `useAuth()`. Đây chỉ là UX, server luôn kiểm tra lại.
- **Trạng thái:** luôn kèm nhãn chữ, không chỉ dựa vào màu (NFR-USAB-03).
- **Responsive:** kiểm tra ở 1280, 1024, 768 px. Bảng rộng dùng `scroll={{ x: 'max-content' }}`.
- **Ngày giờ:** dùng `formatDateTime(value, i18n.language)` trong `utils/format.js`.

## Tài khoản khi chạy với backend thật

Các user seed không có mật khẩu đăng nhập được. Tạo tài khoản ở trang Đăng ký, rồi cấp quyền Administrator bằng token dev (identity-service phải chạy profile `dev`):

```powershell
$base = "http://localhost:8081"; $json = "application/json"
$dev = Invoke-RestMethod -Method Post "$base/api/v1/auth/dev-token" -ContentType $json -Body (@{tenant="demo"; email="admin1@example.com"; roles=@("Administrator")} | ConvertTo-Json)
$h = @{Authorization = "Bearer $($dev.accessToken)"}
$me = (Invoke-RestMethod "$base/api/v1/admin/users?size=100" -Headers $h) | Where-Object email -eq "EMAIL_CUA_BAN@example.com"
Invoke-RestMethod -Method Put "$base/api/v1/admin/users/$($me.id)/roles" -Headers $h -ContentType $json -Body (@{roles=@("Administrator","Developer")} | ConvertTo-Json)
```

## Kiểm tra trước khi xin review

```powershell
npm run lint
npm test
npm run build
```
