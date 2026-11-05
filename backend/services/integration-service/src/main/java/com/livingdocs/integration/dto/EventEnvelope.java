package com.livingdocs.integration.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Cấu trúc Envelope sự kiện chung theo chuẩn kiến trúc LivingDocs.
 */
public record EventEnvelope<T>(
        UUID eventId,
        String type,
        String tenant,
        UUID correlationId,
        Instant occurredAt,
        T payload
) {
    public static <T> EventEnvelope<T> of(String type, String tenant, UUID correlationId, T payload) {
        return new EventEnvelope<>(
                UUID.randomUUID(),
                type,
                tenant,
                correlationId != null ? correlationId : UUID.randomUUID(),
                Instant.now(),
                payload
        );
    }
}
