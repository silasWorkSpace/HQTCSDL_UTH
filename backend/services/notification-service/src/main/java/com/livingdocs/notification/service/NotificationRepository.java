package com.livingdocs.notification.service;

import com.livingdocs.notification.config.TenantSchema;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Truy cập bảng notification (thuộc schema tenant, cụm bảng của Người 1).
 * Ghi chú cho nhóm: nếu đổi cấu trúc bảng notification thì báo Người 1 trước.
 */
@Repository
public class NotificationRepository {

    private final JdbcTemplate jdbc;

    public NotificationRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<Map<String, Object>> MAPPER = (rs, i) -> {
        Map<String, Object> row = new HashMap<>();
        row.put("id", rs.getObject("id", UUID.class));
        row.put("recipientUserId", rs.getObject("recipient_user_id", UUID.class));
        row.put("channel", rs.getString("channel"));
        row.put("eventType", rs.getString("event_type"));
        row.put("payload", rs.getString("payload"));
        row.put("status", rs.getString("status"));
        Object readAt = rs.getObject("read_at");
        row.put("readAt", readAt instanceof Timestamp ts ? ts.toInstant().toString() : readAt);
        Object createdAt = rs.getObject("created_at");
        row.put("createdAt",
                createdAt instanceof OffsetDateTime odt ? odt.toString() : String.valueOf(createdAt));
        return row;
    };

    public void insert(String tenant, UUID recipientUserId, String channel, String eventType,
                       String payloadJson, UUID correlationId) {
        jdbc.update("INSERT INTO " + TenantSchema.qualify(tenant, "notification")
                        + " (recipient_user_id, channel, event_type, payload, status, correlation_id, "
                        + "sent_at) VALUES (?, ?, ?, ?, 'sent', ?, SYSUTCDATETIME())",
                recipientUserId, channel, eventType, payloadJson, correlationId);
    }

    /** NTF-01: danh sách thông báo của người dùng hiện tại; unread=true chỉ lấy chưa đọc. */
    public List<Map<String, Object>> listForUser(String tenant, UUID userId, boolean unreadOnly) {
        String sql = "SELECT id, recipient_user_id, channel, event_type, payload, status, read_at, "
                + "created_at FROM " + TenantSchema.qualify(tenant, "notification")
                + " WHERE recipient_user_id = ?";
        if (unreadOnly) {
            sql += " AND read_at IS NULL";
        }
        sql += " ORDER BY created_at DESC";
        return jdbc.query(sql, MAPPER, userId);
    }

    public Optional<UUID> findRecipient(String tenant, UUID notificationId) {
        return jdbc.query("SELECT recipient_user_id FROM "
                        + TenantSchema.qualify(tenant, "notification") + " WHERE id = ?",
                (rs, i) -> rs.getObject("recipient_user_id", UUID.class), notificationId)
                .stream().findFirst();
    }

    public int markRead(String tenant, UUID notificationId) {
        return jdbc.update("UPDATE " + TenantSchema.qualify(tenant, "notification")
                + " SET read_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME() "
                + "WHERE id = ? AND read_at IS NULL", notificationId);
    }
}
