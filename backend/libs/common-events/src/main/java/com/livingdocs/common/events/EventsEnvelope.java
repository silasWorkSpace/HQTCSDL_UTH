package com.livingdocs.common.events;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Envelope dùng chung cho mọi message Kafka (quy ước nhóm, buổi họp Thứ Hai).
 *
 * <p>Mỗi message trên các topic {@code ld.*} đều bọc trong envelope này:
 * <pre>{ "eventId", "type", "tenant", "correlationId", "occurredAt", "payload" }</pre>
 *
 * @param eventId       UUID của message (để idempotent phía consumer)
 * @param type          loại sự kiện, ví dụ {@link EventTypes#DRIFT_FOUND}
 * @param tenant        mã workspace (schema {@code ws_&lt;code&gt;})
 * @param correlationId UUID truy vết qua các service (NFR-REL-02)
 * @param occurredAt    thời điểm phát sự kiện, ISO-8601 UTC
 * @param payload       nội dung sự kiện, đã là chuỗi JSON
 */
public record EventsEnvelope(
        UUID eventId,
        String type,
        String tenant,
        UUID correlationId,
        OffsetDateTime occurredAt,
        String payload) {

    public static EventsEnvelope of(String type, String tenant, UUID correlationId, String payload) {
        return new EventsEnvelope(UUID.randomUUID(), type, tenant, correlationId,
                OffsetDateTime.now(), payload);
    }
}
