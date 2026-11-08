package com.livingdocs.common.events;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Phong bi chung cho moi message Kafka.
 *
 * @param eventId       ma duy nhat cua su kien
 * @param type          loai su kien (xem EventTypes)
 * @param tenant        ma workspace, vi du "demo"
 * @param correlationId ma truy vet xuyen suot cac dich vu (NFR-REL-02)
 * @param occurredAt    thoi diem xay ra (UTC)
 * @param payload       noi dung rieng cua tung loai su kien
 */
public record EventEnvelope(
        String eventId,
        String type,
        String tenant,
        String correlationId,
        Instant occurredAt,
        Map<String, Object> payload) {

    public static EventEnvelope of(String type, String tenant, String correlationId, Map<String, Object> payload) {
        return new EventEnvelope(
                UUID.randomUUID().toString(),
                type,
                tenant,
                correlationId,
                Instant.now(),
                payload == null ? Map.of() : payload);
    }
}
