# LivingDocs Governance Service (Template & Collection)

Service quản lý tài liệu mẫu (Template) và bộ sưu tập (Collection) cho nền tảng LivingDocs.

## Chức năng
- **Template CRUD**: Quản lý tạo mới, cập nhật, lấy chi tiết, danh sách và clone template.
- **Template Sections**: Lưu trữ cấu trúc section dạng JSON có kiểm tra tính hợp lệ (`ISJSON`).
- **Template Seeding**: Khởi tạo 5 template mặc định (API Reference, README, Module Guide, Onboarding Guide, ADR) theo chuẩn idempotent.
- **Collection**: Quản lý bộ sưu tập mặc định gắn kèm template.
- **Multi-tenancy**: Tự động ánh xạ request theo schema `ws_<tenant>` thông qua `TenantContext`.

## API Endpoints
- `POST /api/v1/governance/templates` - Tạo template mới
- `GET /api/v1/governance/templates` - Danh sách templates
- `GET /api/v1/governance/templates/{id}` - Chi tiết template
- `PUT /api/v1/governance/templates/{id}` - Cập nhật template (tạo version mới)
- `POST /api/v1/governance/templates/{id}/clone` - Nhân bản template
- `POST /api/v1/governance/templates/seed` - Chạy seed template & collection mặc định
- `GET /api/v1/governance/collections` - Danh sách collection

## Biến môi trường
- `PORT`: `8085`
- `DB_URL`: JDBC URL kết nối SQL Server
- `DB_USER` / `DB_PASSWORD`: Thông tin xác thực database
- `JWT_SECRET`: Khóa bí mật giải mã JWT Bearer token

## Cách chạy
```bash
mvn clean package -DskipTests
java -jar target/governance-service-1.0.0-SNAPSHOT.jar
```
hoặc với Docker:
```bash
docker build -t livingdocs-governance-service .
docker run -p 8085:8085 livingdocs-governance-service
```

