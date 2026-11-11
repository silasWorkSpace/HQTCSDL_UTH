# Báo Cáo Khảo Sát Codebase Frontend & Đối Chiếu Hợp Đồng API

## 1. Hiện trạng Stack và Môi trường Frontend

### 1.1. Cấu hình & Thư viện (package.json)
- **Framework**: React `^19.3.1` (sử dụng JavaScript thuần `.jsx`/`.js`, không dùng TypeScript).
- **Routing**: `react-router-dom` `^7.18.4`.
- **HTTP Client**: `axios` `^1.20.0`.
- **Icons**: `lucide-react` `^1.61.0`.
- **Bundler**: `vite` `^8.3.4` kèm `@vitejs/plugin-react` `^6.1.2`.
- **Linter**: `oxlint` `^1.88.0` (cấu hình trong `.oxlintrc.json`).
- **Ghi chú môi trường hệ thống**: Lệnh `node` và `npm` chưa được thêm vào PATH hệ thống máy chủ phát triển hiện tại (cần cấu hình Node.js LTS để chạy build & lint cục bộ).

### 1.2. Hiện trạng các tệp tin trong `frontend/src`
Toàn bộ các file scaffolding ban đầu trong `frontend/src` hiện đang là file rỗng (0 bytes):
- `src/app/AppProviders.jsx`: Rỗng.
- `src/app/router.jsx`: Rỗng.
- `src/constants/roles.js`: Rỗng.
- `src/constants/routes.js`: Rỗng.
- `src/i18n/index.js`: Rỗng.
- `src/layouts/AppLayout.jsx`: Rỗng.
- `src/layouts/AuthLayout.jsx`: Rỗng.
- `src/layouts/Header.jsx`: Rỗng.
- `src/layouts/Sidebar.jsx`: Rỗng.
- `src/services/api/apiClient.js`: Rỗng.
- `src/styles/global.css`: Rỗng.
- `.env.example`: Rỗng.
- `index.html` tham chiếu `/src/main.jsx` nhưng tệp này chưa tồn tại.
- Chưa có các thư mục tính năng (`features/documents`, `features/templates`, `components/`).

---

## 2. Đối Chiếu Hợp Đồng API Thực Tế (Từ Code Java Backend)

Đối chiếu trực tiếp với mã nguồn tại `backend/services/document-service` và `backend/services/governance-service`:

### 2.1. Cụm Document Service (`/api/v1/documents`) - Cổng 8083

1. **`GET /api/v1/documents`**:
   - Controller: `DocumentController.java:listDocuments`
   - Tham số truy vấn: `repositoryId` (UUID, tùy chọn), `docStatus` (String, tùy chọn), `page` (int, mặc định `0`), `size` (int, mặc định `20`).
   - Kiểu trả về: `List<DocumentResponse>` (trả về danh sách mảng thẳng, hiện tại chưa đóng gói dạng `{ items, page, size, total }`).
   - Cấu trúc `DocumentResponse`:
     - `id`: UUID
     - `repositoryId`: UUID
     - `docType`: String
     - `templateId`: UUID
     - `collectionId`: UUID
     - `ownerId`: UUID
     - `title`: String
     - `pathInRepo`: String (lưu ý: backend dùng tên trường `pathInRepo`)
     - `currentVersionId`: UUID
     - `currentVersionNo`: Integer
     - `docStatus`: String (11 trạng thái)
     - `publishStatus`: String (4 trạng thái)
     - `prStatus`: String (4 trạng thái)
     - `createdAt`: ISO-8601 Instant
     - `updatedAt`: ISO-8601 Instant

2. **`GET /api/v1/documents/{id}`**:
   - Trả về `DocumentResponse` chứa metadata của tài liệu.
   - Nội dung chi tiết (`content`) và thông tin tạo bản thảo AI (`generation`) được truy xuất qua endpoint version.

3. **`PUT /api/v1/documents/{id}/draft`**:
   - Request body: `UpdateDraftRequest` chứa duy nhất trường `content: String` (`@NotBlank`).
   - Hiện tại mã nguồn backend chưa nhận `baseVersionNo` trong request body.
   - Trả về: `DocumentVersionResponse` (thông tin bản version vừa ghi nhận).

4. **`GET /api/v1/documents/{id}/versions`**:
   - Trả về `List<DocumentVersionResponse>` được sắp xếp `version_no ASC`.
   - Cấu trúc `DocumentVersionResponse`:
     - `id`: UUID
     - `documentId`: UUID
     - `versionNo`: Integer
     - `content`: String
     - `contentRedacted`: Boolean
     - `actorRole`: String
     - `actorUserId`: UUID
     - `changeSource`: String
     - `statusAtVersion`: String
     - `sourceCommitSha`: String
     - `sourcePrNumber`: Integer
     - `sourcePrKind`: String
     - `reason`: String
     - `rolledBackFromVersionNo`: Integer
     - `createdAt`: Instant

5. **`GET /api/v1/documents/{id}/versions/{n}`**:
   - Trả về `DocumentVersionResponse` của phiên bản thứ `n`.

