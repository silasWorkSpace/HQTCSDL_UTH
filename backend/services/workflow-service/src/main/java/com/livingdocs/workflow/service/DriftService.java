package com.livingdocs.workflow.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.livingdocs.workflow.repo.WorkflowRepository;
import com.livingdocs.workflow.security.AuthContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Tiêu thụ DRIFT_FOUND từ ld.ai-results (do ai-engine/drift phát) và phục vụ
 * hàng đợi gợi ý của Developer:
 *
 * <ul>
 *   <li>DR-12/AUTO-02: ghi drift_alert + update_suggestion, hợp nhất khi cùng PR</li>
 *   <li>DR-09/AUTO-07/08/09: Accept/Edit/Dismiss gợi ý, Accept/Edit vào duyệt</li>
 * </ul>
 */
@Service
public class DriftService {

    private static final Logger log = LoggerFactory.getLogger(DriftService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final WorkflowRepository repo;
    private final AuditService audit;
    private final NotifyPort notify;
    private final ReviewService reviewService;

    public DriftService(WorkflowRepository repo, AuditService audit, NotifyPort notify,
                        ReviewService reviewService) {
        this.repo = repo;
        this.audit = audit;
        this.notify = notify;
        this.reviewService = reviewService;
    }

    /* ---------- consumer DRIFT_FOUND (DR-12, AUTO-02, DR-17) ---------- */

    /**
     * Payload DRIFT_FOUND (ai-engine/drift phát):
     * { documentId, sourceEventId, findings: [ { driftType, severity, evidence, suggestion:
     * { content, confidence } } ] }
     *
     * <p>Cùng một (source_event_id, document_id, drift_type) chỉ ghi một drift_alert
     * (ràng buộc UNIQUE trong bảng) — chạy lại không sinh trùng (FR-DR-13).
     */
    @Transactional
    public void onDriftFound(String tenant, JsonNode payload) {
        UUID documentId = UUID.fromString(payload.path("documentId").asText());
        UUID sourceEventId = UUID.fromString(payload.path("sourceEventId").asText());

        WorkflowRepository.DocumentRow doc = repo.findDocument(tenant, documentId).orElse(null);
        if (doc == null) {
            log.warn("DRIFT_FOUND cho tai lieu khong ton tai {} (tenant {})", documentId, tenant);
            return;
        }

        for (JsonNode finding : payload.path("findings")) {
            String driftType = finding.path("driftType").asText();
            String severity = finding.path("severity").asText();
            String evidence = finding.path("evidence").toString();

            // Bỏ qua nếu alert cùng (source_event, document, type) đã có — idempotent
            boolean exists = repo.listDriftAlerts(tenant, documentId).stream()
                    .anyMatch(a -> sourceEventId.equals(a.get("source_event_id"))
                            && driftType.equals(a.get("drift_type")));
            UUID alertId = null;
            if (!exists) {
                alertId = repo.createDriftAlert(tenant, sourceEventId, documentId, driftType,
                        severity, evidence, "Open");
            } else {
                log.info("Drift alert trung lap bo qua: doc={} type={}", documentId, driftType);
                continue; // chạy lại cùng source_event: không sinh thêm gợi ý (FR-DR-13)
            }

            JsonNode suggestion = finding.path("suggestion");
            if (!suggestion.isMissingNode() && !suggestion.isNull()) {
                BigDecimal confidence = new BigDecimal(
                        suggestion.path("confidence").asText("0.5"));
                UUID suggestionId = repo.createUpdateSuggestion(tenant, documentId, alertId,
                        "drift", suggestion.path("content").asText(), confidence, evidence);
                // FR-DR-17: bản cũ cùng tài liệu → Superseded, chỉ giữ bản mới nhất
                repo.supersedeStaleSuggestions(tenant, documentId, suggestionId);
            }
        }

        // Đưa tài liệu vào Pending Developer Action để Developer xử lý gợi ý
        // (AUTO-02) — chỉ khi tài liệu đang ở trạng thái cho phép
        if ("DRAFT".equals(doc.docStatus())) {
            try {
                repo.transitionDocument(tenant, documentId, "PENDING_DEVELOPER_ACTION",
                        "system", null);
            } catch (Exception e) {
                log.warn("Khong chuyen PENDING_DEVELOPER_ACTION cho doc {}: {}", documentId,
                        e.getMessage());
            }
        }

        audit.record(tenant, null, null, "DRIFT_FOUND", "document", documentId, null,
                "{\"sourceEventId\":\"" + sourceEventId + "\"}");
        notify.notifyUser(tenant, doc.ownerId(), "DRIFT_FOUND",
                "Phát hiện drift trên tài liệu \"" + doc.title() + "\"", null);
        log.info("Da xu ly DRIFT_FOUND: doc={} findings={}", documentId,
                payload.path("findings").size());
    }

    /* ---------- API xem cảnh báo & gợi ý (DR-12, AUTO-02) ---------- */

    public List<Map<String, Object>> driftAlerts(String tenant, UUID documentId) {
        return repo.listDriftAlerts(tenant, documentId);
    }

    public List<Map<String, Object>> suggestions(String tenant, String status) {
        return repo.listSuggestions(tenant, status);
    }

    /* ---------- Accept / Edit / Dismiss (AUTO-07/08/09, DR-09) ---------- */

    @Transactional
    public Map<String, Object> handleSuggestion(String tenant, UUID suggestionId, String action,
                                                String editedContent, String dismissReason) {
        WorkflowRepository.SuggestionRow s = repo.findSuggestion(tenant, suggestionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Gợi ý cập nhật không tồn tại"));
        if (!"Pending Developer Action".equals(s.status())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Gợi ý đã ở trạng thái " + s.status());
        }
        AuthContext.CurrentUser user = AuthContext.get();

        switch (action) {
            case "accept", "edit" -> {
                // AUTO-08/DR-09: nộp nội dung gợi ý vào quy trình duyệt Staff → Manager
                String content = "edit".equals(action) && editedContent != null
                        ? editedContent : s.content();
                WorkflowRepository.DocumentRow doc = repo.findDocument(tenant, s.documentId())
                        .orElseThrow();
                repo.appendDocumentVersion(tenant, s.documentId(), content, "Developer",
                        user.userId(), "DRIFT_SUGGESTION",
                        "Accept gợi ý cập nhật từ drift (AUTO-08)");
                repo.updateSuggestionStatus(tenant, suggestionId, "Accepted", null);
                repo.updateDriftAlertStatusBySuggestion(tenant, suggestionId, "Accepted");
                audit.record(tenant, user.userId(), "Developer",
                        ("edit".equals(action) ? "SUGGESTION_EDIT" : "SUGGESTION_ACCEPT"),
                        "update_suggestion", suggestionId, null, null);
                // Ghi nhận thay đổi rồi submit duyệt như nộp bản thường
                try {
                    reviewService.submit(tenant, s.documentId(), user);
                } catch (ResponseStatusException e) {
                    // tài liệu không ở trạng thái nộp được (VD đã IN_REVIEW) — vẫn giữ Accepted
                    log.info("Khong submit duoc sau accept: {}", e.getReason());
                }
            }
            case "dismiss" -> {
                // AUTO-09: bắt buộc lý do, không vào quy trình duyệt
                if (dismissReason == null || dismissReason.isBlank()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Dismiss bắt buộc ghi lý do");
                }
                repo.updateSuggestionStatus(tenant, suggestionId, "Dismissed", dismissReason);
                repo.updateDriftAlertStatusBySuggestion(tenant, suggestionId, "Dismissed");
                audit.record(tenant, user.userId(), "Developer", "SUGGESTION_DISMISS",
                        "update_suggestion", suggestionId, null,
                        "{\"reason\":\"" + dismissReason.replace("\"", "'") + "\"}");
            }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Hành động không hợp lệ: " + action);
        }
        return Map.of("id", suggestionId, "action", action);
    }
}
