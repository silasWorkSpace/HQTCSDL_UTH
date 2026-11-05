package com.livingdocs.integration.controller;

import com.livingdocs.integration.service.WebhookProcessingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/webhooks/github")
@Tag(name = "Webhook Ingestion", description = "Tiếp nhận webhook sự kiện từ GitHub Platform")
public class GitHubWebhookController {

    private static final Logger log = LoggerFactory.getLogger(GitHubWebhookController.class);

    private final WebhookProcessingService webhookService;

    public GitHubWebhookController(WebhookProcessingService webhookService) {
        this.webhookService = webhookService;
    }

    @PostMapping
    @Operation(summary = "Tiếp nhận webhook sự kiện PR/Commit từ GitHub (GH-08, DR-14, NFR-SEC-06, NFR-REL-05)")
    public ResponseEntity<Map<String, Object>> handleWebhook(
            @RequestHeader(value = "X-Hub-Signature-256", required = false) String signatureHeader,
            @RequestHeader(value = "X-GitHub-Event", defaultValue = "pull_request") String eventTypeHeader,
            @RequestHeader(value = "X-GitHub-Delivery", required = false) String deliveryIdHeader,
            @RequestBody String rawPayload
    ) {
        long startTime = System.currentTimeMillis();

        if (signatureHeader == null || signatureHeader.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Thiếu header chữ ký X-Hub-Signature-256"));
        }

        String deliveryId = (deliveryIdHeader != null && !deliveryIdHeader.isBlank())
                ? deliveryIdHeader
                : UUID.randomUUID().toString();

        try {
            WebhookProcessingService.WebhookResult result = webhookService.processWebhook(
                    rawPayload,
                    signatureHeader,
                    eventTypeHeader,
                    deliveryId
            );

            long elapsed = System.currentTimeMillis() - startTime;
            log.info("Phản hồi webhook thành công sau {} ms (Yêu cầu SLA < 3000ms: {})", elapsed, elapsed < 3000);

            return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of(
                    "status", "accepted",
                    "eventId", result.eventId() != null ? result.eventId().toString() : "skipped",
                    "isDuplicate", result.isDuplicate(),
                    "createdByLivingDocs", result.createdByLivingDocs(),
                    "message", result.message(),
                    "processingTimeMs", elapsed
            ));

        } catch (SecurityException se) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", se.getMessage()));
        } catch (Exception e) {
            log.error("Lỗi khi xử lý webhook: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
