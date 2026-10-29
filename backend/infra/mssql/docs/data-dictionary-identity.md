# Data dictionary: cụm Nền tảng, tenant, định danh (Người 1)

Phạm vi: bảng `platform.workspace` (schema dùng chung) và 4 bảng trong schema riêng của mỗi tenant `ws_<code>`: `app_user`, `role_assignment`, `notification`, `audit_log`. Script tạo bảng nằm ở `00_platform/002_workspace.sql` và `01_identity/tables.sql`.

Mã SRS lấy từ LivingDocs_SRS_2: FR (yêu cầu chức năng) và NFR (yêu cầu phi chức năng).

## 0. Quy ước chung của các bảng

| Cột chuẩn | Kiểu | Ý nghĩa |
|---|---|---|
| `id` | UNIQUEIDENTIFIER, mặc định `NEWSEQUENTIALID()` | Khóa chính |
| `created_at`, `updated_at` | DATETIME2(3), mặc định `SYSUTCDATETIME()` | Thời điểm tạo, sửa (giờ UTC). `updated_at` do ứng dụng cập nhật |
| `created_by`, `updated_by` | UNIQUEIDENTIFIER, NULL | Người tạo, sửa (không có khóa ngoại để tránh vòng tham chiếu) |
| `row_version` | ROWVERSION | Khóa lạc quan, phát hiện hai người sửa cùng một dòng |

Ngoại lệ: `workspace`, `notification` không có `created_by`, `updated_by`; `audit_log` không có cột chuẩn mà dùng `occurred_at` (bảng chỉ thêm, không sửa).

Mọi cột chữ dùng NVARCHAR hoặc VARCHAR với collation `Vietnamese_CI_AS` (không phân biệt hoa thường, phân biệt dấu). Giá trị liệt kê (enum) lưu VARCHAR kèm ràng buộc CHECK.

## 1. platform.workspace

Mỗi dòng là một tenant. Bảng nằm ở schema dùng chung `platform`, không nằm trong schema tenant. Liên quan: FR-ADM-02, NFR-SEC-07.

| Cột | Kiểu | Null | Mặc định | Mô tả và ràng buộc |
|---|---|---|---|---|
| id | UNIQUEIDENTIFIER | Không | NEWSEQUENTIALID() | Khóa chính |
| code | VARCHAR(30) | Không | | Mã ngắn của tenant, ví dụ `demo`. UNIQUE. Chỉ gồm a-z, 0-9, dấu gạch dưới, tối thiểu 2 ký tự |
| name | NVARCHAR(200) | Không | | Tên hiển thị |
| schema_name | SYSNAME | Không | | Tên schema của tenant, luôn là `ws_<code>`. UNIQUE |
| config | NVARCHAR(MAX) | Có | | JSON cấu hình. Hiện dùng khóa `audit_retention_days` (mặc định 365) cho FR-ADM-07 |
| status | VARCHAR(20) | Không | `active` | `active`, `suspended`, `archived` |
| created_at, updated_at, row_version | | | | Cột chuẩn |

Ràng buộc: `pk_workspace`, `uq_workspace_code`, `uq_workspace_schema`, `ck_workspace_status`, `ck_workspace_config` (phải là JSON hợp lệ), `ck_workspace_code` (so sánh nhị phân để không lọt ký tự có dấu).

Lý do kiểm tra chặt `code`: mã này được ghép vào tên schema và role trong câu lệnh động của `sp_create_workspace`. Chỉ cho phép ký tự an toàn để chống chèn SQL.

Index: hai index duy nhất `uq_workspace_code` và `uq_workspace_schema` cũng dùng để tra nhanh tenant theo mã khi định tuyến. Bảng rất nhỏ (số tenant ít) nên không cần index thêm.

Quan hệ: một workspace tương ứng đúng một schema `ws_<code>`. Liên kết bằng tên, không có khóa ngoại vật lý.

Dữ liệu mẫu: 2 dòng (`demo`, `acme`). Ít hơn 10 dòng vì bảng này chỉ có một dòng mỗi tenant.

## 2. app_user

Tài khoản người dùng trong một tenant. Liên quan: FR-AUTH-01 đến 05, FR-ADM-01, NFR-SEC-04. Tên là `app_user` vì `user` là từ khóa của SQL Server.

