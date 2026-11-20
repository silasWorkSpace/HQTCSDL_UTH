package com.livingdocs.integration.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.livingdocs.integration.config.TenantContext;
import com.livingdocs.integration.dto.EventEnvelope;
import com.livingdocs.integration.dto.SourceEventDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** Persists source messages in the tenant transaction; Kafka delivery is handled by the outbox dispatcher. */
@Component
public class SourceEventProducer {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public SourceEventProducer(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public void publishSourceEvent(SourceEventDto eventDto) {
        String tenant = TenantContext.getTenant();
        UUID correlationId = eventDto.correlationId() != null ? eventDto.correlationId() : UUID.randomUUID();
        EventEnvelope<SourceEventDto> envelope = new EventEnvelope<>(
                eventDto.id(), "SOURCE_EVENT_RECEIVED", tenant, correlationId,
                eventDto.receivedAt(), eventDto);
        final String payload;
        try {
            payload = mapper.writeValueAsString(envelope);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Could not serialize source event for outbox", ex);
        }

        String schema = TenantContext.getSchemaName();
        jdbc.update("""
                IF NOT EXISTS (SELECT 1 FROM [%s].event_outbox WITH (UPDLOCK, HOLDLOCK) WHERE event_id = ?)
                    INSERT INTO [%s].event_outbox (event_id, analysis_run_id, correlation_id, payload)
                    VALUES (?, ?, ?, ?)
                """.formatted(schema, schema),
                eventDto.id(), eventDto.id(), eventDto.analysisRunId(), correlationId, payload);
    }
}
