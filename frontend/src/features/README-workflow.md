# Cụm Gợi ý drift và Duyệt (Huy)

Màn hình: `features/suggestions` (hàng đợi gợi ý, drawer Accept/Edit/Dismiss, lịch sử drift) và
`features/reviews` (hàng đợi duyệt hai tab, màn hình duyệt, quyết định, audit trail).
Thành phần dùng chung của Huy: `components/SeverityBadge.jsx`, `components/EvidencePanel.jsx`.

## Nối vào khung của Người 1 (4 bước)

1. Router: thêm `suggestionRoutes` và `reviewRoutes` (mỗi mục có `path`, `element`, `handle.roles`).
2. Sidebar: dùng `suggestionMenu` và `reviewMenu` (có `path`, `labelKey`, `roles`) để lọc menu theo vai trò.
3. i18n: gọi `registerSuggestionsI18n(i18n)` và `registerReviewsI18n(i18n)` sau khi khởi tạo i18next, hoặc chép các khối `vi`, `en` sang `vi.json`, `en.json`.
4. MSW: thêm `...workflowHandlers` (từ `mocks/workflowHandlers.js`) vào danh sách handler.

## Giả định cần kiểm tra (mỗi mục chỉ sửa ở đúng một file)

| Giả định | File sửa nếu khác |
|---|---|
| `services/api/apiClient.js` xuất axios instance dạng default (hoặc named `apiClient`); `baseURL` rỗng, đường dẫn đầy đủ `/api/v1/...` | `services/workflowApi.js` (hằng `API`) |
| `features/auth/useAuth.js` xuất `useAuth()` trả `{ user: { id, roles } }`, `id` là claim `sub` | `features/reviews/useCurrentUser.js` |
| `components/DiffViewer.jsx` default export, props `oldText`, `newText` | `SuggestionDrawer.jsx`, `ReviewPage.jsx` |
| `components/MarkdownView.jsx` default export, prop `content` | `SuggestionDrawer.jsx`, `ReviewPage.jsx` |
| `components/DocStatusBadges.jsx` default export, prop `docStatus` | `ReviewPage.jsx`, `ReviewQueuePage.jsx` |
| UI kit Ant Design 5 trở lên, TanStack Query v5, react-i18next, MSW v2 (đúng đề xuất mục 3) | cài thêm nếu chưa có |

`features/shared/problemMessage.js` là hàm ánh xạ lỗi tạm; thay bằng hàm dùng chung của Người 1 khi có.

## Gói cần có

`antd`, `@tanstack/react-query`, `react-i18next`, `i18next`, `msw`; test: `vitest`.
`react`, `react-router-dom`, `axios`, `lucide-react` đã có sẵn.

## Hợp đồng API (khớp backend thật)

- `GET /suggestions?status=` và `GET /documents/{id}/drift-alerts` trả **bản ghi thô**: tên cột snake_case,
  `evidence` là **chuỗi JSON**. `suggestions/model.js` chuẩn hóa về một dạng duy nhất.
- `GET /reviews/queue?level=staff|manager` trả `ReviewTaskView[]` camelCase.
- `GET /reviews/{id}` trả `{ task, document, versionUnderReview, changeLog, lastApprovedVersion, decisions, comments }`.
- Lỗi theo Problem Details (`title`, `detail`).

## Backend: bản vá đi kèm (đặt trong thư mục `backend/`, áp dụng trên nhánh có workflow-service)

- `GET /reviews/{id}`: `decisions` thêm `reviewerName`, `reason`; thêm mảng `comments`. Thiếu bản vá này audit trail không có lý do.
- Accept hoặc Dismiss gợi ý cập nhật `handling_status` của drift_alert (`Accepted`, `Dismissed`). Trước đây luôn là `Open`, nên lịch sử drift không thể lọc theo trạng thái.

## Chưa có trong tuần này

- WF-13 kết quả kiểm tra template: backend chưa trả dữ liệu này.
- Quyết định `REQUEST_CHANGES` có ở backend nhưng giao diện theo mục 7 chỉ có Duyệt, Từ chối, Trả lại.
- Bằng chứng ở màn hình duyệt lấy từ cảnh báo drift của tài liệu; backend chưa có bằng chứng riêng cho từng task.
- Test thành phần giao diện (React Testing Library) chưa viết; đã test phần logic và mock.

## Chạy test

`npx vitest run` (các file `__tests__/model.test.js`).
