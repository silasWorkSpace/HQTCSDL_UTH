package com.livingdocs.workflow.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.livingdocs.common.events.EventPublisher;
import com.livingdocs.common.events.EventTypes;
import com.livingdocs.common.events.EventsEnvelope;
import com.livingdocs.common.events.Topics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.UUID;

/**
 * Gửi thông báo thật qua Kafka topic ld.notifications (NTF-01) — notification-service
 * tiêu thụ và ghi bảng notification (kênh in_app). Bean được khai báo trong {@link NotifyConfig}.
 *
 * <p>Payload gửi đi: {@code {recipientUserId, eventType, message, payload?}} — đúng định dạng
 * {@code NotificationService.recordFromKafka} đọc. JSON được dựng bằng Jackson để
 * dấu nháy trong tiêu đề tài liệu hoặc lý do từ chối không làm hỏng message.
 * Thông báo là việc phụ: lỗi gửi chỉ ghi log, không làm hỏng nghiệp vụ duyệt.
 */
public class KafkaNotifyPort implements NotifyPort {

    private static final Logger log = LoggerFactory.getLogger(KafkaNotifyPort.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final EventPublisher publisher;

    public KafkaNotifyPort(EventPublisher publisher) {
        this.publisher = publisher;
    }

    @Override
    public void notifyUser(String tenant, UUID recipientUserId, String eventType, String message,
                           String payloadJson) {
        if (recipientUserId == null) {
            log.warn("Bo qua thong bao {}: khong co nguoi nhan", eventType);
            return;
        }
        try {
            String payload = buildPayload(recipientUserId, eventType, message, payloadJson);
            log.debug("Phat thong bao {} cho user {} qua ld.notifications", eventType, recipientUserId);
            publisher.publish(Topics.NOTIFICATIONS,
                    EventsEnvelope.of(EventTypes.NOTIFICATION, tenant, UUID.randomUUID(), payload));
        } catch (Exception e) {
            log.error("Khong gui duoc thong bao {} cho user {}", eventType, recipientUserId, e);
        }
    }

    /** Dựng payload JSON hợp lệ; {@code payloadJson} (nếu có và là object) nằm dưới khóa "payload". */
    public static String buildPayload(UUID recipientUserId, String eventType, String message,
                                      String payloadJson) throws Exception {
        ObjectNode node = MAPPER.createObjectNode();
        node.put("recipientUserId", recipientUserId.toString());
        node.put("eventType", (eventType == null || eventType.isBlank()) ? "GENERAL" : eventType);
        node.put("message", message == null ? "" : message);
        if (payloadJson != null && !payloadJson.isBlank()) {
            JsonNode extra = MAPPER.readTree(payloadJson);
            if (extra.isObject()) {
                node.set("payload", extra);
            }
        }
        return MAPPER.writeValueAsString(node);
    }
}
