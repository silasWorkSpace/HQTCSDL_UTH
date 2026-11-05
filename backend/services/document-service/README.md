# LivingDocs Document Service

Service quản lý vòng đời tài liệu, phiên bản bất biến, kiểm tra tính toàn vẹn (hash chain) và tích hợp tác vụ AI generation.

## Chức năng
- **Document Management**: Danh sách, bộ lọc repository, trạng thái, phân trang, và chi tiết tài liệu với 3 trạng thái độc lập (`doc_status`, `publish_status`, `pr_status`).
- **Version Control & Draft**: Cập nhật bản nháp gọi trực tiếp `sp_append_document_version`, bảo toàn tính bất biến của lịch sử.
- **Diff & Rollback**: So sánh các phiên bản và khôi phục về phiên bản cũ thông qua `sp_rollback_document`.
- **Hash Integrity Verification**: Kiểm tra toàn vẹn chuỗi hash SHA-256 thông qua `sp_verify_version_chain`.
- **Document Links**: Truy xuất liên kết code entity, commit, PR, ticket từ `doc_code_link`.
- **AI Task Producer & Consumer**: Gửi yêu cầu sinh tài liệu `GENERATE_DOC` qua topic `ld.ai-jobs` và tiếp nhận kết quả `DOC_DRAFT` qua topic `ld.ai-results` để khởi tạo tài liệu tự động.

## API Endpoints
- `GET /api/v1/documents` - Danh sách tài liệu (lọc `repositoryId`, `docStatus`, pagination)
- `GET /api/v1/documents/{id}` - Chi tiết tài liệu
- `PUT /api/v1/documents/{id}/draft` - Cập nhật nội dung bản nháp (gọi `sp_append_document_version`)
- `GET /api/v1/documents/{id}/versions` - Timeline danh sách phiên bản
- `GET /api/v1/documents/{id}/versions/{n}` - Chi tiết phiên bản thứ `n`
- `GET /api/v1/documents/{id}/diff?from=&to=` - So sánh nội dung giữa hai phiên bản
- `POST /api/v1/documents/{id}/rollback` - Khôi phục phiên bản cũ (gọi `sp_rollback_document`)
- `GET /api/v1/documents/{id}/integrity` - Kiểm tra tính toàn vẹn chuỗi version hash
- `GET /api/v1/documents/{id}/links` - Danh sách liên kết code entity, commit, PR
- `POST /api/v1/documents/generate` - Gửi message bất đồng bộ yêu cầu AI sinh tài liệu

## Biến môi trường
- `PORT`: `8083`
- `DB_URL`: JDBC URL kết nối SQL Server
- `DB_USER` / `DB_PASSWORD`: Thông tin xác thực database
- `KAFKA_SERVERS`: Địa chỉ Kafka Broker (`localhost:9092`)
- `JWT_SECRET`: Khóa bí mật JWT

## Cách chạy
```bash
mvn clean package -DskipTests
java -jar target/document-service-1.0.0-SNAPSHOT.jar
```
hoặc với Docker:
```bash
docker build -t livingdocs-document-service .
docker run -p 8083:8083 livingdocs-document-service
```