| Cột | Kiểu | Null | Mặc định | Mô tả và ràng buộc |
|---|---|---|---|---|
| id | UNIQUEIDENTIFIER | Không | NEWSEQUENTIALID() | Khóa chính |
| email | NVARCHAR(256) | Không | | UNIQUE. Dùng để đăng nhập |
| display_name | NVARCHAR(200) | Không | | Tên hiển thị (FR-AUTH-03) |
| password_hash | VARCHAR(255) | Có | | Chuỗi hash mật khẩu. NULL nếu chỉ đăng nhập bằng OIDC |
| oidc_provider | VARCHAR(50) | Có | | Nhà cung cấp OIDC hoặc GitHub OAuth |
| oidc_subject | NVARCHAR(200) | Có | | Mã định danh người dùng phía nhà cung cấp |
| github_user_id | BIGINT | Có | | ID tài khoản GitHub đã liên kết (FR-GH-01) |
| status | VARCHAR(20) | Không | `active` | `active`, `locked`, `disabled` |
| language | VARCHAR(10) | Không | `vi` | `vi`, `en` |
| notification_prefs | NVARCHAR(MAX) | Có | | JSON: kênh (trong ứng dụng, Slack) và loại sự kiện muốn nhận (FR-AUTH-04) |
| last_login_at | DATETIME2(3) | Có | | Lần đăng nhập gần nhất |
| created_at, created_by, updated_at, updated_by, row_version | | | | Cột chuẩn |

Ràng buộc:
- `uq_app_user_email`: không có hai tài khoản trùng email.
- `ck_app_user_login_method`: phải có mật khẩu hoặc tài khoản OIDC, không có tài khoản không thể đăng nhập (FR-AUTH-02).
- `ck_app_user_status`, `ck_app_user_language`, `ck_app_user_prefs` (JSON hợp lệ).

Index:
- `uq_app_user_email`: tra tài khoản khi đăng nhập.
- `uq_app_user_oidc` (lọc, chỉ dòng có `oidc_subject`): một tài khoản OIDC chỉ gắn với một user.
- `uq_app_user_github` (lọc, chỉ dòng có `github_user_id`): một tài khoản GitHub chỉ gắn với một user.

Dữ liệu nhạy cảm: `password_hash` chỉ chứa hash, không bao giờ lưu mật khẩu thô, và không được ghi vào log ứng dụng (NFR-DATA-03).

Dữ liệu mẫu: 10 dòng, mỗi vai trò 2 người.

## 3. role_assignment

Gán vai trò cho người dùng, theo phạm vi. Liên quan: FR-ADM-01, FR-ADM-13, NFR-SEC-02.

| Cột | Kiểu | Null | Mặc định | Mô tả và ràng buộc |
|---|---|---|---|---|
| id | UNIQUEIDENTIFIER | Không | NEWSEQUENTIALID() | Khóa chính |
| user_id | UNIQUEIDENTIFIER | Không | | Khóa ngoại tới `app_user.id` |
| role | VARCHAR(20) | Không | | `Developer`, `Staff`, `Manager`, `TechLead`, `Administrator` (`TechLead` là Technical Lead) |
| scope_type | VARCHAR(20) | Không | `workspace` | `workspace`, `repository`, `module`, `document` |
| scope_id | UNIQUEIDENTIFIER | Có | | ID của repo, module hoặc tài liệu. NULL khi phạm vi là cả workspace |
| granted_by | UNIQUEIDENTIFIER | Có | | Người cấp quyền, khóa ngoại tới `app_user.id` |
| created_at, created_by, updated_at, updated_by, row_version | | | | Cột chuẩn |

Ràng buộc:
- `uq_role_assignment` (user_id, role, scope_type, scope_id): không cấp trùng cùng vai trò, cùng phạm vi. SQL Server coi các giá trị NULL là bằng nhau trong ràng buộc UNIQUE, nên cũng không có hai dòng "vai trò cho cả workspace" trùng nhau.
- `ck_role_assignment_scope`: `scope_id` phải NULL khi phạm vi là `workspace`, và phải có giá trị ở các phạm vi còn lại.
- `ck_role_assignment_role`, `ck_role_assignment_scope_type`.
- `fk_role_assignment_user`, `fk_role_assignment_granted_by`.

Index: `ix_role_assignment_user` (user_id) để tra mọi vai trò của một người, việc xảy ra ở mỗi lần kiểm tra quyền phía server.

