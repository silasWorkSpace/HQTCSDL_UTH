package com.livingdocs.notification.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Nghiệp vụ thông báo trong ứng dụng (NTF-01).
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final NotificationRepository repo;

    public NotificationService(NotificationRepository repo) {
        this.repo = repo;
    }

    /** Consumer ld.notifications gọi: payload {recipientUserId, eventType, message, payload?}. */
    public void recordFromKafka(String tenant, UUID eventId, UUID correlationId, String payloadJson) {
        try {
            var payload = MAPPER.readTree(payloadJson);
            UUID recipient = UUID.fromString(payload.path("recipientUserId").asText());
            String eventType = payload.path("eventType").asText("GENERAL");
            ObjectNode body = payload.has("payload") && payload.get("payload").isObject()
                    ? (ObjectNode) payload.get("payload") : MAPPER.createObjectNode();
            body.put("message", payload.path("message").asText(""));
            repo.insert(tenant, recipient, "in_app", eventType, MAPPER.writeValueAsString(body),
                    correlationId);
        } catch (Exception e) {
            log.error("Khong ghi duoc thong bao tu Kafka eventId={}", eventId, e);
        }
    }

    public List<Map<String, Object>> myNotifications(String tenant, UUID userId, boolean unreadOnly) {
        return repo.listForUser(tenant, userId, unreadOnly);
    }

    /** Chỉ người nhận mới được đánh dấu đã đọc (kiểm tra phía server, NFR-SEC-02). */
    public void markRead(String tenant, UUID notificationId, UUID currentUserId) {
        UUID recipient = repo.findRecipient(tenant, notificationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Thông báo không tồn tại"));
        if (!recipient.equals(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Chỉ người nhận được đánh dấu đã đọc");
        }
        repo.markRead(tenant, notificationId);
    }
}
