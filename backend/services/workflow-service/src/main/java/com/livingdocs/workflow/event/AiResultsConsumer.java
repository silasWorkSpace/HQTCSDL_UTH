package com.livingdocs.workflow.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.livingdocs.common.events.EnvelopeCodec;
import com.livingdocs.common.events.EventTypes;
import com.livingdocs.common.events.Topics;
import com.livingdocs.workflow.service.DriftService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Consumer ld.ai-results — chỉ xử lý DRIFT_FOUND (DOC_DRAFT do document-service
 * tiêu thụ). Idempotent: DRIFT_FOUND trùng (source_event, document, type) bị
 * bỏ qua phía DriftService (FR-DR-13).
 */
@Component
@ConditionalOnProperty(name = "app.kafka.enabled", havingValue = "true")
public class AiResultsConsumer {

    private static final Logger log = LoggerFactory.getLogger(AiResultsConsumer.class);

    private final DriftService driftService;

    public AiResultsConsumer(DriftService driftService) {
        this.driftService = driftService;
    }

    @KafkaListener(topics = Topics.AI_RESULTS, groupId = "workflow-service")
    public void onMessage(ConsumerRecord<String, String> record) {
        try {
            var envelope = EnvelopeCodec.deserialize(record.value());
            if (!EventTypes.DRIFT_FOUND.equals(envelope.type())) {
                log.debug("Bo qua message khong phai DRIFT_FOUND: type={}", envelope.type());
                return;
            }
            JsonNode payload = EnvelopeCodec.payloadOf(record.value());
            driftService.onDriftFound(envelope.tenant(), payload);
        } catch (Exception e) {
            // Không ném lại: ack message, ghi log để xem thủ công (DLQ ở mức AI job)
            log.error("Xu ly DRIFT_FOUND that bai offset={} value={}", record.offset(), record.value(), e);
        }
    }
}