6. **`GET /api/v1/documents/{id}/diff`**:
   - Tham số truy vấn: `from` (int), `to` (int).
   - Trả về: `DiffResponse` chứa `{ fromVersion: Integer, toVersion: Integer, diffLines: List<String> }` (sử dụng thư viện DiffUtils trên backend).

7. **`POST /api/v1/documents/{id}/rollback`**:
   - Request body: `RollbackRequest` gồm `{ targetVersionNo: Integer, reason: String }`.
   - Trả về: `DocumentVersionResponse` của phiên bản mới được tạo ra.

8. **`GET /api/v1/documents/{id}/integrity`**:
   - Trả về: `IntegrityVerificationResponse` gồm `{ documentId: UUID, isValid: Boolean, problems: List<IntegrityProblem> }`.
   - Mỗi `IntegrityProblem` gồm `{ documentVersionId: UUID, versionNo: Integer, problem: String }`.

9. **`GET /api/v1/documents/{id}/links`**:
   - Trả về: `List<DocCodeLinkResponse>` gồm `{ id, documentId, linkType, codeEntityId, externalRef, createdAt }`.

10. **`POST /api/v1/documents/generate`**:
    - Request body: `GenerateDocRequest` gồm:
      - `scopeType`: String (`FILE`, `MODULE`, `REPOSITORY`)
      - `scopeReference`: String (đường dẫn tương đối)
      - `repositoryId`: UUID
      - `templateId`: UUID
      - `commitSha`: String (tùy chọn)
    - Trả về: 202 Accepted `{ jobId: String, status: "QUEUED", message: String }`.

---

### 2.2. Cụm Governance Service (`/api/v1/governance`) - Cổng 8085

1. **Tiền tố đường dẫn**:
   - Controller sử dụng `@RequestMapping("/api/v1/governance")`.
   - Đường dẫn thực tế: `/api/v1/governance/templates` và `/api/v1/governance/collections`.

2. **`GET /api/v1/governance/templates`**:
   - Không có tham số lọc phân trang trong controller, trả về trực tiếp `List<TemplateResponse>`.
   - Cấu trúc `TemplateResponse`:
     - `id`: UUID
     - `name`: String
     - `docType`: String
     - `description`: String
     - `currentVersionId`: UUID
     - `currentVersionNo`: Integer
     - `status`: String
     - `sections`: String (chuỗi JSON đại diện mảng các mục)
     - `formatRules`: String (chuỗi JSON cấu hình quy tắc định dạng)
     - `createdAt`, `updatedAt`: Instant

3. **`POST /api/v1/governance/templates`** & **`PUT /api/v1/governance/templates/{id}`**:
   - Request body: `CreateTemplateRequest` gồm `{ name, docType, description, sections: String (JSON), formatRules: String (JSON) }`.
   - Lưu ý: `sections` và `formatRules` truyền vào dạng chuỗi JSON thô (`ISJSON` validation trên backend).

4. **`POST /api/v1/governance/templates/{id}/clone`**:
   - Tham số: `newName` (String, tùy chọn qua Query Param).
   - Trả về: `TemplateResponse`.

5. **`GET /api/v1/governance/collections`**:
   - Trả về `List<CollectionResponse>` gồm `{ id, name, description, defaultTemplateId, createdAt }`.

---

## 3. Các Điểm Khác Biệt Giữa Mã Nguồn Thực Tế và Tài Liệu Ban Đầu

1. **Định dạng phân trang của Document API**:
   - Backend `DocumentController.listDocuments` trả về mảng trực tiếp `List<DocumentResponse>` thay vì wrapper object `{ items, page, size, total }`.
   - Frontend sẽ xây dựng adaptor linh hoạt để hỗ trợ cả 2 dạng: nếu nhận mảng thì tự động bọc chuẩn hóa `{ items: data, total: data.length }`, nếu nhận wrapper thì dùng trực tiếp.

2. **Tên trường đường dẫn tài liệu**:
   - DTO backend định nghĩa là `pathInRepo` (thay vì `path`). Frontend client sẽ map hoặc fallback cả 2 tên trường.

3. **Tham số cập nhật bản nháp (`PUT /draft`)**:
   - `UpdateDraftRequest.java` hiện chỉ có `content`. Không có trường `baseVersionNo`. Frontend client vẫn hỗ trợ truyền hoặc xử lý bảo vệ giao diện.

4. **Tiền tố API của Governance**:
   - Backend sử dụng `/api/v1/governance/templates` và `/api/v1/governance/collections`.

5. **Cấu trúc request sinh tài liệu (`POST /generate`)**:
   - Backend dùng cấu trúc phẳng: `scopeType`, `scopeReference`, `repositoryId`, `templateId`, `commitSha`.
   - Phản hồi trả về khóa `jobId` thay vì `correlationId`.

6. **Các API chưa có trên backend**:
   - `POST /documents/{id}/submit` (thuộc dịch vụ workflow).
   - `DELETE /api/v1/governance/templates/{id}`.
   - `GET /api/v1/governance/templates/{id}/versions`.
   - Các API này sẽ được cung cấp qua Mock Layer (`mocks/`) với cơ chế chuyển đổi tự động bằng biến môi trường `VITE_API_MODE`.

