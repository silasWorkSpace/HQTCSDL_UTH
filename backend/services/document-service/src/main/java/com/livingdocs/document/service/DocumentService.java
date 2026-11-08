package com.livingdocs.document.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.difflib.DiffUtils;
import com.github.difflib.patch.AbstractDelta;
import com.github.difflib.patch.Patch;
import com.livingdocs.common.events.DocDraftPayload;
import com.livingdocs.common.events.EventEnvelope;
import com.livingdocs.common.events.GenerateDocPayload;
import com.livingdocs.common.security.SecurityUtils;
import com.livingdocs.common.security.TenantContext;
import com.livingdocs.document.dto.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.CallableStatement;
import java.sql.ResultSet;
import java.sql.Types;
import java.util.*;

@Service
public class DocumentService {

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);

    private final JdbcTemplate jdbcTemplate;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public DocumentService(JdbcTemplate jdbcTemplate, KafkaTemplate<String, Object> kafkaTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    public List<DocumentResponse> listDocuments(UUID repositoryId, String docStatus, int page, int size) {
        String schema = TenantContext.getSchema();
        int offset = Math.max(0, page) * Math.max(1, size);

        StringBuilder sql = new StringBuilder(String.format(
            "SELECT d.id, d.repository_id, d.doc_type, d.template_id, d.collection_id, d.owner_id, " +
            "d.title, d.path_in_repo, d.current_version_id, v.version_no as current_version_no, " +
            "d.doc_status, d.publish_status, d.pr_status, d.created_at, d.updated_at " +
            "FROM [%s].[document] d " +
            "LEFT JOIN [%s].[document_version] v ON v.id = d.current_version_id " +
            "WHERE 1=1 ",
            schema, schema
        ));

        List<Object> params = new ArrayList<>();
        if (repositoryId != null) {
            sql.append("AND d.repository_id = ? ");
            params.add(repositoryId);
        }
        if (docStatus != null && !docStatus.isBlank()) {
            sql.append("AND d.doc_status = ? ");
            params.add(docStatus);
        }

        sql.append("ORDER BY d.created_at DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY");
        params.add(offset);
        params.add(Math.max(1, size));

        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> mapDocumentResponse(rs), params.toArray());
    }

    public DocumentResponse getDocumentById(UUID id) {
        String schema = TenantContext.getSchema();
        String sql = String.format(
            "SELECT d.id, d.repository_id, d.doc_type, d.template_id, d.collection_id, d.owner_id, " +
            "d.title, d.path_in_repo, d.current_version_id, v.version_no as current_version_no, " +
            "d.doc_status, d.publish_status, d.pr_status, d.created_at, d.updated_at " +
            "FROM [%s].[document] d " +
            "LEFT JOIN [%s].[document_version] v ON v.id = d.current_version_id " +
            "WHERE d.id = ?",
            schema, schema
        );

        List<DocumentResponse> list = jdbcTemplate.query(sql, (rs, rowNum) -> mapDocumentResponse(rs), id);
        if (list.isEmpty()) {
            throw new RuntimeException("Document not found: " + id);
        }
        return list.get(0);
    }

    @Transactional
    public DocumentVersionResponse updateDraft(UUID id, UpdateDraftRequest req) {
        DocumentResponse doc = getDocumentById(id);
        if (!"DRAFT".equalsIgnoreCase(doc.getDocStatus()) && !"CHANGES_REQUESTED".equalsIgnoreCase(doc.getDocStatus())) {
            throw new IllegalStateException("Only documents in DRAFT or CHANGES_REQUESTED status can be updated as draft. Current: " + doc.getDocStatus());
        }

        String schema = TenantContext.getSchema();
        UUID userId = SecurityUtils.getCurrentUserId();
        String role = SecurityUtils.getCurrentUserRole();

        // Call sp_append_document_version
        String callSql = String.format(
            "{CALL [%s].[sp_append_document_version](?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)}",
            schema
        );

        return jdbcTemplate.execute((java.sql.Connection conn) -> {
            try (CallableStatement cs = conn.prepareCall(callSql)) {
                cs.setObject(1, id);
                cs.setString(2, req.getContent());
                cs.setString(3, role);
                cs.setObject(4, userId);
                cs.setString(5, "MANUAL_EDIT");
                cs.setString(6, doc.getDocStatus()); // status_at_version
                cs.setString(7, null);               // source_commit_sha
                cs.setNull(8, Types.INTEGER);        // source_pr_number
                cs.setString(9, null);               // source_pr_kind
                cs.setString(10, "Draft update");    // reason
                cs.setNull(11, Types.INTEGER);       // rolled_back_from_version_no
                cs.setBoolean(12, true);             // set_as_current
                cs.registerOutParameter(13, Types.CHAR); // version_id
                cs.registerOutParameter(14, Types.INTEGER); // version_no

                cs.execute();

                String newVerIdStr = cs.getString(13);
                int newVerNo = cs.getInt(14);

                // If document was in CHANGES_REQUESTED, transition it back to DRAFT via sp_update_document_state
                if ("CHANGES_REQUESTED".equalsIgnoreCase(doc.getDocStatus())) {
                    String updateStateSql = String.format(
                        "{CALL [%s].[sp_update_document_state](?, ?, ?, ?, ?, ?, ?, ?)}",
                        schema
                    );
                    jdbcTemplate.update(updateStateSql, id, "DRAFT", null, null, null, null, false, userId);
                }

                return getDocumentVersion(id, newVerNo);
            }
        });
    }

    public List<DocumentVersionResponse> getDocumentVersions(UUID documentId) {
        String schema = TenantContext.getSchema();
        String sql = String.format(
            "SELECT id, document_id, version_no, content, content_redacted, actor_role, actor_user_id, " +
            "change_source, status_at_version, source_commit_sha, source_pr_number, source_pr_kind, " +
            "reason, rolled_back_from_version_no, created_at " +
            "FROM [%s].[document_version] " +
            "WHERE document_id = ? " +
            "ORDER BY version_no ASC",
            schema
        );

        return jdbcTemplate.query(sql, (rs, rowNum) -> mapVersionResponse(rs), documentId);
    }

    public DocumentVersionResponse getDocumentVersion(UUID documentId, int versionNo) {
        String schema = TenantContext.getSchema();
        String sql = String.format(
            "SELECT id, document_id, version_no, content, content_redacted, actor_role, actor_user_id, " +
            "change_source, status_at_version, source_commit_sha, source_pr_number, source_pr_kind, " +
            "reason, rolled_back_from_version_no, created_at " +
            "FROM [%s].[document_version] " +
            "WHERE document_id = ? AND version_no = ?",
            schema
        );

        List<DocumentVersionResponse> list = jdbcTemplate.query(sql, (rs, rowNum) -> mapVersionResponse(rs), documentId, versionNo);
        if (list.isEmpty()) {
            throw new RuntimeException("Version " + versionNo + " not found for document: " + documentId);
        }
        return list.get(0);
    }

    public DiffResponse calculateDiff(UUID documentId, int fromVersionNo, int toVersionNo) {
        DocumentVersionResponse v1 = getDocumentVersion(documentId, fromVersionNo);
        DocumentVersionResponse v2 = getDocumentVersion(documentId, toVersionNo);

        List<String> lines1 = v1.getContent() != null ? Arrays.asList(v1.getContent().split("\\r?\\n")) : Collections.emptyList();
        List<String> lines2 = v2.getContent() != null ? Arrays.asList(v2.getContent().split("\\r?\\n")) : Collections.emptyList();

        Patch<String> patch = DiffUtils.diff(lines1, lines2);
        List<String> diffOutput = new ArrayList<>();
        for (AbstractDelta<String> delta : patch.getDeltas()) {
            diffOutput.add(delta.toString());
        }

        return new DiffResponse(fromVersionNo, toVersionNo, diffOutput);
    }

    @Transactional
    public DocumentVersionResponse rollbackDocument(UUID documentId, RollbackRequest req) {
        String schema = TenantContext.getSchema();
        UUID userId = SecurityUtils.getCurrentUserId();
        String role = SecurityUtils.getCurrentUserRole();

        String callSql = String.format(
            "{CALL [%s].[sp_rollback_document](?, ?, ?, ?, ?, ?, ?, ?)}",
            schema
        );

        return jdbcTemplate.execute((java.sql.Connection conn) -> {
            try (CallableStatement cs = conn.prepareCall(callSql)) {
                cs.setObject(1, documentId);
                cs.setInt(2, req.getTargetVersionNo());
                cs.setString(3, role);
                cs.setObject(4, userId);
                cs.setString(5, req.getReason());
                cs.registerOutParameter(6, Types.CHAR); // new_version_id
                cs.registerOutParameter(7, Types.INTEGER); // new_version_no
                cs.registerOutParameter(8, Types.BOOLEAN); // requires_review

                cs.execute();

                int newVerNo = cs.getInt(7);
                boolean requiresReview = cs.getBoolean(8);
                if (requiresReview) {
                    log.info("Document {} rolled back to v{} and requires review", documentId, req.getTargetVersionNo());
                }

                DocumentVersionResponse res = getDocumentVersion(documentId, newVerNo);
                res.setRequiresReview(requiresReview);
                return res;
            }
        });
    }

    public IntegrityVerificationResponse verifyIntegrity(UUID documentId) {
        String schema = TenantContext.getSchema();
        String callSql = String.format(
            "{CALL [%s].[sp_verify_version_chain](?, ?)}",
            schema
        );

        return jdbcTemplate.execute((java.sql.Connection conn) -> {
            try (CallableStatement cs = conn.prepareCall(callSql)) {
                cs.setObject(1, documentId);
                cs.registerOutParameter(2, Types.BOOLEAN);

                boolean hasResultSet = cs.execute();
                List<IntegrityVerificationResponse.IntegrityProblem> problems = new ArrayList<>();
                if (hasResultSet) {
                    try (ResultSet rs = cs.getResultSet()) {
                        while (rs != null && rs.next()) {
                            problems.add(new IntegrityVerificationResponse.IntegrityProblem(
                                UUID.fromString(rs.getString("document_version_id")),
                                rs.getInt("version_no"),
                                rs.getString("problem")
                            ));
                        }
                    }
                }
                // Read OUT parameter after consuming all result sets in TDS protocol
                boolean isValid = cs.getBoolean(2);

                return new IntegrityVerificationResponse(documentId, isValid, problems);
            }
        });
    }

    public List<DocCodeLinkResponse> getDocumentLinks(UUID documentId) {
        String schema = TenantContext.getSchema();
        String sql = String.format(
            "SELECT id, document_id, link_type, code_entity_id, external_ref, created_at " +
            "FROM [%s].[doc_code_link] " +
            "WHERE document_id = ? " +
            "ORDER BY created_at ASC",
            schema
        );

        return jdbcTemplate.query(sql, (rs, rowNum) -> new DocCodeLinkResponse(
            UUID.fromString(rs.getString("id")),
            UUID.fromString(rs.getString("document_id")),
            rs.getString("link_type"),
            rs.getString("code_entity_id") != null ? UUID.fromString(rs.getString("code_entity_id")) : null,
            rs.getString("external_ref"),
            rs.getTimestamp("created_at").toInstant()
        ), documentId);
    }

    public String requestGenerateDocument(GenerateDocRequest req) {
        String correlationId = UUID.randomUUID().toString();
        String tenant = TenantContext.getTenant();

        GenerateDocPayload payload = new GenerateDocPayload();
        payload.setScopeType(req.getScopeType());
        payload.setScopeReference(req.getScopeReference());
        payload.setRepositoryId(req.getRepositoryId());
        payload.setTemplateId(req.getTemplateId());
        payload.setRequestedBy(SecurityUtils.getCurrentUserId());
        payload.setCommitSha(req.getCommitSha());

        EventEnvelope<GenerateDocPayload> envelope = new EventEnvelope<>(
            "GENERATE_DOC",
            tenant,
            correlationId,
            payload
        );

        kafkaTemplate.send("ld.ai-jobs", correlationId, envelope);
        return correlationId;
    }

    @Transactional
    public void processDocDraftEvent(EventEnvelope<DocDraftPayload> envelope) {
        if (envelope == null || envelope.getPayload() == null) return;
        DocDraftPayload p = envelope.getPayload();

        TenantContext.setTenant(envelope.getTenant() != null ? envelope.getTenant() : "demo");
        String schema = TenantContext.getSchema();

        // Stored procedure sp_create_document has 18 parameters (16 IN, 2 OUT)
        String callSql = String.format(
            "{CALL [%s].[sp_create_document](?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)}",
            schema
        );

        UUID createdDocId = jdbcTemplate.execute((java.sql.Connection conn) -> {
            try (CallableStatement cs = conn.prepareCall(callSql)) {
                cs.setObject(1, p.getRepositoryId());
                cs.setString(2, p.getDocType() != null ? p.getDocType() : "README");
                cs.setString(3, p.getTitle());
                cs.setString(4, p.getPathInRepo());
                cs.setObject(5, p.getOwnerId() != null ? p.getOwnerId() : UUID.fromString("00000000-0000-0000-0000-000000000001"));
                cs.setString(6, p.getMarkdownContent());
                cs.setString(7, "AI");
                cs.setNull(8, Types.CHAR); // actor_user_id null for AI
                cs.setString(9, "AI_GENERATION");
                cs.setString(10, "DRAFT");
                cs.setObject(11, p.getTemplateId());
                cs.setObject(12, p.getCollectionId());
                cs.setString(13, p.getSourceCommitSha());
                cs.setNull(14, Types.INTEGER); // source_pr_number
                cs.setString(15, null);        // source_pr_kind
                cs.setBoolean(16, true);       // auto_update_enabled
                cs.registerOutParameter(17, Types.CHAR); // document_id OUTPUT
                cs.registerOutParameter(18, Types.CHAR); // version_id OUTPUT

                cs.execute();

                String docIdStr = cs.getString(17);
                return docIdStr != null ? UUID.fromString(docIdStr.trim()) : null;
            }
        });

        if (createdDocId != null) {
            // 1. Link commit SHA to document (FR-GEN-04 / KB-02)
            if (p.getSourceCommitSha() != null && !p.getSourceCommitSha().isBlank()) {
                try {
                    String insCommitLink = String.format(
                        "INSERT INTO [%s].[doc_code_link] (document_id, link_type, external_ref) VALUES (?, 'COMMIT', ?)",
                        schema
                    );
                    jdbcTemplate.update(insCommitLink, createdDocId, p.getSourceCommitSha());
                } catch (Exception ex) {
                    log.warn("Failed to insert commit link: {}", ex.getMessage());
                }
            }

            // 2. Link Code Entities from evidence list (FR-GEN-04 / KB-05)
            if (p.getEvidenceList() != null && !p.getEvidenceList().isEmpty() && p.getRepositoryId() != null) {
                for (DocDraftPayload.EvidenceItem ev : p.getEvidenceList()) {
                    if (ev.getEntityName() != null && !ev.getEntityName().isBlank()) {
                        try {
                            String findEntitySql = String.format(
                                "SELECT TOP 1 id FROM [%s].[code_entity] WHERE repository_id = ? AND name = ? AND removed_at IS NULL",
                                schema
                            );
                            List<UUID> matching = jdbcTemplate.query(findEntitySql, (rs, rn) -> UUID.fromString(rs.getString("id")), p.getRepositoryId(), ev.getEntityName());
                            if (!matching.isEmpty()) {
                                String insCodeLink = String.format(
                                    "INSERT INTO [%s].[doc_code_link] (document_id, link_type, code_entity_id) VALUES (?, 'CODE_ENTITY', ?)",
                                    schema
                                );
                                jdbcTemplate.update(insCodeLink, createdDocId, matching.get(0));
                            }
                        } catch (Exception ex) {
                            log.debug("Skipping duplicate or missing code link: {}", ex.getMessage());
                        }
                    }
                }
            }

            // 3. Save initial update_suggestion with confidence & evidence (FR-GEN-08, 09)
            try {
                String checkSugSql = String.format("SELECT 1 FROM sys.tables WHERE object_id = OBJECT_ID('[%s].[update_suggestion]')", schema);
                List<Integer> hasSug = jdbcTemplate.query(checkSugSql, (rs, rn) -> 1);
                if (!hasSug.isEmpty()) {
                    double conf = p.getOverallConfidence() != null ? Math.min(1.0, Math.max(0.0, p.getOverallConfidence())) : 0.90;
                    String evidenceJson = p.getEvidenceList() != null ? objectMapper.writeValueAsString(p.getEvidenceList()) : null;
                    String insSugSql = String.format(
                        "INSERT INTO [%s].[update_suggestion] (document_id, origin, content, confidence_score, evidence, status, auto_apply_eligible) " +
                        "VALUES (?, 'AI_GENERATION', ?, ?, ?, 'Accepted', 0)",
                        schema
                    );
                    jdbcTemplate.update(insSugSql, createdDocId, p.getMarkdownContent(), conf, evidenceJson);
                }
            } catch (Exception ex) {
                log.warn("Could not save initial update_suggestion: {}", ex.getMessage());
            }
        }
    }

    private DocumentResponse mapDocumentResponse(ResultSet rs) throws java.sql.SQLException {
        DocumentResponse res = new DocumentResponse();
        res.setId(UUID.fromString(rs.getString("id")));
        res.setRepositoryId(UUID.fromString(rs.getString("repository_id")));
        res.setDocType(rs.getString("doc_type"));
        String tplId = rs.getString("template_id");
        if (tplId != null) res.setTemplateId(UUID.fromString(tplId));
        String colId = rs.getString("collection_id");
        if (colId != null) res.setCollectionId(UUID.fromString(colId));
        res.setOwnerId(UUID.fromString(rs.getString("owner_id")));
        res.setTitle(rs.getString("title"));
        res.setPathInRepo(rs.getString("path_in_repo"));
        String curVer = rs.getString("current_version_id");
        if (curVer != null) res.setCurrentVersionId(UUID.fromString(curVer));
        res.setCurrentVersionNo(rs.getInt("current_version_no"));
        res.setDocStatus(rs.getString("doc_status"));
        res.setPublishStatus(rs.getString("publish_status"));
        res.setPrStatus(rs.getString("pr_status"));
        res.setCreatedAt(rs.getTimestamp("created_at").toInstant());
        res.setUpdatedAt(rs.getTimestamp("updated_at").toInstant());
        return res;
    }

    private DocumentVersionResponse mapVersionResponse(ResultSet rs) throws java.sql.SQLException {
        DocumentVersionResponse res = new DocumentVersionResponse();
        res.setId(UUID.fromString(rs.getString("id")));
        res.setDocumentId(UUID.fromString(rs.getString("document_id")));
        res.setVersionNo(rs.getInt("version_no"));
        res.setContent(rs.getString("content"));
        res.setContentRedacted(rs.getBoolean("content_redacted"));
        res.setActorRole(rs.getString("actor_role"));
        String uid = rs.getString("actor_user_id");
        if (uid != null) res.setActorUserId(UUID.fromString(uid));
        res.setChangeSource(rs.getString("change_source"));
        res.setStatusAtVersion(rs.getString("status_at_version"));
        res.setSourceCommitSha(rs.getString("source_commit_sha"));
        int prNum = rs.getInt("source_pr_number");
        if (!rs.wasNull()) res.setSourcePrNumber(prNum);
        res.setSourcePrKind(rs.getString("source_pr_kind"));
        res.setReason(rs.getString("reason"));
        int rbVer = rs.getInt("rolled_back_from_version_no");
        if (!rs.wasNull()) res.setRolledBackFromVersionNo(rbVer);
        res.setCreatedAt(rs.getTimestamp("created_at").toInstant());
        return res;
    }
}

