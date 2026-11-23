package com.livingdocs.document.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.difflib.DiffUtils;
import com.github.difflib.patch.AbstractDelta;
import com.github.difflib.patch.Patch;
import com.livingdocs.common.error.ApiException;
import com.livingdocs.common.events.DocDraftPayload;
import com.livingdocs.common.events.EventEnvelope;
import com.livingdocs.common.events.GenerateDocPayload;
import com.livingdocs.common.security.SecurityUtils;
import com.livingdocs.common.security.TenantContext;
import com.livingdocs.document.dto.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
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

    @Transactional
    public DocumentResponse createDocument(CreateDocumentRequest req) {
        String schema = TenantContext.getSchema();
        String actorRole = SecurityUtils.getCurrentUserRole();
        UUID actorUserId = SecurityUtils.getCurrentUserId();
        UUID repoId = req.repositoryId();

        // Resolve pathInRepo: if not provided, generate default path
        String pathInRepo = req.pathInRepo();
        if (pathInRepo == null || pathInRepo.isBlank()) {
            String sanitized = req.title() != null
                ? req.title().trim().toLowerCase().replaceAll("[^a-z0-9]+", "-")
                : "untitled";
            if (sanitized.startsWith("-")) sanitized = sanitized.substring(1);
            if (sanitized.endsWith("-")) sanitized = sanitized.substring(0, sanitized.length() - 1);
            pathInRepo = "docs/" + (sanitized.isBlank() ? "untitled" : sanitized) + "-" + UUID.randomUUID().toString().substring(0, 8) + ".md";
        }

        Integer exists = jdbcTemplate.queryForObject(
                String.format("SELECT COUNT(*) FROM [%s].[app_user] WHERE id = ? AND status = 'active'", schema),
                Integer.class, actorUserId);
        if (exists == null || exists == 0) throw new ApiException(HttpStatus.FORBIDDEN,
                "Tài khoản không thuộc workspace", "User trong JWT không tồn tại hoặc không còn hoạt động trong workspace này.");
        Integer repositoryExists = jdbcTemplate.queryForObject(
                String.format("SELECT COUNT(*) FROM [%s].[repository] WHERE id = ? AND connection_status = 'connected'", schema),
                Integer.class, repoId);
        if (repositoryExists == null || repositoryExists == 0) throw new ApiException(HttpStatus.NOT_FOUND,
                "Không tìm thấy repository", "Repository không tồn tại hoặc đã bị ngắt kết nối trong workspace.");

        String callSql = String.format(
            "{CALL [%s].[sp_create_document](?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)}",
            schema
        );

        final String finalActorRole = actorRole != null ? actorRole : "Developer";
        final UUID finalActorUserId = actorUserId;
        final UUID finalRepoId = repoId;
        final String finalPathInRepo = pathInRepo;

        UUID createdDocId;
        try {
            createdDocId = jdbcTemplate.execute((java.sql.Connection conn) -> {
                try (CallableStatement cs = conn.prepareCall(callSql)) {
                    cs.setObject(1, finalRepoId);
                    cs.setString(2, req.docType());
                    cs.setString(3, req.title());
                    cs.setString(4, finalPathInRepo);
                    cs.setObject(5, finalActorUserId);
                    cs.setString(6, req.content());
                    cs.setString(7, finalActorRole);
                    cs.setObject(8, finalActorUserId);
                    cs.setString(9, "MANUAL_EDIT");
                    cs.setString(10, "DRAFT");
                    cs.setObject(11, req.templateId());
                    cs.setObject(12, req.collectionId());
                    cs.setString(13, null);
                    cs.setNull(14, Types.INTEGER);
                    cs.setString(15, null);
                    cs.setBoolean(16, true);
                    cs.registerOutParameter(17, Types.CHAR);
                    cs.registerOutParameter(18, Types.CHAR);

                    cs.execute();

                    String docIdStr = cs.getString(17);
                    return docIdStr != null ? UUID.fromString(docIdStr.trim()) : null;
                }
            });
        } catch (Exception ex) {
            log.error("Loi khi tao tai lieu qua sp_create_document tren schema {}: {}", schema, ex.getMessage(), ex);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể tạo tài liệu", "Lỗi CSDL: " + ex.getMessage());
        }

        if (createdDocId == null) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể tạo tài liệu", "Lỗi tạo tài liệu từ cơ sở dữ liệu.");
        }

        return getDocumentById(createdDocId);
    }

    @Transactional
    public void deleteDocument(UUID id) {
        String schema = TenantContext.getSchema();
        String updateSql = String.format("UPDATE [%s].[document] SET doc_status = 'ARCHIVED', updated_at = SYSUTCDATETIME() WHERE id = ?", schema);
        int rows = jdbcTemplate.update(updateSql, id);
        if (rows == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy tài liệu", "Tài liệu không tồn tại để xóa.");
        }
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

        Integer currentVersion = jdbcTemplate.queryForObject(
                String.format("SELECT v.version_no FROM [%s].[document] d WITH (UPDLOCK, HOLDLOCK) " +
                        "JOIN [%s].[document_version] v ON v.id = d.current_version_id WHERE d.id = ?", schema, schema),
                Integer.class, id);
        if (currentVersion == null) throw new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy tài liệu", "Tài liệu không tồn tại.");
        if (!currentVersion.equals(req.getBaseVersionNo())) throw new ApiException(HttpStatus.CONFLICT,
                "Bản nháp đã thay đổi", "Phiên bản mới nhất là " + currentVersion + "; hãy tải lại trước khi lưu.");

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

                int totalVersions = 0;
                try {
                    Integer count = jdbcTemplate.queryForObject(
                        String.format("SELECT COUNT(*) FROM [%s].[document_version] WHERE document_id = ?", schema),
                        Integer.class,
                        documentId
                    );
                    if (count != null) totalVersions = count;
                } catch (Exception ignored) {}

                return new IntegrityVerificationResponse(documentId, isValid, totalVersions, problems);
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

        if (req.getCommitSha() == null || !req.getCommitSha().matches("[0-9a-fA-F]{40}")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Full commit SHA required",
                    "Select a completed repository analysis run before generating documentation.");
        }
        // FR-GEN-02: resolve FILE, MODULE/PACKAGE, and REPOSITORY against one immutable analyzed commit.
        String scopeType = req.getScopeType() == null ? "" : req.getScopeType().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("FILE", "MODULE", "REPOSITORY").contains(scopeType)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid generation scope",
                    "Choose FILE, MODULE, or REPOSITORY.");
        }
        String scopeReference = req.getScopeReference() == null ? "" : req.getScopeReference().trim().replace('\\', '/');
        if (scopeType.equals("REPOSITORY")) scopeReference = "repository";
        else if (scopeReference.isBlank() || scopeReference.startsWith("/")
                || Arrays.stream(scopeReference.split("/", -1)).anyMatch(part -> part.isBlank() || part.equals(".") || part.equals(".."))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid generation scope path",
                    "File and module scopes must use a normalized repository-relative path.");
        }
        List<UUID> selectedIds = req.getCodeEntityIds() == null ? List.of() : req.getCodeEntityIds().stream().distinct().toList();
        if (selectedIds.size() > 1900) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Too many selected code entities",
                    "Narrow the generation scope or omit the optional entity selection.");
        }
        String safePath = req.getPathInRepo();
        if (safePath == null || safePath.isBlank() || safePath.startsWith("/") || safePath.contains("\\")
                || Arrays.stream(safePath.split("/", -1)).anyMatch(part -> part.isBlank() || part.equals(".") || part.equals(".."))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid documentation path", "The repository path must be relative and contain no traversal segments.");
        }
        String schema = TenantContext.getSchema();
        Integer existingCount = jdbcTemplate.queryForObject(
            String.format("SELECT COUNT(1) FROM [%s].[document] WHERE repository_id = ? AND path_in_repo = ?", schema),
            Integer.class,
            req.getRepositoryId(),
            safePath
        );
        if (existingCount != null && existingCount > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "Document already exists at this path",
                "A document already exists at " + safePath + " in this repository. Choose a unique path.");
        }
        StringBuilder selectSql = new StringBuilder(String.format("SELECT id, name, kind, signature, file_path FROM [%s].code_entity "
                + "WHERE repository_id=? AND commit_hash=? AND removed_at IS NULL", schema));
        List<Object> args = new ArrayList<>();
        args.add(req.getRepositoryId());
        args.add(req.getCommitSha());
        if (scopeType.equals("FILE")) {
            selectSql.append(" AND file_path=?");
            args.add(scopeReference);
        } else if (scopeType.equals("MODULE")) {
            String modulePrefix = scopeReference.endsWith("/") ? scopeReference : scopeReference + "/";
            selectSql.append(" AND (file_path=? OR LEFT(file_path, LEN(?))=?)");
            args.add(scopeReference);
            args.add(modulePrefix);
            args.add(modulePrefix);
        }
        if (!selectedIds.isEmpty()) {
            selectSql.append(" AND id IN (").append(String.join(",", Collections.nCopies(selectedIds.size(), "?"))).append(")");
            args.addAll(selectedIds);
        }
        List<Map<String, Object>> selectedEntities = jdbcTemplate.query(selectSql.toString(), (rs, row) -> {
            Map<String, Object> entity = new LinkedHashMap<>();
            entity.put("id", rs.getString("id"));
            entity.put("name", rs.getString("name"));
            entity.put("kind", rs.getString("kind"));
            entity.put("signature", rs.getString("signature"));
            entity.put("file_path", rs.getString("file_path"));
            return entity;
        }, args.toArray());
        if (!selectedIds.isEmpty() && selectedEntities.size() != selectedIds.size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Code entities do not match the selected snapshot",
                    "Every selected entity must belong to this repository, commit SHA, and requested scope.");
        }
        if (selectedEntities.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "No indexed code in scope",
                    "Choose a scope containing code entities from the completed snapshot.");
        }

        UUID resolvedTemplateVersionId = null;
        String templateSections = null;
        String formatRules = null;
        if (req.getTemplateId() != null) {
            try {
                String tplSql = String.format(
                    "SELECT t.current_version_id, tv.sections, tv.format_rules " +
                    "FROM [%s].[template] t " +
                    "LEFT JOIN [%s].[template_version] tv ON tv.id = t.current_version_id " +
                    "WHERE t.id = ?",
                    schema, schema
                );
                List<Map<String, Object>> tplRows = jdbcTemplate.query(tplSql, (rs, rn) -> {
                    Map<String, Object> map = new HashMap<>();
                    String curVerId = rs.getString("current_version_id");
                    if (curVerId != null) map.put("versionId", UUID.fromString(curVerId));
                    map.put("sections", rs.getString("sections"));
                    map.put("formatRules", rs.getString("format_rules"));
                    return map;
                }, req.getTemplateId());

                if (!tplRows.isEmpty()) {
                    resolvedTemplateVersionId = (UUID) tplRows.get(0).get("versionId");
                    templateSections = (String) tplRows.get(0).get("sections");
                    formatRules = (String) tplRows.get(0).get("formatRules");
                }
            } catch (Exception e) {
                log.warn("Could not resolve template version for template {}: {}", req.getTemplateId(), e.getMessage());
            }
        }

        GenerateDocPayload payload = new GenerateDocPayload();
        payload.setScopeType(scopeType);
        payload.setScopeReference(scopeReference);
        payload.setRepositoryId(req.getRepositoryId());
        payload.setTemplateId(req.getTemplateId());
        payload.setTemplateVersionId(resolvedTemplateVersionId);
        payload.setTemplateSections(templateSections);
        payload.setFormatRules(formatRules);
        payload.setRequestedBy(SecurityUtils.getCurrentUserId());
        payload.setCommitSha(req.getCommitSha());
        List<UUID> scopedIds = selectedEntities.stream().map(row -> UUID.fromString((String) row.get("id"))).toList();
        payload.setCodeEntityIds(scopedIds);
        payload.setEntities(selectedEntities);
        payload.setTitle(req.getTitle().trim());
        payload.setPathInRepo(safePath);

        EventEnvelope<GenerateDocPayload> envelope = new EventEnvelope<>(
            "GENERATE_DOC",
            tenant,
            correlationId,
            payload
        );

        UUID jobId = UUID.fromString(correlationId);
        String requestJson;
        try {
            requestJson = objectMapper.writeValueAsString(envelope);
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not serialize AI job", "Retry the document generation request.");
        }
        jdbcTemplate.update("INSERT INTO [" + schema + "].ai_job "
                        + "(id, job_type, status, correlation_id, request_payload, created_by) "
                        + "VALUES (?, 'doc_generation', 'pending', ?, ?, ?)",
                jobId, jobId, requestJson, SecurityUtils.getCurrentUserId());
        try {
            kafkaTemplate.send("ld.ai-jobs", correlationId, envelope).get();
        } catch (Exception ex) {
            jdbcTemplate.update("UPDATE [" + schema + "].ai_job SET status='failed', in_dlq=1, "
                    + "error_message='Could not publish AI job to the queue', updated_at=SYSUTCDATETIME() WHERE id=?", jobId);
            log.warn("Could not publish document generation job {}", jobId);
        }
        return correlationId;
    }

    public AiJobResponse getAiJob(UUID jobId) {
        String schema = TenantContext.getSchema();
        return jdbcTemplate.query("SELECT id, job_type, status, retry_count, in_dlq, next_retry_at, error_message, "
                        + "result_document_id, created_at, updated_at FROM [" + schema + "].ai_job "
                        + "WHERE id=? AND job_type='doc_generation'",
                (rs, row) -> {
                    String status = rs.getString("status");
                    String errorMsg = rs.getString("error_message");
                    String errorCode = "failed".equalsIgnoreCase(status) ? "ERR_AI_GENERATION_FAILED" : null;
                    return new AiJobResponse(rs.getObject("id", UUID.class), rs.getString("job_type"),
                            status, rs.getInt("retry_count"), rs.getBoolean("in_dlq"),
                            rs.getTimestamp("next_retry_at") == null ? null : rs.getTimestamp("next_retry_at").toInstant(),
                            errorCode, errorMsg, rs.getObject("result_document_id", UUID.class),
                            rs.getTimestamp("created_at").toInstant(),
                            rs.getTimestamp("updated_at") == null ? null : rs.getTimestamp("updated_at").toInstant());
                },
                jobId).stream().findFirst().orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "AI job not found", "The generation job does not exist in this workspace."));
    }

    public AiJobResponse retryAiJob(UUID jobId) {
        String schema = TenantContext.getSchema();
        List<String> payloads = jdbcTemplate.query("SELECT request_payload FROM [" + schema + "].ai_job "
                        + "WHERE id=? AND job_type='doc_generation' AND status='failed' AND in_dlq=1",
                (rs, row) -> rs.getString(1), jobId);
        if (payloads.isEmpty()) throw new ApiException(HttpStatus.CONFLICT, "AI job cannot be retried", "Only failed jobs can be retried.");
        String raw = payloads.get(0);
        jdbcTemplate.update("UPDATE [" + schema + "].ai_job SET status='pending', retry_count=0, in_dlq=0, "
                + "next_retry_at=NULL, error_message=NULL, updated_at=SYSUTCDATETIME() WHERE id=?", jobId);
        try {
            EventEnvelope<?> envelope = objectMapper.readValue(raw, EventEnvelope.class);
            kafkaTemplate.send("ld.ai-jobs", jobId.toString(), envelope).get();
        } catch (Exception ex) {
            jdbcTemplate.update("UPDATE [" + schema + "].ai_job SET status='failed', in_dlq=1, "
                    + "error_message='Could not publish AI job to the queue', updated_at=SYSUTCDATETIME() WHERE id=?", jobId);
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI queue unavailable", "Could not queue the retry. Try again later.");
        }
        return getAiJob(jobId);
    }

    @Transactional
    public void processDocDraftEvent(EventEnvelope<DocDraftPayload> envelope) {
        if (envelope == null || envelope.getPayload() == null) return;
        DocDraftPayload p = envelope.getPayload();

        TenantContext.setTenant(envelope.getTenant() != null ? envelope.getTenant() : "demo");
        String schema = TenantContext.getSchema();
        UUID jobId;
        try { jobId = UUID.fromString(envelope.getCorrelationId()); }
        catch (Exception ex) { throw new IllegalArgumentException("DOC_DRAFT correlationId must identify its AI job", ex); }
        List<UUID> existingResult = jdbcTemplate.query("SELECT result_document_id FROM [" + schema
                        + "].ai_job WHERE id=? AND job_type='doc_generation'",
                (rs, row) -> rs.getObject(1, UUID.class), jobId);
        if (existingResult.isEmpty()) throw new IllegalStateException("AI generation job does not exist");
        if (existingResult.get(0) != null) return;

        // Stored procedure sp_create_document has 18 parameters (16 IN, 2 OUT)
        String callSql = String.format(
            "{CALL [%s].[sp_create_document](?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)}",
            schema
        );

        final UUID createdDocId;
        try {
            createdDocId = persistGeneratedDocument(schema, callSql, p);
        } catch (Exception ex) {
            log.error("Failed to persist generated document: {}", ex.getMessage(), ex);
            String errMsg = ex.getMessage();
            if (errMsg != null && errMsg.contains("uq_document_repo_path")) {
                errMsg = "Document already exists at path: " + p.getPathInRepo();
            } else if (errMsg != null && errMsg.length() > 500) {
                errMsg = errMsg.substring(0, 500);
            }
            jdbcTemplate.update("UPDATE [" + schema + "].ai_job SET status='failed', "
                    + "error_message=?, updated_at=SYSUTCDATETIME() WHERE id=?", errMsg, jobId);
            return;
        }

        if (createdDocId == null) {
            jdbcTemplate.update("UPDATE [" + schema + "].ai_job SET status='failed', "
                    + "error_message='Document procedure returned no document ID', updated_at=SYSUTCDATETIME() WHERE id=?", jobId);
            return;
        }

        if (createdDocId != null) {
            UUID tplVerId = p.getTemplateVersionId();
            if (tplVerId == null && p.getTemplateId() != null) {
                try {
                    String tplSql = String.format("SELECT current_version_id FROM [%s].[template] WHERE id = ?", schema);
                    List<UUID> vids = jdbcTemplate.query(tplSql, (rs, rn) -> rs.getString(1) != null ? UUID.fromString(rs.getString(1)) : null, p.getTemplateId());
                    if (!vids.isEmpty() && vids.get(0) != null) {
                        tplVerId = vids.get(0);
                    }
                } catch (Exception ignored) {}
            }
            if (tplVerId != null) {
                try {
                    String updVer = String.format("UPDATE [%s].[document_version] SET template_version_id = ? WHERE document_id = ? AND version_no = 1", schema);
                    jdbcTemplate.update(updVer, tplVerId, createdDocId);
                } catch (Exception ignored) {}
            }

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

            // Link every scoped entity from the immutable snapshot; chunk statements under SQL Server's parameter limit.
            if (p.getCodeEntityIds() != null && !p.getCodeEntityIds().isEmpty()
                    && p.getRepositoryId() != null && p.getSourceCommitSha() != null) {
                List<UUID> entityIds = p.getCodeEntityIds().stream().distinct().toList();
                List<UUID> verified = new ArrayList<>();
                for (int start = 0; start < entityIds.size(); start += 1800) {
                    List<UUID> batch = entityIds.subList(start, Math.min(start + 1800, entityIds.size()));
                    String idMarks = String.join(",", Collections.nCopies(batch.size(), "?"));
                    String verifySql = String.format(
                        "SELECT id FROM [%s].[code_entity] WHERE repository_id=? AND commit_hash=? AND removed_at IS NULL AND id IN (%s)",
                        schema, idMarks);
                    List<Object> verifyArgs = new ArrayList<>();
                    verifyArgs.add(p.getRepositoryId());
                    verifyArgs.add(p.getSourceCommitSha());
                    verifyArgs.addAll(batch);
                    verified.addAll(jdbcTemplate.query(verifySql,
                        (rs, row) -> UUID.fromString(rs.getString("id")), verifyArgs.toArray()));
                }
                if (verified.size() != entityIds.size()) {
                    throw new IllegalStateException("Generated draft references entities outside its source snapshot");
                }
                String insertLink = String.format(
                    "INSERT INTO [%s].[doc_code_link] (document_id, link_type, code_entity_id) VALUES (?, 'CODE_ENTITY', ?)", schema);
                List<Object[]> linkArgs = verified.stream().map(entityId -> new Object[] { createdDocId, entityId }).toList();
                jdbcTemplate.batchUpdate(insertLink, linkArgs);
            }

            jdbcTemplate.update("UPDATE [" + schema + "].ai_job SET status='completed', result_document_id=?, "
                    + "error_message=NULL, updated_at=SYSUTCDATETIME() WHERE id=? AND result_document_id IS NULL",
                    createdDocId, jobId);
        }
    }

    private DocumentResponse mapDocumentResponse(ResultSet rs) throws java.sql.SQLException {
        DocumentResponse res = new DocumentResponse();
        res.setId(UUID.fromString(rs.getString("id")));
        String repoId = rs.getString("repository_id");
        if (repoId != null) res.setRepositoryId(UUID.fromString(repoId));
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
        try {
            String tvId = rs.getString("template_version_id");
            if (tvId != null) res.setTemplateVersionId(UUID.fromString(tvId));
        } catch (Exception ignored) {}
        res.setCreatedAt(rs.getTimestamp("created_at").toInstant());
        return res;
    }

    private UUID persistGeneratedDocument(String schema, String callSql, DocDraftPayload p) {
        return jdbcTemplate.execute((java.sql.Connection conn) -> {
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
    }
}

