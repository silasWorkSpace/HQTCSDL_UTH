package com.livingdocs.workflow.repo;

import com.livingdocs.workflow.config.TenantSchema;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.SqlOutParameter;
import org.springframework.jdbc.core.SqlParameter;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.CallableStatement;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.LocalDateTime;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Toàn bộ truy cập SQL Server của workflow-service.
 *
 * <p>Nguyên tắc nhóm: logic đã có ở tầng database (đổi trạng thái, ghi phiên bản,
 * tạo drift alert, hợp nhất gợi ý) thì gọi stored procedure, không viết lại bằng
 * Java. Truy vấn đọc đơn giản dùng JdbcTemplate với tên schema ghép qua
 * {@link TenantSchema#qualify} sau khi kiểm tra an toàn (đa tenant, NFR-SEC-01).
 */
@Repository
public class WorkflowRepository {

    private final JdbcTemplate jdbc;

    public WorkflowRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /* ---------- đọc document / document_version ---------- */

    public record DocumentRow(UUID id, String title, String docStatus, UUID currentVersionId,
                              UUID ownerId, UUID publishedVersionId) {
    }

    private static final RowMapper<DocumentRow> DOC_MAPPER = (rs, i) -> new DocumentRow(
            rs.getObject("id", UUID.class), rs.getString("title"),
            rs.getString("doc_status"), rs.getObject("current_version_id", UUID.class),
            rs.getObject("owner_id", UUID.class), rs.getObject("published_version_id", UUID.class));

    public Optional<DocumentRow> findDocument(String tenant, UUID documentId) {
        String sql = "SELECT id, title, doc_status, current_version_id, owner_id, published_version_id "
                + "FROM " + TenantSchema.qualify(tenant, "document") + " WHERE id = ?";
        return jdbc.query(sql, DOC_MAPPER, documentId).stream().findFirst();
    }

    public record VersionRow(UUID id, int versionNo, String content, String actorRole,
                             String changeSource, String statusAtVersion, OffsetDateTime createdAt) {
    }

    public Optional<VersionRow> findVersion(String tenant, UUID versionId) {
        String sql = "SELECT id, version_no, content, actor_role, change_source, "
                + "status_at_version, created_at FROM "
                + TenantSchema.qualify(tenant, "document_version") + " WHERE id = ?";
        return jdbc.query(sql, VERSION_MAPPER, versionId).stream().findFirst();
    }

    /** Change log phục vụ màn hình duyệt (FR-WF-04). */
    public List<VersionRow> listVersions(String tenant, UUID documentId) {
        String sql = "SELECT id, version_no, content, actor_role, change_source, "
                + "status_at_version, created_at FROM "
                + TenantSchema.qualify(tenant, "document_version")
                + " WHERE document_id = ? ORDER BY version_no";
        return jdbc.query(sql, VERSION_MAPPER, documentId);
    }

    /** Bản đã Approved gần nhất trước bản đang chờ — cho so sánh FR-WF-05. */
    public Optional<VersionRow> findLastApprovedVersion(String tenant, UUID documentId) {
        String sql = "SELECT TOP (1) id, version_no, content, actor_role, change_source, "
                + "status_at_version, created_at FROM "
                + TenantSchema.qualify(tenant, "document_version")
                + " WHERE document_id = ? AND status_at_version = 'APPROVED' "
                + "ORDER BY version_no DESC";
        return jdbc.query(sql, VERSION_MAPPER, documentId).stream().findFirst();
    }

    private static final RowMapper<VersionRow> VERSION_MAPPER = (rs, i) -> new VersionRow(
            rs.getObject("id", UUID.class), rs.getInt("version_no"), rs.getString("content"),
            rs.getString("actor_role"), rs.getString("change_source"),
            rs.getString("status_at_version"), odt(rs, "created_at"));

    /* ---------- stored procedures ---------- */

    /** Cổng duy nhất đổi trạng thái tài liệu — SP chặn cặp (from, to, role) sai. */
    public void transitionDocument(String tenant, UUID documentId, String toStatus,
                                   String actorRole, UUID actorUserId) {
        jdbc.update(con -> {
            CallableStatement cs = con.prepareCall(
                    "{call " + TenantSchema.qualify(tenant, "sp_transition_document_status")
                            + "(?,?,?,?)}");
            cs.setObject(1, documentId);
            cs.setString(2, toStatus);
            cs.setString(3, actorRole);
            if (actorUserId != null) {
                cs.setObject(4, actorUserId);
            } else {
                cs.setNull(4, Types.BINARY);
            }
            return cs;
        });
    }

    /** Ghi phiên bản mới qua SP cụm 03 (khóa dòng, tuần tự hóa version_no). Trả version id. */
    public UUID appendDocumentVersion(String tenant, UUID documentId, String content,
                                      String actorRole, UUID actorUserId, String changeSource,
                                      String reason) {
        Map<String, Object> out = jdbc.call(
                con -> {
                    CallableStatement cs = con.prepareCall(
                            "{call " + TenantSchema.qualify(tenant, "sp_append_document_version")
                                    + "(?,?,?,?,?,?,?,?,?,?,?,?,?,?)}");
                    cs.setObject(1, documentId);
                    cs.setNString(2, content);
                    cs.setString(3, actorRole);
                    if (actorUserId != null) {
                        cs.setObject(4, actorUserId);
                    } else {
                        cs.setNull(4, Types.BINARY);
                    }
                    cs.setString(5, changeSource);
                    cs.setNull(6, Types.VARCHAR);         // status_at_version = NULL (lấy hiện tại)
                    cs.setNull(7, Types.VARCHAR);         // source_commit_sha
                    cs.setNull(8, Types.INTEGER);         // source_pr_number
                    cs.setNull(9, Types.VARCHAR);         // source_pr_kind
                    cs.setNString(10, reason);
                    cs.setNull(11, Types.INTEGER);        // rolled_back_from_version_no
                    cs.setByte(12, (byte) 1);             // set_as_current
                    cs.registerOutParameter(13, Types.CHAR);  // version_id OUTPUT
                    cs.registerOutParameter(14, Types.INTEGER); // version_no OUTPUT
                    return cs;
                },
                List.of(new SqlParameter("document_id", Types.BINARY),
                        new SqlParameter("content", Types.NVARCHAR),
                        new SqlParameter("actor_role", Types.VARCHAR),
                        new SqlParameter("actor_user_id", Types.BINARY),
                        new SqlParameter("change_source", Types.VARCHAR),
                        new SqlParameter("status_at_version", Types.VARCHAR),
                        new SqlParameter("source_commit_sha", Types.VARCHAR),
                        new SqlParameter("source_pr_number", Types.INTEGER),
                        new SqlParameter("source_pr_kind", Types.VARCHAR),
                        new SqlParameter("reason", Types.NVARCHAR),
                        new SqlParameter("rolled_back_from_version_no", Types.INTEGER),
                        new SqlParameter("set_as_current", Types.BIT),
                        new SqlOutParameter("version_id", Types.CHAR),
                        new SqlOutParameter("version_no", Types.INTEGER)));
        Object versionId = out.get("version_id");
        if (versionId == null) return UUID.randomUUID();
        String s = String.valueOf(versionId).trim();
        if (s.length() == 36 && s.contains("-")) {
            return UUID.fromString(s);
        }
        s = s.replace("-", "").replace("0x", "");
        if (s.length() == 32) {
            String formatted = s.substring(0, 8) + "-" + s.substring(8, 12) + "-" + s.substring(12, 16) + "-" + s.substring(16, 20) + "-" + s.substring(20, 32);
            return UUID.fromString(formatted);
        }
        return UUID.fromString(s);
    }

        public UUID createDriftAlert(String tenant, UUID sourceEventId, UUID documentId,
                                 String driftType, String severity,
                                 String evidenceJson, String handlingStatus) {
        String sql = "EXEC " + TenantSchema.qualify(tenant, "sp_create_drift_alert")
                + " @source_event_id = ?, @document_id = ?, @drift_type = ?,"
                + " @severity = ?, @evidence = ?, @handling_status = ?";
        return jdbc.queryForObject(sql,
                new Object[]{sourceEventId.toString(), documentId.toString(), driftType,
                             severity, evidenceJson, handlingStatus},
                new int[]{Types.VARCHAR, Types.VARCHAR, Types.VARCHAR,
                          Types.VARCHAR, Types.NVARCHAR, Types.VARCHAR},
                (rs, i) -> UUID.fromString(rs.getString(1)));
    }

       public UUID createUpdateSuggestion(String tenant, UUID documentId, UUID driftAlertId,
                                       String origin, String content, BigDecimal confidence,
                                       String evidenceJson) {
        String sql = "EXEC " + TenantSchema.qualify(tenant, "sp_create_update_suggestion")
                + " @document_id = ?, @drift_alert_id = ?, @origin = ?, @content = ?,"
                + " @confidence_score = ?, @evidence = ?, @auto_apply_eligible = ?";
        return jdbc.queryForObject(sql,
                new Object[]{documentId.toString(),
                             driftAlertId == null ? null : driftAlertId.toString(),
                             origin, content, confidence, evidenceJson, 0},
                new int[]{Types.VARCHAR, Types.VARCHAR, Types.VARCHAR, Types.NVARCHAR,
                          Types.DECIMAL, Types.NVARCHAR, Types.INTEGER},
                (rs, i) -> UUID.fromString(rs.getString(1)));
    }

    /** Hợp nhất gợi ý cũ (FR-DR-17): trả số dòng bị chuyển sang Superseded. */
    public int supersedeStaleSuggestions(String tenant, UUID documentId, UUID keepSuggestionId) {
        String sql = "EXEC " + TenantSchema.qualify(tenant, "sp_supersede_stale_suggestions")
                + " @document_id = ?, @keep_suggestion_id = ?";
        Integer n = jdbc.queryForObject(sql,
                new Object[]{documentId.toString(),
                             keepSuggestionId == null ? null : keepSuggestionId.toString()},
                new int[]{Types.VARCHAR, Types.VARCHAR},
                (rs, i) -> rs.getInt("superseded_count"));
        return n == null ? 0 : n;
    }

    /* ---------- review_task / review_decision / review_comment ---------- */

    public void insertReviewTask(String tenant, UUID documentId, UUID documentVersionId,
                                 String level, UUID submitterId) {
        jdbc.update("INSERT INTO " + TenantSchema.qualify(tenant, "review_task")
                        + " (document_id, document_version_id, level, submitter_id, status) "
                        + "VALUES (?, ?, ?, ?, 'Pending')",
                documentId, documentVersionId, level, submitterId);
    }

    public record TaskRow(UUID id, UUID documentId, UUID documentVersionId, String level,
                          UUID submitterId, String status, OffsetDateTime createdAt) {
    }

    private static OffsetDateTime odt(ResultSet rs, String col) throws SQLException {
        LocalDateTime t = rs.getObject(col, LocalDateTime.class);
        return t == null ? null : t.atOffset(ZoneOffset.UTC);
    }
    private static final RowMapper<TaskRow> TASK_MAPPER = (rs, i) -> new TaskRow(
            rs.getObject("id", UUID.class), rs.getObject("document_id", UUID.class),
            rs.getObject("document_version_id", UUID.class), rs.getString("level"),
            rs.getObject("submitter_id", UUID.class), rs.getString("status"),
            odt(rs, "created_at"));

    public Optional<TaskRow> findTask(String tenant, UUID taskId) {
        return jdbc.query("SELECT id, document_id, document_version_id, level, submitter_id, "
                        + "status, created_at FROM " + TenantSchema.qualify(tenant, "review_task")
                        + " WHERE id = ?", TASK_MAPPER, taskId).stream().findFirst();
    }

    public List<TaskRow> listQueue(String tenant, String level) {
        return jdbc.query("SELECT t.id, t.document_id, t.document_version_id, t.level, "
                        + "t.submitter_id, t.status, t.created_at FROM "
                        + TenantSchema.qualify(tenant, "review_task") + " t WHERE t.level = ? "
                        + "AND t.status = 'Pending' ORDER BY t.created_at",
                TASK_MAPPER, level);
    }

    public int updateTaskStatus(String tenant, UUID taskId, String status) {
        return jdbc.update("UPDATE " + TenantSchema.qualify(tenant, "review_task")
                + " SET status = ?, updated_at = SYSUTCDATETIME() WHERE id = ?", status, taskId);
    }

    public int findTaskIdByDocumentAndLevel(String tenant, UUID documentId, String level,
                                            List<UUID> exceptIds) {
        // số task Pending của tài liệu ở cấp yêu cầu (tránh trùng khi submit lại)
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM ")
                .append(TenantSchema.qualify(tenant, "review_task"))
                .append(" WHERE document_id = ? AND level = ? AND status = 'Pending'");
        List<Object> args = new ArrayList<>(List.of(documentId, level));
        return jdbc.queryForObject(sql.toString(), Integer.class, args.toArray());
    }

    public void insertReviewDecision(String tenant, UUID taskId, UUID reviewerId,
                                     String decision, String reason) {
        jdbc.update("INSERT INTO " + TenantSchema.qualify(tenant, "review_decision")
                        + " (review_task_id, reviewer_id, decision, reason) VALUES (?, ?, ?, ?)",
                taskId, reviewerId, decision, reason);
    }

    public record DecisionRow(UUID reviewerId, String decision, OffsetDateTime decidedAt) {
    }

    /** Lấy quyết định của bước Staff — dùng chặn Manager đã duyệt Staff (FR-WF-22). */
    public List<DecisionRow> listDecisions(String tenant, UUID taskId) {
        return jdbc.query("SELECT reviewer_id, decision, decided_at FROM "
                        + TenantSchema.qualify(tenant, "review_decision")
                        + " WHERE review_task_id = ? ORDER BY decided_at",
                (rs, i) -> new DecisionRow(rs.getObject("reviewer_id", UUID.class),
                        rs.getString("decision"), odt(rs, "decided_at")),
                taskId);
    }

    public void insertReviewComment(String tenant, UUID taskId, UUID userId,
                                    String content, Integer lineNumber) {
        jdbc.update("INSERT INTO " + TenantSchema.qualify(tenant, "review_comment")
                        + " (review_task_id, user_id, content, line_number) VALUES (?, ?, ?, ?)",
                taskId, userId, content, lineNumber);
    }

    /* ---------- drift_alert / update_suggestion ---------- */

    private static final RowMapper<Map<String, Object>> GENERIC_MAPPER = (rs, i) -> {
        Map<String, Object> row = new java.util.LinkedHashMap<>();
        int cols = rs.getMetaData().getColumnCount();
        for (int c = 1; c <= cols; c++) {
            row.put(rs.getMetaData().getColumnLabel(c).toLowerCase(), rs.getObject(c));
        }
        return row;
    };

    public List<Map<String, Object>> listDriftAlerts(String tenant, UUID documentId) {
        return jdbc.query("SELECT id, source_event_id, document_id, drift_type, severity, "
                        + "evidence, handling_status, created_at FROM "
                        + TenantSchema.qualify(tenant, "drift_alert")
                        + " WHERE document_id = ? ORDER BY created_at DESC",
                GENERIC_MAPPER, documentId);
    }

    public List<Map<String, Object>> listSuggestions(String tenant, String status) {
        String sql = "SELECT s.id, s.document_id, d.title AS document_title, s.drift_alert_id, "
                + "s.origin, s.content, s.confidence_score, s.evidence, s.status, "
                + "s.dismiss_reason, s.created_at FROM "
                + TenantSchema.qualify(tenant, "update_suggestion") + " s JOIN "
                + TenantSchema.qualify(tenant, "document") + " d ON d.id = s.document_id";
        if (status != null && !status.isBlank()) {
            sql += " WHERE s.status = ? ORDER BY s.created_at DESC";
            return jdbc.query(sql, GENERIC_MAPPER, status);
        }
        sql += " ORDER BY s.created_at DESC";
        return jdbc.query(sql, GENERIC_MAPPER);
    }

    public record SuggestionRow(UUID id, UUID documentId, String content, String status,
                                String origin) {
    }

    public Optional<SuggestionRow> findSuggestion(String tenant, UUID suggestionId) {
        return jdbc.query("SELECT id, document_id, content, status, origin FROM "
                        + TenantSchema.qualify(tenant, "update_suggestion") + " WHERE id = ?",
                (rs, i) -> new SuggestionRow(rs.getObject("id", UUID.class),
                        rs.getObject("document_id", UUID.class), rs.getString("content"),
                        rs.getString("status"), rs.getString("origin")),
                suggestionId).stream().findFirst();
    }

    public int updateSuggestionStatus(String tenant, UUID suggestionId, String status,
                                      String dismissReason) {
        return jdbc.update("UPDATE " + TenantSchema.qualify(tenant, "update_suggestion")
                + " SET status = ?, dismiss_reason = ?, updated_at = SYSUTCDATETIME() "
                + "WHERE id = ?", status, dismissReason, suggestionId);
    }

    /** Còn gợi ý nào khác đang chờ Developer xử lý cho tài liệu này không. */
    public int countOtherPendingSuggestions(String tenant, UUID documentId, UUID exceptId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM "
                        + TenantSchema.qualify(tenant, "update_suggestion")
                        + " WHERE document_id = ? AND status = 'Pending Developer Action' "
                        + "AND id <> ?", Integer.class, documentId, exceptId);
    }

    public Optional<String> findSubmitterEmail(String tenant, UUID userId) {
        return jdbc.query("SELECT display_name FROM "
                        + TenantSchema.qualify(tenant, "app_user") + " WHERE id = ?",
                (rs, i) -> rs.getString(1), userId).stream().findFirst();
    }

    /** Danh sách user đang giữ vai trò trong workspace — để phát thông báo theo nhóm (NTF-01). */
    public List<UUID> findUserIdsWithRole(String tenant, String role) {
        return jdbc.query("SELECT DISTINCT ra.user_id FROM "
                        + TenantSchema.qualify(tenant, "role_assignment") + " ra JOIN "
                        + TenantSchema.qualify(tenant, "app_user") + " u ON u.id = ra.user_id "
                        + "WHERE ra.[role] = ? AND u.status = 'active'",
                (rs, i) -> rs.getObject("user_id", UUID.class), role);
    }

    private static UUID toUuid(Object raw) {
        String s = String.valueOf(raw).replace("0x", "").replace("-", "");
        if (s.length() == 32) {
            s = s.substring(0, 8) + "-" + s.substring(8, 12) + "-" + s.substring(12, 16)
                    + "-" + s.substring(16, 20) + "-" + s.substring(20);
        }
        return UUID.fromString(s);
    }
}
