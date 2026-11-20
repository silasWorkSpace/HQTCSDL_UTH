package com.livingdocs.workflow.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.livingdocs.common.events.Topics;
import com.livingdocs.workflow.service.ReviewService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Completes publication only from GitHub's verified pull_request.closed webhook. */
@Component
@ConditionalOnProperty(name = "app.kafka.enabled", havingValue = "true")
public class DocumentationPullRequestConsumer {
    private static final Logger log = LoggerFactory.getLogger(DocumentationPullRequestConsumer.class);
    private static final Pattern DOCUMENT_MARKER = Pattern.compile("(?m)^LivingDocs-Document-ID:\\s*([0-9a-fA-F-]{36})\\s*$");
    private final ObjectMapper mapper = new ObjectMapper();
    private final ReviewService reviewService;

    public DocumentationPullRequestConsumer(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @KafkaListener(topics = Topics.SOURCE_EVENTS, groupId = "workflow-doc-pr")
    public void onMessage(ConsumerRecord<String, String> record) {
        try {
            JsonNode envelope = mapper.readTree(record.value());
            JsonNode event = envelope.path("payload").path("payload");
            if (event.isTextual()) event = mapper.readTree(event.asText());
            if (!"pull_request".equals(envelope.path("payload").path("eventType").asText())
                    && !event.has("pull_request")) return;
            if (!"closed".equals(event.path("action").asText())) return;
            JsonNode pr = event.path("pull_request");
            String body = pr.path("body").asText("");
            Matcher marker = DOCUMENT_MARKER.matcher(body);
            if (!marker.find()) return;
            UUID documentId = UUID.fromString(marker.group(1));
            String tenant = envelope.path("tenant").asText();
            reviewService.onDocumentationPullRequestClosed(tenant, documentId, pr.path("merged").asBoolean(false));
        } catch (Exception ex) {
            log.error("Failed to handle documentation PR close event offset={}", record.offset(), ex);
            throw new IllegalStateException("Documentation PR webhook processing failed", ex);
        }
    }
}
