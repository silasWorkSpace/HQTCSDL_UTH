package com.livingdocs.common.events;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Chuyển {@link EventsEnvelope} ↔ chuỗi JSON. Consumer đọc field {@code payload}
 * bằng {@link #payloadOf} rồi tự parse theo {@code type} của mình.
 */
public final class EnvelopeCodec {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static String serialize(EventsEnvelope envelope) {
        try {
            ObjectNode node = MAPPER.createObjectNode();
            node.put("eventId", envelope.eventId().toString());
            node.put("type", envelope.type());
            node.put("tenant", envelope.tenant());
            if (envelope.correlationId() != null) {
                node.put("correlationId", envelope.correlationId().toString());
            }
            node.put("occurredAt", envelope.occurredAt().toString());
            node.putPOJO("payload", MAPPER.readTree(envelope.payload()));
            return MAPPER.writeValueAsString(node);
        } catch (Exception e) {
            throw new IllegalArgumentException("Khong serialize duoc envelope", e);
        }
    }

    public static EventsEnvelope deserialize(String json) {
        try {
            JsonNode node = MAPPER.readTree(json);
            return new EventsEnvelope(
                    UUID.fromString(node.path("eventId").asText()),
                    node.path("type").asText(),
                    node.path("tenant").asText(),
                    node.hasNonNull("correlationId")
                            ? UUID.fromString(node.get("correlationId").asText()) : null,
                    OffsetDateTime.parse(node.path("occurredAt").asText()),
                    node.path("payload").toString());
        } catch (Exception e) {
            throw new IllegalArgumentException("Message Kafka khong dung dinh dang envelope", e);
        }
    }

    /** Trả về {@code payload} dạng cây JSON, hoặc cây rỗng nếu payload thiếu. */
    public static JsonNode payloadOf(String json) {
        try {
            return MAPPER.readTree(json).path("payload");
        } catch (Exception e) {
            throw new IllegalArgumentException("Khong doc payload tu message", e);
        }
    }

    private EnvelopeCodec() {
    }
}
