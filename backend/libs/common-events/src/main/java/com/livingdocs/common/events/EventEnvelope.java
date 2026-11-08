package com.livingdocs.common.events;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Phong bì chung cho mọi message Kafka của LivingDocs.
 * Hỗ trợ cả Generic payload T (DTO) và Map payload, tương thích cả Record accessors và JavaBean getters.
 */
public class EventEnvelope<T> {
    private String eventId;
    private String type;
    private String tenant;
    private String correlationId;
    private Instant occurredAt;
    private T payload;

    public EventEnvelope() {
        this.eventId = UUID.randomUUID().toString();
        this.occurredAt = Instant.now();
    }

    public EventEnvelope(String type, String tenant, String correlationId, T payload) {
        this.eventId = UUID.randomUUID().toString();
        this.type = type;
        this.tenant = tenant;
        this.correlationId = correlationId;
        this.occurredAt = Instant.now();
        this.payload = payload;
    }

    public EventEnvelope(String eventId, String type, String tenant, String correlationId, Instant occurredAt, T payload) {
        this.eventId = eventId != null ? eventId : UUID.randomUUID().toString();
        this.type = type;
        this.tenant = tenant;
        this.correlationId = correlationId;
        this.occurredAt = occurredAt != null ? occurredAt : Instant.now();
        this.payload = payload;
    }

    public static EventEnvelope<Map<String, Object>> of(String type, String tenant, String correlationId, Map<String, Object> payload) {
        return new EventEnvelope<>(
                UUID.randomUUID().toString(),
                type,
                tenant,
                correlationId,
                Instant.now(),
                payload == null ? Map.of() : payload
        );
    }

    // Record-style accessors
    public String eventId() { return eventId; }
    public String type() { return type; }
    public String tenant() { return tenant; }
    public String correlationId() { return correlationId; }
    public Instant occurredAt() { return occurredAt; }
    public T payload() { return payload; }

    // JavaBean getters and setters
    public String getEventId() { return eventId; }
    public void setEventId(String eventId) { this.eventId = eventId; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getTenant() { return tenant; }
    public void setTenant(String tenant) { this.tenant = tenant; }
    public String getCorrelationId() { return correlationId; }
    public void setCorrelationId(String correlationId) { this.correlationId = correlationId; }
    public Instant getOccurredAt() { return occurredAt; }
    public void setOccurredAt(Instant occurredAt) { this.occurredAt = occurredAt; }
    public T getPayload() { return payload; }
    public void setPayload(T payload) { this.payload = payload; }
}
