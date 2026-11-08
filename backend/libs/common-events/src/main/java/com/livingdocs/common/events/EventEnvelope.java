package com.livingdocs.common.events;

import java.time.Instant;
import java.util.UUID;

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

    public String getEventId() {
        return eventId;
    }

    public void setEventId(String eventId) {
        this.eventId = eventId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getTenant() {
        return tenant;
    }

    public void setTenant(String tenant) {
        this.tenant = tenant;
    }

    public String getCorrelationId() {
        return correlationId;
    }

    public void setCorrelationId(String correlationId) {
        this.correlationId = correlationId;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public void setOccurredAt(Instant occurredAt) {
        this.occurredAt = occurredAt;
    }

    public T getPayload() {
        return payload;
    }

    public void setPayload(T payload) {
        this.payload = payload;
    }
}

