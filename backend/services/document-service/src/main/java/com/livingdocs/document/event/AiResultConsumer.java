package com.livingdocs.document.event;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.livingdocs.common.events.DocDraftPayload;
import com.livingdocs.common.events.EventEnvelope;
import com.livingdocs.document.service.DocumentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class AiResultConsumer {

    private static final Logger log = LoggerFactory.getLogger(AiResultConsumer.class);

    private final DocumentService documentService;
    private final ObjectMapper objectMapper;

    public AiResultConsumer(DocumentService documentService, ObjectMapper objectMapper) {
        this.documentService = documentService;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = "ld.ai-results", groupId = "document-service-group")
    public void consumeAiResult(String message) {
        try {
            EventEnvelope<DocDraftPayload> envelope = objectMapper.readValue(
                message,
                new TypeReference<EventEnvelope<DocDraftPayload>>() {}
            );

            if ("DOC_DRAFT".equalsIgnoreCase(envelope.getType())) {
                log.info("Processing DOC_DRAFT event ID: {}, correlation: {}", envelope.getEventId(), envelope.getCorrelationId());
                documentService.processDocDraftEvent(envelope);
            }
        } catch (Exception ex) {
            log.error("Failed to process event from ld.ai-results: {}", ex.getMessage(), ex);
        }
    }
}

