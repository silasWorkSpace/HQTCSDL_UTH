package com.livingdocs.integration.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.livingdocs.integration.config.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/** Claims pending messages per tenant, waits for Kafka acknowledgements, and retries failures indefinitely. */
@Component
public class SourceEventOutboxDispatcher {
    private static final Logger log = LoggerFactory.getLogger(SourceEventOutboxDispatcher.class);
    private static final int BATCH_SIZE = 50;
    private static final int MAX_BACKOFF_SECONDS = 300;
    private static final Duration CLAIM_LEASE = Duration.ofMinutes(2);
    private static final long ACK_TIMEOUT_SECONDS = 30;

    private final JdbcTemplate jdbc;
    private final KafkaTemplate<String, Object> kafka;
    private final ObjectMapper mapper;
    private final String topic;
    private final Set<String> warnedUnmigratedSchemas = ConcurrentHashMap.newKeySet();

    public SourceEventOutboxDispatcher(JdbcTemplate jdbc, KafkaTemplate<String, Object> kafka,
            ObjectMapper mapper, @Value("${livingdocs.kafka.topics.source-events:ld.source-events}") String topic) {
        this.jdbc = jdbc;
        this.kafka = kafka;
        this.mapper = mapper;
        this.topic = topic;
    }

    @Scheduled(fixedDelayString = "${livingdocs.outbox.poll-interval:PT2S}")
    public void dispatch() {
        List<String> schemas = jdbc.query("SELECT schema_name FROM platform.workspace WHERE status = 'active'",
                (rs, row) -> rs.getString(1));
        for (String schema : schemas) {
            if (schema == null || !schema.matches("ws_[a-z0-9_]{2,30}")) {
                log.error("Ignoring invalid active workspace schema name: {}", schema);
                continue;
            }
            Integer hasOutbox = jdbc.queryForObject(
                    "SELECT OBJECT_ID(N'[" + schema + "].event_outbox', 'U')", Integer.class);
            if (hasOutbox == null) {
                if (warnedUnmigratedSchemas.add(schema)) {
                    log.warn("Skipping active workspace {} until its event outbox migration is applied", schema);
                }
                continue;
            }
            try {
                TenantContext.runWith(schema, () -> {
                    dispatchTenant(schema);
                    return null;
                });
            } catch (RuntimeException ex) {
                log.error("Outbox dispatch failed for workspace {}", schema, ex);
            }
        }
    }

    private void dispatchTenant(String schema) {
        for (OutboxMessage message : claim(schema)) {
            try {
                JsonNode tree = mapper.readTree(message.payload());
                Object envelope = mapper.treeToValue(tree, Object.class);
                JsonNode repositoryId = tree.path("payload").path("repositoryId");
                String key = repositoryId.isTextual() ? repositoryId.asText() : tree.path("tenant").asText();
                kafka.send(topic, key, envelope).get(ACK_TIMEOUT_SECONDS, TimeUnit.SECONDS);
                jdbc.update("UPDATE [" + schema + "].event_outbox SET status='sent', sent_at=SYSUTCDATETIME(), "
                                + "locked_until=NULL, lock_token=NULL, last_error=NULL WHERE id=? AND status='processing' AND lock_token=?",
                        message.id(), message.lockToken());
            } catch (Exception ex) {
                recordFailure(schema, message, ex);
            }
        }
    }

    private List<OutboxMessage> claim(String schema) {
        String sql = """
                ;WITH claimable AS (
                    SELECT TOP (?) * FROM [%s].event_outbox WITH (UPDLOCK, READPAST, ROWLOCK)
                    WHERE next_attempt_at <= SYSUTCDATETIME()
                      AND (status = 'pending' OR (status = 'processing' AND locked_until < SYSUTCDATETIME()))
                    ORDER BY id
                )
                UPDATE claimable
                   SET status='processing', lock_token=?, locked_until=DATEADD(SECOND, ?, SYSUTCDATETIME())
                OUTPUT inserted.id, inserted.event_id, inserted.payload, inserted.lock_token
                """.formatted(schema);
        UUID token = UUID.randomUUID();
        return jdbc.query(sql, (rs, row) -> new OutboxMessage(rs.getLong("id"),
                rs.getObject("event_id", UUID.class), rs.getString("payload"),
                rs.getObject("lock_token", UUID.class)), BATCH_SIZE, token, (int) CLAIM_LEASE.toSeconds());
    }

    private void recordFailure(String schema, OutboxMessage message, Exception failure) {
        String error = failure.getMessage() == null ? failure.getClass().getSimpleName() : failure.getMessage();
        if (error.length() > 2000) error = error.substring(0, 2000);
        int attempts = jdbc.queryForObject("SELECT attempts + 1 FROM [" + schema
                + "].event_outbox WHERE id=? AND lock_token=?", Integer.class, message.id(), message.lockToken());
        int backoff = (int) Math.min(MAX_BACKOFF_SECONDS, 5L << Math.min(attempts - 1, 6));
        jdbc.update("UPDATE [" + schema + "].event_outbox SET status='pending', attempts=?, "
                        + "next_attempt_at=DATEADD(SECOND, ?, SYSUTCDATETIME()), locked_until=NULL, lock_token=NULL, last_error=? "
                        + "WHERE id=? AND status='processing' AND lock_token=?",
                attempts, backoff, error, message.id(), message.lockToken());
        log.warn("Kafka delivery failed for outbox event {} in {} (attempt {}, retry in {}s): {}",
                message.eventId(), schema, attempts, backoff, error);
    }

    private record OutboxMessage(long id, UUID eventId, String payload, UUID lockToken) {}
}
