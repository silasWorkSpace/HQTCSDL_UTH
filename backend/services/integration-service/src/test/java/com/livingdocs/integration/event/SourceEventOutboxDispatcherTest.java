package com.livingdocs.integration.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.livingdocs.integration.config.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

import java.sql.ResultSet;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SourceEventOutboxDispatcherTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    @SuppressWarnings("unchecked")
    private final KafkaTemplate<String, Object> kafka = mock(KafkaTemplate.class);
    private final UUID eventId = UUID.randomUUID();
    private final UUID lockToken = UUID.randomUUID();
    private final UUID repositoryId = UUID.randomUUID();
    private final String payload = "{\"eventId\":\"" + eventId + "\",\"tenant\":\"demo\","
            + "\"payload\":{\"repositoryId\":\"" + repositoryId + "\"}}";

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @Test
    void brokerAcknowledgementMarksClaimedEventSent() throws Exception {
        prepareClaim();
        when(kafka.send(eq("ld.source-events"), eq(repositoryId.toString()), any()))
                .thenReturn(CompletableFuture.completedFuture((SendResult<String, Object>) null));

        dispatcher().dispatch();

        verify(jdbc).update(contains("status='sent'"), anyLong(), eq(lockToken));
    }

    @Test
    void brokerFailureKeepsEventPendingWithRetryMetadata() throws Exception {
        prepareClaim();
        when(kafka.send(eq("ld.source-events"), eq(repositoryId.toString()), any()))
                .thenReturn(CompletableFuture.failedFuture(new IllegalStateException("broker unavailable")));
        when(jdbc.queryForObject(contains("SELECT attempts + 1"), eq(Integer.class), anyLong(), eq(lockToken)))
                .thenReturn(1);

        dispatcher().dispatch();

        verify(jdbc).update(contains("status='pending'"), eq(1), eq(5), contains("broker unavailable"),
                anyLong(), eq(lockToken));
    }

    private SourceEventOutboxDispatcher dispatcher() {
        return new SourceEventOutboxDispatcher(jdbc, kafka, new ObjectMapper(), "ld.source-events");
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private void prepareClaim() throws Exception {
        when(jdbc.queryForObject(contains("OBJECT_ID"), eq(Integer.class))).thenReturn(1);
        when(jdbc.query(eq("SELECT schema_name FROM platform.workspace WHERE status = 'active'"),
                any(RowMapper.class))).thenReturn(List.of("ws_demo"));
        ResultSet rs = mock(ResultSet.class);
        when(rs.getLong("id")).thenReturn(1L);
        when(rs.getObject("event_id", UUID.class)).thenReturn(eventId);
        when(rs.getString("payload")).thenReturn(payload);
        when(rs.getObject("lock_token", UUID.class)).thenReturn(lockToken);
        doAnswer(invocation -> {
            RowMapper mapper = invocation.getArgument(1);
            return List.of(mapper.mapRow(rs, 0));
        }).when(jdbc).query(contains(";WITH claimable"), any(RowMapper.class), any(Object[].class));
    }
}
