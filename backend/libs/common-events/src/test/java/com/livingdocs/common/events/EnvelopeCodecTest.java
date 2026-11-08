package com.livingdocs.common.events;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EnvelopeCodecTest {

    @Test
    void serializeThenDeserializeKeepsAllFields() {
        UUID eventId = UUID.randomUUID();
        UUID correlationId = UUID.randomUUID();
        OffsetDateTime occurredAt = OffsetDateTime.parse("2026-11-05T10:15:30+07:00");
        EventsEnvelope original = new EventsEnvelope(eventId, EventTypes.DRIFT_FOUND, "ws_acme",
                correlationId, occurredAt, "{\"documentId\":\"d1\"}");

        String json = EnvelopeCodec.serialize(original);
        EventsEnvelope parsed = EnvelopeCodec.deserialize(json);

        assertThat(parsed.eventId()).isEqualTo(eventId);
        assertThat(parsed.type()).isEqualTo(EventTypes.DRIFT_FOUND);
        assertThat(parsed.tenant()).isEqualTo("ws_acme");
        assertThat(parsed.correlationId()).isEqualTo(correlationId);
        assertThat(parsed.occurredAt().toInstant()).isEqualTo(occurredAt.toInstant());
    }

    @Test
    void payloadOfReturnsPayloadSubtree() {
        EventsEnvelope envelope = EventsEnvelope.of(EventTypes.NOTIFICATION, "ws_acme",
                UUID.randomUUID(), "{\"recipient\":\"u1\",\"message\":\"co ban can duyet\"}");
        JsonNode payload = EnvelopeCodec.payloadOf(EnvelopeCodec.serialize(envelope));
        assertThat(payload.get("recipient").asText()).isEqualTo("u1");
    }

    @Test
    void deserializeRejectsInvalidJson() {
        assertThatThrownBy(() -> EnvelopeCodec.deserialize("{khong dung dinh dang"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
