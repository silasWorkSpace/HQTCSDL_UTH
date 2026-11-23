# notification-service

Thông báo trong ứng dụng (kênh `in_app`). Nhận `NOTIFICATION` từ topic `ld.notifications` và ghi bảng `notification`.
Cổng **8086**. Swagger UI: `http://localhost:8086/swagger-ui.html`. Health: `/actuator/health`.

## Chạy

```bash
# từ thư mục backend/
mvn -pl services/notification-service -am spring-boot:run
# hoặc Docker (context là backend/)
docker build -f services/notification-service/Dockerfile -t livingdocs/notification-service backend
```

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME` | `localhost`, `1433`, `livingdocs` | Kết nối SQL Server |
| `DB_USER`, `DB_PASSWORD` | `sa`, (xem `.env.example`) | Tài khoản DB |
| `JWT_SECRET` | khóa dev | Khóa HS256 dùng chung (tối thiểu 32 byte) |
| `KAFKA_ENABLED` | `false` | `true` thì bật consumer `ld.notifications` |
| `KAFKA_BOOTSTRAP` | `localhost:9092` | Địa chỉ Kafka |

## Endpoint (NTF-01, cần JWT; người dùng chỉ thấy thông báo của chính mình)

| Method và đường dẫn | Chức năng |
|---|---|
| `GET /api/v1/notifications?unread=true` | Danh sách thông báo của tôi, `unread=true` chỉ lấy chưa đọc |
| `POST /api/v1/notifications/{id}/read` | Đánh dấu đã đọc (chỉ người nhận, người khác nhận 403) |

Payload của message `NOTIFICATION`: `{recipientUserId, eventType, message, payload?}`. Slack để giai đoạn 2.

## Test

```bash
mvn -pl services/notification-service test
```
