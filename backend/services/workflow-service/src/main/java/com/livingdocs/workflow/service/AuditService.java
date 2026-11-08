package com.livingdocs.workflow.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.livingdocs.workflow.config.TenantSchema;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Ghi audit_log cho mọi quyết định duyệt (FR-WF-20): ai, khi nào, lý do.
 * Khi cụm Người 1 có AuditService trong libs/common-web sẽ chuyển sang dùng chung.
 *
 * <p>Hai ràng buộc của bảng audit_log mà lớp này phải tôn trọng:
 * <ul>
 *   <li>{@code ck_audit_log_actor}: actor_type = 'user' thì bắt buộc có actor_id →
 *       hành động của hệ thống (không có người dùng, ví dụ DRIFT_FOUND) ghi actor_type = 'system'.</li>
 *   <li>{@code ck_audit_log_detail}: detail phải là JSON hợp lệ → chuỗi không hợp lệ
 *       (ví dụ lý do có dấu nháy, xuống dòng) được bọc thành {@code {"raw": "..."}}.</li>
 * </ul>
 */
@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final JdbcTemplate jdbc;

    public AuditService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void record(String tenant, UUID actorId, String actorRole, String action,
                       String entityType, UUID entityId, UUID correlationId, String detailJson) {
        String actorType = actorId == null ? "system" : "user";
        try {
            jdbc.update("INSERT INTO " + TenantSchema.qualify(tenant, "audit_log")
                            + " ([action], actor_type, actor_id, actor_role, entity_type, entity_id, "
                            + "correlation_id, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    action, actorType, actorId, actorRole, entityType, entityId, correlationId,
                    safeJson(detailJson));
        } catch (Exception e) {
            // Audit lỗi không được làm hỏng nghiệp vụ, nhưng phải hiện rõ trong log
            log.error("Ghi audit_log that bai action={} entity={}", action, entityId, e);
        }
    }

    /** Trả về chính chuỗi nếu là JSON hợp lệ, ngược lại bọc thành {"raw": "..."}; null giữ null. */
    public static String safeJson(String detail) {
        if (detail == null || detail.isBlank()) {
            return null;
        }
        try {
            MAPPER.readTree(detail);
            return detail;
        } catch (Exception notJson) {
            try {
                ObjectNode wrapped = MAPPER.createObjectNode();
                wrapped.put("raw", detail);
                return MAPPER.writeValueAsString(wrapped);
            } catch (Exception e) {
                return null;
            }
        }
    }
}