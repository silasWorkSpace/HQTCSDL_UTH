package com.livingdocs.governance.service;

import com.livingdocs.common.security.TenantContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Service
public class GovernanceReportService {

    private final JdbcTemplate jdbcTemplate;

    public GovernanceReportService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Map<String, Object>> generateHealthReportData(UUID repositoryId, UUID collectionId, String severity, Instant from, Instant to) {
        String schema = TenantContext.getSchema();
        StringBuilder sql = new StringBuilder(String.format(
            "SELECT d.id as doc_id, d.title, d.doc_type, d.doc_status, d.publish_status, d.created_at, d.updated_at, " +
            "r.full_name as repository_name, c.name as collection_name, " +
            "da.id as drift_id, da.drift_type, da.severity as drift_severity, da.handling_status as drift_status " +
            "FROM [%s].[document] d " +
            "LEFT JOIN [%s].[repository] r ON r.id = d.repository_id " +
            "LEFT JOIN [%s].[collection] c ON c.id = d.collection_id " +
            "LEFT JOIN [%s].[drift_alert] da ON da.document_id = d.id " +
            "WHERE 1=1 ",
            schema, schema, schema, schema
        ));
        List<Object> params = new ArrayList<>();

        if (repositoryId != null) {
            sql.append("AND d.repository_id = ? ");
            params.add(repositoryId);
        }
        if (collectionId != null) {
            sql.append("AND d.collection_id = ? ");
            params.add(collectionId);
        }
        if (severity != null && !severity.isBlank()) {
            sql.append("AND da.severity = ? ");
            params.add(severity);
        }
        if (from != null) {
            sql.append("AND d.updated_at >= ? ");
            params.add(Timestamp.from(from));
        }
        if (to != null) {
            sql.append("AND d.updated_at <= ? ");
            params.add(Timestamp.from(to));
        }

        sql.append("ORDER BY d.updated_at DESC");

        return jdbcTemplate.query(sql.toString(), (rs, rn) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("documentId", rs.getString("doc_id"));
            row.put("title", rs.getString("title"));
            row.put("docType", rs.getString("doc_type"));
            row.put("docStatus", rs.getString("doc_status"));
            row.put("publishStatus", rs.getString("publish_status"));
            row.put("repository", rs.getString("repository_name"));
            row.put("collection", rs.getString("collection_name"));
            row.put("driftId", rs.getString("drift_id"));
            row.put("driftType", rs.getString("drift_type"));
            row.put("driftSeverity", rs.getString("drift_severity"));
            row.put("driftStatus", rs.getString("drift_status"));
            row.put("createdAt", rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toInstant().toString() : null);
            row.put("updatedAt", rs.getTimestamp("updated_at") != null ? rs.getTimestamp("updated_at").toInstant().toString() : null);
            return row;
        }, params.toArray());
    }

    public String exportHealthReportCsv(List<Map<String, Object>> data) {
        StringBuilder csv = new StringBuilder();
        csv.append("Document ID,Title,Doc Type,Status,Publish Status,Repository,Collection,Drift Severity,Drift Status,Updated At\n");
        for (Map<String, Object> r : data) {
            csv.append(escapeCsv(r.get("documentId"))).append(",")
               .append(escapeCsv(r.get("title"))).append(",")
               .append(escapeCsv(r.get("docType"))).append(",")
               .append(escapeCsv(r.get("docStatus"))).append(",")
               .append(escapeCsv(r.get("publishStatus"))).append(",")
               .append(escapeCsv(r.get("repository"))).append(",")
               .append(escapeCsv(r.get("collection"))).append(",")
               .append(escapeCsv(r.get("driftSeverity"))).append(",")
               .append(escapeCsv(r.get("driftStatus"))).append(",")
               .append(escapeCsv(r.get("updatedAt"))).append("\n");
        }
        return csv.toString();
    }

    public List<Map<String, Object>> generateComplianceReportData(UUID repositoryId, UUID collectionId) {
        String schema = TenantContext.getSchema();
        String sql = String.format(
            "SELECT d.id as doc_id, d.title, d.doc_type, d.doc_status, " +
            "  t.name as template_name, " +
            "  (SELECT COUNT(*) FROM [%s].[document_version] dv WHERE dv.document_id = d.id) as version_count, " +
            "  (SELECT COUNT(*) FROM [%s].[doc_code_link] l WHERE l.document_id = d.id) as code_link_count, " +
            "  CASE WHEN d.doc_status = 'PUBLISHED' THEN 1 ELSE 0 END as is_compliant " +
            "FROM [%s].[document] d " +
            "LEFT JOIN [%s].[template] t ON t.id = d.template_id " +
            "WHERE 1=1 " +
            (repositoryId != null ? "AND d.repository_id = ? " : "") +
            (collectionId != null ? "AND d.collection_id = ? " : "") +
            "ORDER BY d.created_at DESC",
            schema, schema, schema, schema
        );

        List<Object> params = new ArrayList<>();
        if (repositoryId != null) params.add(repositoryId);
        if (collectionId != null) params.add(collectionId);

        return jdbcTemplate.query(sql, (rs, rn) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("documentId", rs.getString("doc_id"));
            row.put("title", rs.getString("title"));
            row.put("docType", rs.getString("doc_type"));
            row.put("docStatus", rs.getString("doc_status"));
            row.put("templateName", rs.getString("template_name"));
            row.put("versionCount", rs.getLong("version_count"));
            row.put("codeLinkCount", rs.getLong("code_link_count"));
            row.put("compliant", rs.getInt("is_compliant") == 1);
            return row;
        }, params.toArray());
    }

    public String exportComplianceReportCsv(List<Map<String, Object>> data) {
        StringBuilder csv = new StringBuilder();
        csv.append("Document ID,Title,Doc Type,Status,Template,Versions,Code Links,Compliant\n");
        for (Map<String, Object> r : data) {
            csv.append(escapeCsv(r.get("documentId"))).append(",")
               .append(escapeCsv(r.get("title"))).append(",")
               .append(escapeCsv(r.get("docType"))).append(",")
               .append(escapeCsv(r.get("docStatus"))).append(",")
               .append(escapeCsv(r.get("templateName"))).append(",")
               .append(escapeCsv(r.get("versionCount"))).append(",")
               .append(escapeCsv(r.get("codeLinkCount"))).append(",")
               .append(escapeCsv(r.get("compliant"))).append("\n");
        }
        return csv.toString();
    }

    private String escapeCsv(Object val) {
        if (val == null) return "";
        String s = val.toString();
        if (s.contains(",") || s.contains("\"") || s.contains("\n")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }
}
