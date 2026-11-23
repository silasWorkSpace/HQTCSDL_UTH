package com.livingdocs.integration.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.livingdocs.integration.config.TenantContext;
import com.livingdocs.integration.dto.SourceEventDto;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SourceEventProducerTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final SourceEventProducer producer = new SourceEventProducer(jdbc, new ObjectMapper().findAndRegisterModules());

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @Test
    void enqueuesStableEnvelopeIdempotentlyForCurrentTenant() {
        UUID eventId = UUID.randomUUID();
        UUID repositoryId = UUID.randomUUID();
        UUID runId = UUID.randomUUID();
        UUID correlationId = UUID.randomUUID();
        SourceEventDto event = new SourceEventDto(eventId, repositoryId, "commit", "refs/heads/main", "closed",
                "delivery", null, false, correlationId, Instant.parse("2026-01-01T00:00:00Z"), "{}", runId);

        TenantContext.runWith("demo", () -> {
            producer.publishSourceEvent(event);
            producer.publishSourceEvent(event);
            return null;
        });

        verify(jdbc, times(2)).update(contains("IF NOT EXISTS"),
                eq(eventId), eq(eventId), eq(runId), eq(correlationId), argThat((Object payload) ->
                        payload.toString().contains("\"eventId\":\"" + eventId + "\"")
                                && payload.toString().contains("\"tenant\":\"demo\"")
                                && payload.toString().contains("\"analysisRunId\":\"" + runId + "\"")));
    }
}
