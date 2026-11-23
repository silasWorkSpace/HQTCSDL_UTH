package com.livingdocs.workflow;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.livingdocs.workflow.service.AuditService;
import com.livingdocs.workflow.service.KafkaNotifyPort;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Hai lỗi từng làm hỏng luồng khi bật Kafka: JSON thông báo dựng bằng nối chuỗi
 * (tiêu đề có dấu nháy → message hỏng, thiếu eventType) và detail audit không phải JSON.
 */
class NotifyAndAuditPayloadTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void notificationPayloadSurvivesQuotesInTitleAndKeepsEventType() throws Exception {
        UUID user = UUID.randomUUID();
        String message = "Tài liệu \"API \\ Login\" bị từ chối: sai \"mô tả\"\nxuống dòng";

        String json = KafkaNotifyPort.buildPayload(user, "DOC_REJECTED", message, null);

        JsonNode node = MAPPER.readTree(json); // phải là JSON hợp lệ
        assertThat(node.path("recipientUserId").asText()).isEqualTo(user.toString());
        assertThat(node.path("eventType").asText()).isEqualTo("DOC_REJECTED");
        assertThat(node.path("message").asText()).isEqualTo(message);
    }

    @Test
    void notificationPayloadDefaultsEventTypeAndNestsExtraPayload() throws Exception {
        UUID user = UUID.randomUUID();

        JsonNode node = MAPPER.readTree(
                KafkaNotifyPort.buildPayload(user, null, null, "{\"documentId\":\"d1\"}"));

        assertThat(node.path("eventType").asText()).isEqualTo("GENERAL");
        assertThat(node.path("message").asText()).isEmpty();
        assertThat(node.path("payload").path("documentId").asText()).isEqualTo("d1");
    }

    @Test
    void notificationPayloadIgnoresNonObjectExtraPayload() throws Exception {
        JsonNode node = MAPPER.readTree(
                KafkaNotifyPort.buildPayload(UUID.randomUUID(), "X", "m", "[1,2]"));

        assertThat(node.has("payload")).isFalse();
    }

    @Test
    void auditDetailValidJsonIsKeptAsIs() {
        String valid = "{\"task\":\"t1\",\"decision\":\"APPROVE\"}";
        assertThat(AuditService.safeJson(valid)).isEqualTo(valid);
    }

    @Test
    void auditDetailInvalidJsonIsWrappedAsRaw() throws Exception {
        String bad = "{\"reason\":\"co \\ dau \"nhay\" va\nxuong dong\"}";

        String safe = AuditService.safeJson(bad);

        assertThat(safe).isNotNull();
        assertThat(MAPPER.readTree(safe).path("raw").asText()).isEqualTo(bad);
    }

    @Test
    void auditDetailNullOrBlankStaysNull() {
        assertThat(AuditService.safeJson(null)).isNull();
        assertThat(AuditService.safeJson("   ")).isNull();
    }
}