Lưu ý: `scope_id` không có khóa ngoại vì nó trỏ tới các bảng khác nhau tùy `scope_type`, toàn vẹn này do tầng ứng dụng kiểm tra. Quy tắc tách biệt nhiệm vụ (người nộp không được tự duyệt, NFR-SEC-12) do cụm của Người 4 xử lý, không nằm ở bảng này.

Dữ liệu mẫu: 10 dòng.

## 4. notification

Thông báo gửi cho người dùng. Liên quan: FR-NTF-01, FR-NTF-02, FR-ADM-12, FR-AUTH-04.

| Cột | Kiểu | Null | Mặc định | Mô tả và ràng buộc |
|---|---|---|---|---|
| id | UNIQUEIDENTIFIER | Không | NEWSEQUENTIALID() | Khóa chính |
| recipient_user_id | UNIQUEIDENTIFIER | Không | | Người nhận, khóa ngoại tới `app_user.id` |
| channel | VARCHAR(20) | Không | | `in_app`, `slack` |
| event_type | VARCHAR(50) | Không | | Loại sự kiện (ví dụ drift mới, cần duyệt, bị trả lại). Không ràng buộc cứng vì danh sách loại sẽ mở rộng |
| payload | NVARCHAR(MAX) | Không | `{}` | Nội dung thông báo dạng JSON |
| status | VARCHAR(20) | Không | `pending` | `pending`, `sent`, `failed`. Thông báo Slack lỗi được đánh dấu `failed` để gửi lại |
| read_at | DATETIME2(3) | Có | | NULL nghĩa là chưa đọc |
| sent_at | DATETIME2(3) | Có | | Thời điểm gửi thành công |
| correlation_id | UNIQUEIDENTIFIER | Có | | Mã truy vết sự kiện gây ra thông báo (NFR-REL-02) |
| created_at, updated_at, row_version | | | | Cột chuẩn |

Ràng buộc: `fk_notification_recipient`, `ck_notification_channel`, `ck_notification_status`, `ck_notification_payload` (JSON hợp lệ).

Index: `ix_notification_recipient_unread` (recipient_user_id, read_at) kèm cột `created_at`. Phục vụ truy vấn thường xuyên nhất, "thông báo chưa đọc của tôi, mới nhất trước", mà không phải đọc thêm bảng.

Dữ liệu mẫu: 20 dòng (mỗi user một thông báo trong ứng dụng và một thông báo Slack).

## 5. audit_log

Nhật ký kiểm toán, chỉ ghi thêm. Liên quan: NFR-REL-02, NFR-SEC-05, NFR-DATA-01, NFR-DATA-03, FR-ADM-07, FR-ADM-11.

| Cột | Kiểu | Null | Mặc định | Mô tả và ràng buộc |
|---|---|---|---|---|
| id | UNIQUEIDENTIFIER | Không | NEWSEQUENTIALID() | Khóa chính |
| action | VARCHAR(100) | Không | | Hành động, ví dụ `user.created` |
| actor_type | VARCHAR(10) | Không | | `ai`, `user`, `system` |
| actor_id | UNIQUEIDENTIFIER | Có | | Người thực hiện. Bắt buộc khi `actor_type = user` |
| actor_role | VARCHAR(20) | Có | | Vai trò của người thực hiện tại thời điểm đó |
| entity_type | VARCHAR(50) | Không | | Loại đối tượng bị tác động |
| entity_id | UNIQUEIDENTIFIER | Có | | ID đối tượng bị tác động |
| correlation_id | UNIQUEIDENTIFIER | Có | | Mã truy vết xuyên suốt các dịch vụ (NFR-REL-02) |
| detail | NVARCHAR(MAX) | Có | | JSON chi tiết. Không được chứa token hay mật khẩu (NFR-DATA-03) |
| occurred_at | DATETIME2(3) | Không | `SYSUTCDATETIME()` | Thời điểm xảy ra |
| retention_until | DATETIME2(3) | Không | 365 ngày sau thời điểm tạo | Sau mốc này dòng bị job dọn xóa. Ứng dụng đặt giá trị theo `audit_retention_days` trong `workspace.config` (FR-ADM-07) |

Ràng buộc: `ck_audit_log_actor_type`, `ck_audit_log_actor` (người dùng phải có `actor_id`; `ai` và `system` thì không cần), `ck_audit_log_detail` (JSON hợp lệ).

Không có khóa ngoại tới `app_user`: nhật ký phải giữ nguyên khi tài khoản bị vô hiệu hóa hoặc xóa.

