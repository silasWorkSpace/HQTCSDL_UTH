package com.livingdocs.integration.repository;

import com.livingdocs.integration.config.TenantContext;
import com.livingdocs.integration.dto.ConnectionResponse;
import com.livingdocs.integration.dto.RepositoryDto;
import com.livingdocs.integration.dto.SourceEventDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Types;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class IntegrationJdbcRepository {

    private static final Logger log = LoggerFactory.getLogger(IntegrationJdbcRepository.class);

    private final JdbcTemplate jdbcTemplate;

    public IntegrationJdbcRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public record IngestResult(UUID eventId, boolean isDuplicate) {}

    /**
     * Gọi Stored Procedure [ws_<code>].sp_ingest_source_event tiếp nhận sự kiện webhook (NFR-REL-05).
     */
    public IngestResult ingestSourceEvent(
            UUID repositoryId,
            String eventType,
            String githubRef,
            String state,
            String deliveryId,
            String diffDigest,
            boolean createdByLivingDocs,
            UUID correlationId,
            String payload
    ) {
        String schema = TenantContext.getSchemaName();
        String sql = String.format("{call [%s].sp_ingest_source_event(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)}", schema);

        return jdbcTemplate.execute((Connection conn) -> {
            try (CallableStatement cs = conn.prepareCall(sql)) {
                cs.setObject(1, repositoryId);
                cs.setString(2, eventType);
                cs.setString(3, githubRef);
                cs.setString(4, state);
                cs.setString(5, deliveryId);
                cs.setString(6, diffDigest);
                cs.setBoolean(7, createdByLivingDocs);
                cs.setObject(8, correlationId != null ? correlationId : UUID.randomUUID());
                cs.setString(9, payload);

                cs.registerOutParameter(10, Types.VARCHAR); // @event_id
                cs.registerOutParameter(11, Types.BIT);     // @is_duplicate

                cs.execute();

                String eventIdStr = cs.getString(10);
                boolean isDuplicate = cs.getBoolean(11);
                UUID eventId = eventIdStr != null ? UUID.fromString(eventIdStr) : null;

                return new IngestResult(eventId, isDuplicate);
            }
        });
    }

    /**
     * Gọi Stored Procedure [ws_<code>].sp_disconnect_repository để ngắt kết nối và dọn dẹp thực thể code (GH-04).
     */
    public void disconnectRepository(UUID repositoryId) {
        String schema = TenantContext.getSchemaName();
        String sql = String.format("{call [%s].sp_disconnect_repository(?)}", schema);

        jdbcTemplate.execute((Connection conn) -> {
            try (CallableStatement cs = conn.prepareCall(sql)) {
                cs.setObject(1, repositoryId);
                cs.execute();
                return null;
            }
        });
        log.info("Đã thực thi sp_disconnect_repository cho repositoryId={} trên schema={}", repositoryId, schema);
    }

    public UUID saveConnection(String installationId, String accountLogin, byte[] encryptedToken, UUID connectedBy) {
        String schema = TenantContext.getSchemaName();
        UUID id = UUID.randomUUID();
        String sql = String.format(
                "INSERT INTO [%s].github_connection (id, installation_id, account_login, access_token_enc, status, connected_by) " +
                "VALUES (?, ?, ?, ?, 'active', ?)",
                schema
        );
        jdbcTemplate.update(sql, id, installationId, accountLogin, encryptedToken, connectedBy != null ? connectedBy : UUID.randomUUID());
        return id;
    }

    public Optional<ConnectionResponse> findConnectionById(UUID id) {
        String schema = TenantContext.getSchemaName();
        String sql = String.format(
                "SELECT id, installation_id, account_login, status, connected_by, created_at FROM [%s].github_connection WHERE id = ?",
                schema
        );
        List<ConnectionResponse> list = jdbcTemplate.query(sql, (rs, rowNum) -> new ConnectionResponse(
                UUID.fromString(rs.getString("id")),
                rs.getString("installation_id"),
                rs.getString("account_login"),
                rs.getString("status"),
                rs.getObject("connected_by") != null ? UUID.fromString(rs.getString("connected_by")) : null,
                rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toInstant() : Instant.now()
        ), id);
        return list.stream().findFirst();
    }

    public UUID saveRepository(UUID connectionId, Long githubRepoId, String fullName, String defaultBranch) {
        String schema = TenantContext.getSchemaName();
        UUID id = UUID.randomUUID();
        String branch = (defaultBranch != null && !defaultBranch.isBlank()) ? defaultBranch : "main";
        String sql = String.format(
                "INSERT INTO [%s].repository (id, connection_id, github_repo_id, full_name, default_branch, connection_status) " +
                "VALUES (?, ?, ?, ?, ?, 'connected')",
                schema
        );
        jdbcTemplate.update(sql, id, connectionId, githubRepoId, fullName, branch);
        return id;
    }

    public List<RepositoryDto> findRepositories() {
        String schema = TenantContext.getSchemaName();
        String sql = String.format(
                "SELECT id, connection_id, github_repo_id, full_name, default_branch, connection_status, last_synced_at, created_at " +
                "FROM [%s].repository ORDER BY created_at DESC",
                schema
        );
        return jdbcTemplate.query(sql, this::mapRepositoryDto);
    }

    public Optional<RepositoryDto> findRepositoryById(UUID id) {
        String schema = TenantContext.getSchemaName();
        String sql = String.format(
                "SELECT id, connection_id, github_repo_id, full_name, default_branch, connection_status, last_synced_at, created_at " +
                "FROM [%s].repository WHERE id = ?",
                schema
        );
        List<RepositoryDto> list = jdbcTemplate.query(sql, this::mapRepositoryDto, id);
        return list.stream().findFirst();
    }

    public Optional<RepositoryDto> findRepositoryByGithubId(Long githubRepoId) {
        String schema = TenantContext.getSchemaName();
        String sql = String.format(
                "SELECT id, connection_id, github_repo_id, full_name, default_branch, connection_status, last_synced_at, created_at " +
                "FROM [%s].repository WHERE github_repo_id = ?",
                schema
        );
        List<RepositoryDto> list = jdbcTemplate.query(sql, this::mapRepositoryDto, githubRepoId);
        return list.stream().findFirst();
    }

    public List<SourceEventDto> findEventsByRepository(UUID repositoryId) {
        String schema = TenantContext.getSchemaName();
        String sql = String.format(
                "SELECT id, repository_id, event_type, github_ref, state, delivery_id, diff_digest, " +
                "created_by_livingdocs, correlation_id, received_at, payload " +
                "FROM [%s].source_event WHERE repository_id = ? ORDER BY received_at DESC",
                schema
        );
        return jdbcTemplate.query(sql, (rs, rowNum) -> new SourceEventDto(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("repository_id")),
                rs.getString("event_type"),
                rs.getString("github_ref"),
                rs.getString("state"),
                rs.getString("delivery_id"),
                rs.getString("diff_digest"),
                rs.getBoolean("created_by_livingdocs"),
                rs.getObject("correlation_id") != null ? UUID.fromString(rs.getString("correlation_id")) : null,
                rs.getTimestamp("received_at") != null ? rs.getTimestamp("received_at").toInstant() : Instant.now(),
                rs.getString("payload")
        ), repositoryId);
    }

    private RepositoryDto mapRepositoryDto(ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new RepositoryDto(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("connection_id")),
                rs.getLong("github_repo_id"),
                rs.getString("full_name"),
                rs.getString("default_branch"),
                rs.getString("connection_status"),
                rs.getTimestamp("last_synced_at") != null ? rs.getTimestamp("last_synced_at").toInstant() : null,
                rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toInstant() : Instant.now()
        );
    }
}
