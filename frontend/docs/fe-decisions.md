# Quyết Định Thiết Kế Frontend & Đề Xuất Cần Xác Nhận

Tài liệu này ghi nhận các quyết định kiến trúc giao diện, các giá trị giả định kỹ thuật tạm thời, và các yêu cầu tích hợp đối với các thành viên khác trong nhóm.

---

## 1. Cần Hoàng Thêm (Core Framework / Layout / Auth)

Do các tệp tin dùng chung hiện tại đang là tệp trống, để tránh xung đột mã nguồn và tuân thủ phân chia trách nhiệm:

| Tệp tin | Trạng thái hiện tại | Đề xuất cần Hoàng hoàn thiện |
|---|---|---|
| `src/services/api/apiClient.js` | Rỗng (0 bytes) | Cần cấu hình instance `axios` có baseURL (`VITE_API_BASE_URL`), interceptor tự động gắn `Authorization: Bearer <token>`, và xử lý chuẩn hóa lỗi Problem Details. |
| `src/constants/roles.js` | Rỗng (0 bytes) | Cần định nghĩa hằng số các vai trò chuẩn trong hệ thống: `Developer`, `Staff`, `Manager`, `TechLead` (hoặc `Technical Lead`), `Administrator`. |
| `src/constants/routes.js` | Rỗng (0 bytes) | Cần định nghĩa hằng số các đường dẫn: `/documents`, `/documents/:id`, `/templates`, `/templates/:id`, v.v. |
| `src/i18n/index.js` | Rỗng (0 bytes) | Cần khởi tạo cấu hình `i18next` hỗ trợ tải tài nguyên đa ngôn ngữ theo namespace. |
| `src/layouts/AppLayout.jsx` | Rỗng (0 bytes) | Cần khung giao diện chuẩn (Sidebar, Header, Main Content Area) hiển thị các mục menu theo phân quyền người dùng. |
| `src/app/AppProviders.jsx` | Rỗng (0 bytes) | Cần Provider bọc ngoài cùng (AuthContext, QueryClient/Store, i18nProvider). |
| `src/main.jsx` | Chưa tồn tại | Cần tệp điểm khởi đầu để gắn React Root vào `#root`. |

---

## 2. Các Giá Trị Tạm Dùng Chờ Xác Nhận

Mọi giá trị tạm dùng dưới đây được cô lập tập trung tại `src/constants/` hoặc cấu hình tính năng, có chú thích `// CHỜ XÁC NHẬN`:

1. **Phân trang (Pagination Size)**:
   - **Giá trị tạm thời**: `DEFAULT_PAGE_SIZE = 20`.
   - **Lý do**: Phù hợp với mặc định của `DocumentController.java` (`defaultValue = "20"`).
   - **Người cần xác nhận**: Nhóm trưởng / Backend.

2. **Tiền tố API Endpoint (API Prefixes)**:
   - **Giá trị tạm thời**:
     - Tài liệu: `/api/v1/documents`
     - Quản trị mẫu: `/api/v1/governance/templates`
     - Bộ sưu tập: `/api/v1/governance/collections`
   - **Lý do**: Khớp trực tiếp với `@RequestMapping` trong `DocumentController.java` và `TemplateController.java`.
   - **Người cần xác nhận**: Nhóm API Gateway.

3. **Cơ chế Adaptor Phân trang**:
   - **Giá trị tạm thời**: Nếu response trả về mảng trực tiếp `Array.isArray(res.data)`, frontend bọc thành `{ items: res.data, total: res.data.length, page: 0, size: res.data.length }`. Nếu trả về object có `items` thì giữ nguyên.
   - **Lý do**: Tương thích cả backend hiện tại lẫn hợp đồng phân trang mở rộng.

4. **Định dạng Diff**:
   - **Giá trị tạm thời**: Hỗ trợ hiển thị cả `diffLines` (danh sách chuỗi diff từ DiffUtils) và dạng mảng cấu trúc `{ op, text }`.
   - **Lý do**: Đảm bảo tương thích với endpoint `GET /diff` của backend hiện tại.

5. **Ngưỡng hiển thị độ tin cậy AI (Confidence Level)**:
   - **Giá trị tạm thời**:
     - `>= 0.80` (80%): Độ tin cậy cao
     - `0.60 - 0.79` (60% - 79%): Độ tin cậy trung bình
     - `< 0.60` (< 60%): Độ tin cậy thấp
   - **Lý do**: Đảm bảo hiển thị nhãn chữ kèm số % rõ ràng, trực quan cho người dùng.
   - **Người cần xác nhận**: Product Owner / TechLead.

