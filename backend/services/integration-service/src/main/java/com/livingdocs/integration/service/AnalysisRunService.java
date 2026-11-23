package com.livingdocs.integration.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.livingdocs.integration.config.TenantContext;
import com.livingdocs.integration.dto.AnalysisRunResponse;
import com.livingdocs.integration.dto.EventEnvelope;
import com.livingdocs.integration.dto.RepositoryDto;
import com.livingdocs.integration.dto.SourceEventDto;
import com.livingdocs.integration.event.SourceEventProducer;
import com.livingdocs.integration.repository.IntegrationJdbcRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class AnalysisRunService {
    private final JdbcTemplate jdbc;
    private final IntegrationJdbcRepository repositories;
    private final GitHubConnectionService github;
    private final SourceEventProducer producer;
    private final ObjectMapper mapper;

    public AnalysisRunService(JdbcTemplate jdbc, IntegrationJdbcRepository repositories,
            GitHubConnectionService github, SourceEventProducer producer, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.repositories = repositories;
        this.github = github;
        this.producer = producer;
        this.mapper = mapper;
    }

    @Transactional
    public UUID startBaseline(RepositoryDto repository) {
        String sha = github.getBranchHeadSha(repository.connectionId(), repository.fullName(), repository.defaultBranch());
        UUID runId = UUID.randomUUID();
        UUID correlationId = UUID.randomUUID();
        insertRun(runId, repository.id(), null, correlationId, "repository_connected", null, sha);
        publish(repository.id(), runId, correlationId, "refs/heads/" + repository.defaultBranch(),
                null, sha, "repository_connected", runId);
        return runId;
    }

    @Transactional
    public UUID startForSourceEvent(UUID repositoryId, UUID sourceEventId, UUID correlationId,
            String eventType, String githubRef, String state, String deliveryId,
            String diffDigest, boolean createdByLivingDocs, String rawPayload,
            String baseSha, String headSha) {
        if (createdByLivingDocs || !isSha(headSha)) return null;
        String trigger = "pr".equalsIgnoreCase(eventType) ? "pull_request" : "push";
        UUID runId = UUID.randomUUID();
        insertRun(runId, repositoryId, sourceEventId, correlationId, trigger,
                isSha(baseSha) ? baseSha : null, headSha);
        return runId;
    }

    private void insertRun(UUID id, UUID repositoryId, UUID sourceEventId, UUID correlationId,
            String trigger, String baseSha, String headSha) {
        String schema = TenantContext.getSchemaName();
        jdbc.update("INSERT INTO [" + schema + "].analysis_run "
                        + "(id, repository_id, source_event_id, correlation_id, trigger_type, base_commit_sha, head_commit_sha) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?)",
                id, repositoryId, sourceEventId, correlationId, trigger, baseSha, headSha);
    }

    private void publish(UUID repositoryId, UUID eventId, UUID correlationId, String githubRef,
            String state, String headSha, String trigger, UUID runId) {
        publish(repositoryId, eventId, correlationId, githubRef, state, headSha, trigger, runId,
                null, null, null, false);
    }

    private void publish(UUID repositoryId, UUID eventId, UUID correlationId, String githubRef,
            String state, String headSha, String trigger, UUID runId, String originalPayload,
            String deliveryId, String diffDigest, boolean createdByLivingDocs) {
        try {
            var root = originalPayload == null
                    ? mapper.createObjectNode() : (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree(originalPayload);
            if (originalPayload == null) {
                if ("pull_request".equals(trigger)) root.put("action", "opened");
                root.put("after", headSha);
            }
            if (runId != null) root.put("analysisRunId", runId.toString());
            SourceEventDto event = new SourceEventDto(eventId, repositoryId,
                    "pull_request".equals(trigger) ? "pr" : "commit", githubRef,
                    state == null ? "open" : state, deliveryId,
                    diffDigest, createdByLivingDocs, correlationId, Instant.now(),
                    mapper.writeValueAsString(root), runId);
            producer.publishSourceEvent(event);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Could not serialize analysis source event", ex);
        }
    }

    public AnalysisRunResponse get(UUID runId) {
        String schema = TenantContext.getSchemaName();
        return jdbc.query("SELECT id, repository_id, trigger_type, base_commit_sha, head_commit_sha, status, "
                        + "files_indexed, entities_indexed, error_message, created_at, started_at, completed_at "
                        + "FROM [" + schema + "].analysis_run WHERE id = ?",
                (rs, row) -> new AnalysisRunResponse(rs.getObject("id", UUID.class),
                        rs.getObject("repository_id", UUID.class), rs.getString("trigger_type"),
                        rs.getString("base_commit_sha"), rs.getString("head_commit_sha"), rs.getString("status"),
                        rs.getInt("files_indexed"), rs.getInt("entities_indexed"), rs.getString("error_message"),
                        rs.getTimestamp("created_at").toInstant(),
                        rs.getTimestamp("started_at") == null ? null : rs.getTimestamp("started_at").toInstant(),
                        rs.getTimestamp("completed_at") == null ? null : rs.getTimestamp("completed_at").toInstant()), runId)
                .stream().findFirst().orElseThrow(() -> new IllegalArgumentException("Analysis run not found"));
    }

    public List<AnalysisRunResponse> list(UUID repositoryId) {
        String schema = TenantContext.getSchemaName();
        return jdbc.query("SELECT TOP (50) id, repository_id, trigger_type, base_commit_sha, head_commit_sha, status, "
                        + "files_indexed, entities_indexed, error_message, created_at, started_at, completed_at "
                        + "FROM [" + schema + "].analysis_run WHERE repository_id = ? ORDER BY created_at DESC",
                (rs, row) -> new AnalysisRunResponse(rs.getObject("id", UUID.class),
                        rs.getObject("repository_id", UUID.class), rs.getString("trigger_type"),
                        rs.getString("base_commit_sha"), rs.getString("head_commit_sha"), rs.getString("status"),
                        rs.getInt("files_indexed"), rs.getInt("entities_indexed"), rs.getString("error_message"),
                        rs.getTimestamp("created_at").toInstant(),
                        rs.getTimestamp("started_at") == null ? null : rs.getTimestamp("started_at").toInstant(),
                        rs.getTimestamp("completed_at") == null ? null : rs.getTimestamp("completed_at").toInstant()), repositoryId);
    }

    private static boolean isSha(String value) {
        return value != null && value.matches("[0-9a-fA-F]{40}") && !value.equals("0".repeat(40));
    }
}
