package com.livingdocs.governance.service;

import com.livingdocs.common.security.SecurityUtils;
import com.livingdocs.common.security.TenantContext;
import com.livingdocs.governance.dto.CollectionResponse;
import com.livingdocs.governance.dto.CreateCollectionRequest;
import com.livingdocs.governance.dto.UpdateCollectionRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class CollectionService {

    private final JdbcTemplate jdbcTemplate;

    public CollectionService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<CollectionResponse> listCollections() {
        String schema = TenantContext.getSchema();
        String sql = String.format(
            "SELECT c.id, c.name, c.description, c.owner_id, u.email as owner_name, c.default_template_id, t.name as template_name, " +
            "c.created_at, c.updated_at, (SELECT COUNT(*) FROM [%s].[document] d WHERE d.collection_id = c.id) as doc_count " +
            "FROM [%s].[collection] c " +
            "LEFT JOIN [%s].[app_user] u ON u.id = c.owner_id " +
            "LEFT JOIN [%s].[template] t ON t.id = c.default_template_id " +
            "ORDER BY c.created_at ASC",
            schema, schema, schema, schema
        );

        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            CollectionResponse res = new CollectionResponse();
            res.setId(UUID.fromString(rs.getString("id")));
            res.setName(rs.getString("name"));
            res.setDescription(rs.getString("description"));
            String ownerStr = rs.getString("owner_id");
            if (ownerStr != null) res.setOwnerId(UUID.fromString(ownerStr));
            res.setOwnerName(rs.getString("owner_name"));
            String tplStr = rs.getString("default_template_id");
            if (tplStr != null) res.setDefaultTemplateId(UUID.fromString(tplStr));
            res.setDefaultTemplateName(rs.getString("template_name"));
            res.setDocumentCount(rs.getLong("doc_count"));
            res.setCreatedAt(rs.getTimestamp("created_at").toInstant());
            res.setUpdatedAt(rs.getTimestamp("updated_at") != null ? rs.getTimestamp("updated_at").toInstant() : null);
            return res;
        });
    }

    public CollectionResponse getCollectionById(UUID id) {
        String schema = TenantContext.getSchema();
        String sql = String.format(
            "SELECT c.id, c.name, c.description, c.owner_id, u.email as owner_name, c.default_template_id, t.name as template_name, " +
            "c.created_at, c.updated_at, (SELECT COUNT(*) FROM [%s].[document] d WHERE d.collection_id = c.id) as doc_count " +
            "FROM [%s].[collection] c " +
            "LEFT JOIN [%s].[app_user] u ON u.id = c.owner_id " +
            "LEFT JOIN [%s].[template] t ON t.id = c.default_template_id " +
            "WHERE c.id = ?",
            schema, schema, schema, schema
        );

        List<CollectionResponse> results = jdbcTemplate.query(sql, (rs, rowNum) -> {
            CollectionResponse res = new CollectionResponse();
            res.setId(UUID.fromString(rs.getString("id")));
            res.setName(rs.getString("name"));
            res.setDescription(rs.getString("description"));
            String ownerStr = rs.getString("owner_id");
            if (ownerStr != null) res.setOwnerId(UUID.fromString(ownerStr));
            res.setOwnerName(rs.getString("owner_name"));
            String tplStr = rs.getString("default_template_id");
            if (tplStr != null) res.setDefaultTemplateId(UUID.fromString(tplStr));
            res.setDefaultTemplateName(rs.getString("template_name"));
            res.setDocumentCount(rs.getLong("doc_count"));
            res.setCreatedAt(rs.getTimestamp("created_at").toInstant());
            res.setUpdatedAt(rs.getTimestamp("updated_at") != null ? rs.getTimestamp("updated_at").toInstant() : null);
            return res;
        }, id);

        if (results.isEmpty()) {
            throw new IllegalArgumentException("Collection not found: " + id);
        }
        return results.get(0);
    }

    @Transactional
    public CollectionResponse createCollection(CreateCollectionRequest req) {
        String schema = TenantContext.getSchema();
        UUID userId = SecurityUtils.getCurrentUserId();
        UUID id = UUID.randomUUID();
        UUID ownerId = req.getOwnerId() != null ? req.getOwnerId() : userId;

        String insertSql = String.format(
            "INSERT INTO [%s].[collection] (id, name, description, owner_id, default_template_id, created_by, updated_by) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            schema
        );
        jdbcTemplate.update(insertSql, id, req.getName(), req.getDescription(), ownerId, req.getDefaultTemplateId(), userId, userId);
        return getCollectionById(id);
    }

    @Transactional
    public CollectionResponse updateCollection(UUID id, UpdateCollectionRequest req) {
        String schema = TenantContext.getSchema();
        UUID userId = SecurityUtils.getCurrentUserId();

        String updateSql = String.format(
            "UPDATE [%s].[collection] SET name = ?, description = ?, owner_id = ?, default_template_id = ?, updated_by = ?, updated_at = SYSUTCDATETIME() " +
            "WHERE id = ?",
            schema
        );
        int rows = jdbcTemplate.update(updateSql, req.getName(), req.getDescription(), req.getOwnerId(), req.getDefaultTemplateId(), userId, id);
        if (rows == 0) {
            throw new IllegalArgumentException("Collection not found: " + id);
        }
        return getCollectionById(id);
    }

    @Transactional
    public void deleteCollection(UUID id) {
        String schema = TenantContext.getSchema();

        // Check if any documents belong to this collection, set to null
        String detachSql = String.format("UPDATE [%s].[document] SET collection_id = NULL WHERE collection_id = ?", schema);
        jdbcTemplate.update(detachSql, id);

        String deleteSql = String.format("DELETE FROM [%s].[collection] WHERE id = ?", schema);
        int rows = jdbcTemplate.update(deleteSql, id);
        if (rows == 0) {
            throw new IllegalArgumentException("Collection not found: " + id);
        }
    }
}
