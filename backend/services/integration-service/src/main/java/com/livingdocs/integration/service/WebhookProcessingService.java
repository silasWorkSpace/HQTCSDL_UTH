package com.livingdocs.integration.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.livingdocs.integration.crypto.HmacSignatureVerifier;
import com.livingdocs.integration.dto.RepositoryDto;
import com.livingdocs.integration.dto.SourceEventDto;
import com.livingdocs.integration.event.SourceEventProducer;
import com.livingdocs.integration.repository.IntegrationJdbcRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
public class WebhookProcessingService {

    private static final Logger log = LoggerFactory.getLogger(WebhookProcessingService.class);

    private final HmacSignatureVerifier signatureVerifier;
    private final IntegrationJdbcRepository repository;
    private final SourceEventProducer eventProducer;
    private final ObjectMapper objectMapper;

    public WebhookProcessingService(
            HmacSignatureVerifier signatureVerifier,
            IntegrationJdbcRepository repository,
            SourceEventProducer eventProducer,
            ObjectMapper objectMapper
    ) {
        this.signatureVerifier = signatureVerifier;
        this.repository = repository;
        this.eventProducer = eventProducer;
        this.objectMapper = objectMapper;
    }

    public record WebhookResult(UUID eventId, boolean isDuplicate, boolean createdByLivingDocs, String message) {}

    public WebhookResult processWebhook(
            String rawPayload,
            String signatureHeader,
            String eventTypeHeader,
            String deliveryIdHeader
    ) {
        // 1. Xác thực chữ ký HMAC SHA-256 (NFR-SEC-06)
        if (!signatureVerifier.verifySignature(rawPayload, signatureHeader)) {
            log.warn("Chữ ký HMAC không hợp lệ cho Webhook delivery={}", deliveryIdHeader);
            throw new SecurityException("Chữ ký webhook GitHub (X-Hub-Signature-256) không hợp lệ.");
        }

        try {
            JsonNode root = objectMapper.readTree(rawPayload);

            // 2. Trích xuất thông tin Repository
            JsonNode repoNode = root.path("repository");
            long githubRepoId = repoNode.path("id").asLong();

            Optional<RepositoryDto> repoOpt = repository.findRepositoryByGithubId(githubRepoId);
            UUID repositoryId;
            if (repoOpt.isPresent()) {
                repositoryId = repoOpt.get().id();
            } else {
                // Nếu repo chưa đăng ký trong workspace, ghi log và bỏ qua
                log.info("Bỏ qua webhook: Repository GitHub ID {} chưa được liên kết trong workspace.", githubRepoId);
                return new WebhookResult(null, false, false, "Repository chưa được liên kết.");
            }

            // 3. Chuẩn hóa Event Type và Ref
            String eventType = "pr";
            String githubRef = "refs/heads/main";
            String state = "open";

            if ("pull_request".equalsIgnoreCase(eventTypeHeader) || root.has("pull_request")) {
                eventType = "pr";
                JsonNode prNode = root.path("pull_request");
                githubRef = prNode.path("head").path("ref").asText("refs/pull/head");
                state = prNode.path("state").asText("open");
                if (prNode.path("merged").asBoolean(false)) {
                    state = "merged";
                }
            } else if ("push".equalsIgnoreCase(eventTypeHeader)) {
                eventType = "commit";
                githubRef = root.path("ref").asText("refs/heads/main");
                state = "closed";
            }

            // 4. Kiểm tra xem sự kiện có do chính LivingDocs tạo ra không (FR-DR-14)
            boolean createdByLivingDocs = isCreatedByLivingDocs(root);
            if (createdByLivingDocs) {
                log.info("Phát hiện sự kiện do LivingDocs Bot tạo: bỏ qua để ngăn vòng lặp PR (FR-DR-14).");
            }

            // Tính SHA-256 digest của payload
            String diffDigest = calculateDigest(rawPayload);
            UUID correlationId = UUID.randomUUID();

            // 5. Gọi Stored Procedure sp_ingest_source_event (Idempotent - NFR-REL-05)
            IntegrationJdbcRepository.IngestResult ingestResult = repository.ingestSourceEvent(
                    repositoryId,
                    eventType,
                    githubRef,
                    state,
                    deliveryIdHeader,
                    diffDigest,
                    createdByLivingDocs,
                    correlationId,
                    rawPayload
            );

            log.info("Đã xử lý webhook: eventId={}, isDuplicate={}", ingestResult.eventId(), ingestResult.isDuplicate());

            // 6. Nếu là sự kiện mới và KHÔNG phải bot tự sinh, bắn Kafka sang ld.source-events
            if (!ingestResult.isDuplicate() && !createdByLivingDocs && ingestResult.eventId() != null) {
                SourceEventDto eventDto = new SourceEventDto(
                        ingestResult.eventId(),
                        repositoryId,
                        eventType,
                        githubRef,
                        state,
                        deliveryIdHeader,
                        diffDigest,
                        createdByLivingDocs,
                        correlationId,
                        Instant.now(),
                        rawPayload
                );
                eventProducer.publishSourceEvent(eventDto);
            }

            return new WebhookResult(
                    ingestResult.eventId(),
                    ingestResult.isDuplicate(),
                    createdByLivingDocs,
                    ingestResult.isDuplicate() ? "Sự kiện đã tồn tại (Idempotent)." : "Tiếp nhận sự kiện thành công."
            );

        } catch (SecurityException se) {
            throw se;
        } catch (Exception e) {
            log.error("Lỗi xử lý nội dung webhook: {}", e.getMessage(), e);
            throw new RuntimeException("Lỗi xử lý webhook: " + e.getMessage(), e);
        }
    }

    private boolean isCreatedByLivingDocs(JsonNode root) {
        String senderLogin = root.path("sender").path("login").asText("");
        if (senderLogin.contains("livingdocs") || senderLogin.endsWith("[bot]")) {
            return true;
        }
        JsonNode prNode = root.path("pull_request");
        if (!prNode.isMissingNode()) {
            String prUser = prNode.path("user").path("login").asText("");
            String prTitle = prNode.path("title").asText("");
            if (prUser.contains("livingdocs") || prTitle.contains("[LivingDocs]")) {
                return true;
            }
        }
        return false;
    }

    private String calculateDigest(String content) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(content.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            return "0000000000000000";
        }
    }
}