Index:
- `ix_audit_log_entity` (entity_type, entity_id, occurred_at): xem lịch sử của một đối tượng.
- `ix_audit_log_actor` (actor_id, occurred_at): xem hoạt động của một người.
- `ix_audit_log_retention` (retention_until): job dọn tìm dòng hết hạn nhanh, không quét cả bảng.

Bất biến: role của tenant bị `DENY UPDATE, DELETE` trên bảng này, ứng dụng chỉ thêm được dòng mới. Chỉ job `livingdocs_purge_audit_log` (chạy bằng quyền cao hơn) xóa được dòng quá hạn. `DENY` không áp dụng với `sa` và `db_owner`, nên ứng dụng không được kết nối bằng các tài khoản đó.

Dữ liệu mẫu: 10 dòng.

## 6. Procedure, job và phân quyền

| Đối tượng | Mục đích | Mã SRS |
|---|---|---|
| `platform.sp_create_workspace(@code, @name)` | Kiểm tra mã, đăng ký vào `platform.workspace`, tạo schema `ws_<code>`, tạo role `role_ws_<code>` và cấp quyền. Chạy trong một transaction nên lỗi giữa chừng không để lại schema dở. Lỗi 50001: mã sai định dạng. Lỗi 50002: mã đã tồn tại | NFR-REL-06 |
| `platform.sp_purge_expired_audit_log` | Xóa dòng `audit_log` quá `retention_until` ở mọi workspace đang `active` | FR-ADM-07, NFR-DATA-01 |
| Job `livingdocs_daily_backup` | Full backup mỗi ngày lúc 19:00 UTC (02:00 giờ Việt Nam) | NFR-AVAIL-05 |
| Job `livingdocs_purge_audit_log` | Chạy procedure dọn log mỗi ngày lúc 20:00 UTC (03:00 giờ Việt Nam) | FR-ADM-07 |
| Role `role_ws_<code>` | Có `SELECT, INSERT, UPDATE, DELETE, EXECUTE` trên schema của tenant mình, không có quyền gì ở schema tenant khác. `audit_log` bị `DENY UPDATE, DELETE` | NFR-SEC-07 |

Bảng các bảng của module khác được tạo vào cùng schema tenant, nên tự thừa hưởng quyền của role ở mức schema.

Kiểm thử: `tests/01_identity_tenant_isolation.sql` (T1 đến T6: cách ly tenant, `audit_log` bất biến, job dọn log) và `tests/02_create_workspace.sql` (C1 đến C7: từ chối mã sai, mã trùng, thử chèn SQL, tạo thành công).

## 7. Sao lưu và khôi phục

Yêu cầu: sao lưu hằng ngày, RPO ≤ 24 giờ, RTO ≤ 4 giờ (NFR-AVAIL-05).

- **Sao lưu:** job `livingdocs_daily_backup` tạo bản full backup mỗi ngày, nên dữ liệu mất tối đa là khoảng thời gian từ bản backup gần nhất, tức RPO ≤ 24 giờ.
- **Chế độ recovery:** database dev dùng `SIMPLE` để log không phình. Chế độ này chỉ khôi phục được về thời điểm của bản full backup. Nếu cần RPO nhỏ hơn 24 giờ ở môi trường thật thì chuyển sang `FULL` và thêm backup log.
- **Diễn tập khôi phục:** chạy `.\db.ps1 restore-test` để restore bản backup ra database tạm, so sánh số dòng với database gốc rồi xóa.
- **Kết quả diễn tập gần nhất:** ____ giây (ngày ____). Mục tiêu RTO là 4 giờ (14.400 giây). Điền số thực tế sau khi chạy.
- **File backup:** không commit lên git. Lấy ra máy bằng `.\db.ps1 backup` (file nằm ở `backend/infra/backup`).

## 8. Điểm cần thống nhất với nhóm

- Giá trị vai trò dùng chung: `Developer`, `Staff`, `Manager`, `TechLead`, `Administrator`.
- `app_user` nằm trong schema tenant (đăng nhập phải xác định workspace trước).
- `password_hash` dùng VARCHAR(255) vì lưu chuỗi hash. Quy ước VARBINARY chỉ áp dụng cho token và khóa nhạy cảm cần mã hóa ngược.
- Các bảng của Người 2, 3, 4 tham chiếu `app_user(id)` qua `[$(SchemaName)].app_user`.
