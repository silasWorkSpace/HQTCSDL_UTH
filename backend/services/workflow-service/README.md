# workflow-service

Quy trình duyệt tài liệu (Developer → Staff → Manager → Approved → Published), cảnh báo drift và hàng đợi gợi ý cập nhật.
Cổng **8084**. Swagger UI: `http://localhost:8084/swagger-ui.html`. Health: `/actuator/health`.

## Chạy

```bash
# từ thư mục backend/
mvn -pl services/workflow-service -am spring-boot:run
# hoặc Docker (context là backend/)
docker build -f services/workflow-service/Dockerfile -t livingdocs/workflow-service backend
```

Cần SQL Server đã dựng bằng `infra/db.ps1` (đã tạo tenant, ví dụ `demo`).

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME` | `localhost`, `1433`, `livingdocs` | Kết nối SQL Server |
| `DB_USER`, `DB_PASSWORD` | `sa`, (xem `.env.example`) | Tài khoản DB |
| `JWT_SECRET` | khóa dev | Khóa HS256 dùng chung với gateway và identity (tối thiểu 32 byte) |
| `KAFKA_ENABLED` | `false` | `true` thì nhận `DRIFT_FOUND` từ `ld.ai-results` và gửi thông báo qua `ld.notifications` |
| `KAFKA_BOOTSTRAP` | `localhost:9092` | Địa chỉ Kafka |

## Endpoint (đường dẫn `/api/v1`, mọi endpoint kiểm tra JWT và vai trò phía server)

| Method và đường dẫn | Vai trò | Mã SRS |
|---|---|---|
| `POST /documents/{id}/submit` | Developer, Staff, Manager, Technical Lead, Administrator | GEN-10 |
| `GET /reviews/queue?level=staff\|manager` | Staff, Manager, Technical Lead, Administrator | WF-01, 12 |
| `GET /reviews/{id}` | Staff, Manager, Technical Lead, Administrator | WF-03, 04, 05 |
| `POST /reviews/{id}/decisions` | Staff, Manager, Administrator | WF-09, 10, 14, 15, 22 |
| `GET /documents/{id}/drift-alerts` | mọi vai trò nội bộ | DR-12 |
| `GET /suggestions?status=` | mọi vai trò nội bộ | AUTO-02 |
| `POST /suggestions/{id}/accept`, `/edit`, `/dismiss` | Developer, Administrator | AUTO-07, 08, 09, DR-09 |

Kafka: nhận `DRIFT_FOUND` (payload `{documentId, sourceEventId, findings:[{driftType, severity, evidence, suggestion:{content, confidence}}]}`), gửi `NOTIFICATION` tới `ld.notifications`.

Publish tuần này là giả lập (`PublishSimulator`): `APPROVED → PENDING_MERGE → PUBLISHED`.

## Test

```bash
mvn -pl services/workflow-service test
```
