package com.livingdocs.governance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.livingdocs.common.security.SecurityUtils;
import com.livingdocs.common.security.TenantContext;
import com.livingdocs.governance.dto.CollectionResponse;
import com.livingdocs.governance.dto.CreateTemplateRequest;
import com.livingdocs.governance.dto.TemplateResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;

@Service
public class TemplateService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public TemplateService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public void validateJson(String jsonStr) {
        if (jsonStr == null || jsonStr.isBlank()) {
            throw new IllegalArgumentException("JSON content cannot be empty.");
        }
        try {
            objectMapper.readTree(jsonStr);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid JSON format: " + e.getMessage(), e);
        }
    }

    @Transactional
    public TemplateResponse createTemplate(CreateTemplateRequest req) {
        validateJson(req.getSections());
        if (req.getFormatRules() != null && !req.getFormatRules().isBlank()) {
            validateJson(req.getFormatRules());
        }

        String schema = TenantContext.getSchema();
        UUID userId = SecurityUtils.getCurrentUserId();
        UUID templateId = UUID.randomUUID();

        // 1. Insert template
        String insertTemplateSql = String.format(
            "INSERT INTO [%s].[template] (id, name, doc_type, description, status, created_by, updated_by) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)",
            schema
        );
        jdbcTemplate.update(insertTemplateSql, templateId, req.getName(), req.getDocType(), req.getDescription(), userId, userId);

        // 2. Insert template_version 1
        UUID versionId = UUID.randomUUID();
        String insertVersionSql = String.format(
            "INSERT INTO [%s].[template_version] (id, template_id, version_no, sections, format_rules, change_note, created_by, updated_by) " +
            "VALUES (?, ?, 1, ?, ?, 'Initial creation', ?, ?)",
            schema
        );
        jdbcTemplate.update(insertVersionSql, versionId, templateId, req.getSections(), req.getFormatRules(), userId, userId);

        // 3. Update current_version_id
        String updateCurrentSql = String.format(
            "UPDATE [%s].[template] SET current_version_id = ? WHERE id = ?",
            schema
        );
        jdbcTemplate.update(updateCurrentSql, versionId, templateId);

        return getTemplateById(templateId);
    }

    public List<TemplateResponse> listTemplates() {
        String schema = TenantContext.getSchema();
        String sql = String.format(
            "SELECT t.id, t.name, t.doc_type, t.description, t.current_version_id, tv.version_no, t.status, " +
            "tv.sections, tv.format_rules, t.created_at, t.updated_at " +
            "FROM [%s].[template] t " +
            "LEFT JOIN [%s].[template_version] tv ON tv.id = t.current_version_id " +
            "ORDER BY t.created_at DESC",
            schema, schema
        );

        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            TemplateResponse res = new TemplateResponse();
            res.setId(UUID.fromString(rs.getString("id")));
            res.setName(rs.getString("name"));
            res.setDocType(rs.getString("doc_type"));
            res.setDescription(rs.getString("description"));
            String curVer = rs.getString("current_version_id");
            if (curVer != null) res.setCurrentVersionId(UUID.fromString(curVer));
            res.setCurrentVersionNo(rs.getInt("version_no"));
            res.setStatus(rs.getString("status"));
            res.setSections(rs.getString("sections"));
            res.setFormatRules(rs.getString("format_rules"));
            res.setCreatedAt(rs.getTimestamp("created_at").toInstant());
            res.setUpdatedAt(rs.getTimestamp("updated_at").toInstant());
            return res;
        });
    }

    public TemplateResponse getTemplateById(UUID id) {
        String schema = TenantContext.getSchema();
        String sql = String.format(
            "SELECT t.id, t.name, t.doc_type, t.description, t.current_version_id, tv.version_no, t.status, " +
            "tv.sections, tv.format_rules, t.created_at, t.updated_at " +
            "FROM [%s].[template] t " +
            "LEFT JOIN [%s].[template_version] tv ON tv.id = t.current_version_id " +
            "WHERE t.id = ?",
            schema, schema
        );

        List<TemplateResponse> results = jdbcTemplate.query(sql, (rs, rowNum) -> {
            TemplateResponse res = new TemplateResponse();
            res.setId(UUID.fromString(rs.getString("id")));
            res.setName(rs.getString("name"));
            res.setDocType(rs.getString("doc_type"));
            res.setDescription(rs.getString("description"));
            String curVer = rs.getString("current_version_id");
            if (curVer != null) res.setCurrentVersionId(UUID.fromString(curVer));
            res.setCurrentVersionNo(rs.getInt("version_no"));
            res.setStatus(rs.getString("status"));
            res.setSections(rs.getString("sections"));
            res.setFormatRules(rs.getString("format_rules"));
            res.setCreatedAt(rs.getTimestamp("created_at").toInstant());
            res.setUpdatedAt(rs.getTimestamp("updated_at").toInstant());
            return res;
        }, id);

        if (results.isEmpty()) {
            throw new RuntimeException("Template not found: " + id);
        }
        return results.get(0);
    }

    @Transactional
    public TemplateResponse updateTemplate(UUID id, CreateTemplateRequest req) {
        validateJson(req.getSections());
        if (req.getFormatRules() != null && !req.getFormatRules().isBlank()) {
            validateJson(req.getFormatRules());
        }

        String schema = TenantContext.getSchema();
        UUID userId = SecurityUtils.getCurrentUserId();

        // Check latest version number
        String verSql = String.format(
            "SELECT ISNULL(MAX(version_no), 0) FROM [%s].[template_version] WHERE template_id = ?",
            schema
        );
        Integer maxVer = jdbcTemplate.queryForObject(verSql, Integer.class, id);
        int nextVer = (maxVer != null ? maxVer : 0) + 1;

        UUID newVerId = UUID.randomUUID();
        String insertVerSql = String.format(
            "INSERT INTO [%s].[template_version] (id, template_id, version_no, sections, format_rules, change_note, created_by, updated_by) " +
            "VALUES (?, ?, ?, ?, ?, 'Template updated', ?, ?)",
            schema
        );
        jdbcTemplate.update(insertVerSql, newVerId, id, nextVer, req.getSections(), req.getFormatRules(), userId, userId);

        String updateTplSql = String.format(
            "UPDATE [%s].[template] SET name = ?, doc_type = ?, description = ?, current_version_id = ?, updated_by = ?, updated_at = SYSUTCDATETIME() WHERE id = ?",
            schema
        );
        jdbcTemplate.update(updateTplSql, req.getName(), req.getDocType(), req.getDescription(), newVerId, userId, id);

        return getTemplateById(id);
    }

    @Transactional
    public TemplateResponse cloneTemplate(UUID id, String newName) {
        TemplateResponse source = getTemplateById(id);
        CreateTemplateRequest req = new CreateTemplateRequest();
        req.setName(newName != null ? newName : source.getName() + " (Copy)");
        req.setDocType(source.getDocType());
        req.setDescription(source.getDescription());
        req.setSections(source.getSections());
        req.setFormatRules(source.getFormatRules());
        return createTemplate(req);
    }

    @Transactional
    public void archiveTemplate(UUID id) {
        String schema = TenantContext.getSchema();
        UUID userId = SecurityUtils.getCurrentUserId();
        String sql = String.format(
            "UPDATE [%s].[template] SET status = 'ARCHIVED', updated_at = SYSUTCDATETIME(), updated_by = ? WHERE id = ?",
            schema
        );
        int rows = jdbcTemplate.update(sql, userId, id);
        if (rows == 0) {
            throw new RuntimeException("Template not found: " + id);
        }
    }

    public List<CollectionResponse> listCollections() {
        String schema = TenantContext.getSchema();
        String sql = String.format(
            "SELECT id, name, description, default_template_id, created_at FROM [%s].[collection] ORDER BY created_at ASC",
            schema
        );
        return jdbcTemplate.query(sql, (rs, rowNum) -> new CollectionResponse(
            UUID.fromString(rs.getString("id")),
            rs.getString("name"),
            rs.getString("description"),
            rs.getString("default_template_id") != null ? UUID.fromString(rs.getString("default_template_id")) : null,
            rs.getTimestamp("created_at").toInstant()
        ));
    }

    @Transactional
    public void seedDefaultTemplatesAndCollection() {
        String schema = TenantContext.getSchema();
        
        // 5 default templates
        String[][] seeds = new String[][] {
            {"API Reference", "API_REFERENCE", "Tham chiếu API: endpoint, tham số, giá trị trả về, lỗi.",
             "{\"sections\":[{\"key\":\"overview\",\"title\":\"Tổng quan\",\"required\":true},{\"key\":\"endpoints\",\"title\":\"Danh sách endpoint\",\"required\":true,\"placeholder\":\"{{endpoint_list}}\",\"entity_kind\":\"endpoint\"},{\"key\":\"parameters\",\"title\":\"Bảng tham số\",\"required\":true,\"placeholder\":\"{{parameter_table}}\",\"entity_kind\":\"parameter\"},{\"key\":\"responses\",\"title\":\"Giá trị trả về\",\"required\":true},{\"key\":\"errors\",\"title\":\"Mã lỗi\",\"required\":false}]}"},
            {"README", "README", "README chuẩn cho repo hoặc module.",
             "{\"sections\":[{\"key\":\"overview\",\"title\":\"Giới thiệu\",\"required\":true},{\"key\":\"getting_started\",\"title\":\"Bắt đầu nhanh\",\"required\":true},{\"key\":\"usage\",\"title\":\"Cách sử dụng\",\"required\":true},{\"key\":\"configuration\",\"title\":\"Cấu hình\",\"required\":false}]}"},
            {"Module Guide", "MODULE_GUIDE", "Hướng dẫn module/package: class, phụ thuộc, ví dụ.",
             "{\"sections\":[{\"key\":\"purpose\",\"title\":\"Mục đích\",\"required\":true},{\"key\":\"classes\",\"title\":\"Danh sách class\",\"required\":true,\"placeholder\":\"{{class_list}}\",\"entity_kind\":\"class\"},{\"key\":\"dependencies\",\"title\":\"Phụ thuộc\",\"required\":true,\"placeholder\":\"{{dependency_list}}\"},{\"key\":\"examples\",\"title\":\"Ví dụ sử dụng\",\"required\":false}]}"},
            {"Onboarding Guide", "ONBOARDING_GUIDE", "Hướng dẫn hội nhập lập trình viên mới.",
             "{\"sections\":[{\"key\":\"welcome\",\"title\":\"Chào mừng\",\"required\":true},{\"key\":\"architecture\",\"title\":\"Kiến trúc tổng quan\",\"required\":true},{\"key\":\"local_setup\",\"title\":\"Cài đặt môi trường\",\"required\":true},{\"key\":\"key_modules\",\"title\":\"Các module chính\",\"required\":true,\"placeholder\":\"{{module_list}}\"},{\"key\":\"contribution\",\"title\":\"Quy trình đóng góp\",\"required\":false}]}"},
            {"ADR", "ADR", "Architecture Decision Record.",
             "{\"sections\":[{\"key\":\"title\",\"title\":\"Tiêu đề quyết định\",\"required\":true},{\"key\":\"status\",\"title\":\"Trạng thái\",\"required\":true},{\"key\":\"context\",\"title\":\"Bối cảnh\",\"required\":true},{\"key\":\"decision\",\"title\":\"Quyết định\",\"required\":true},{\"key\":\"consequences\",\"title\":\"Hệ quả\",\"required\":true}]}"}
        };

        for (String[] seed : seeds) {
            String checkSql = String.format("SELECT COUNT(*) FROM [%s].[template] WHERE name = ?", schema);
            Integer count = jdbcTemplate.queryForObject(checkSql, Integer.class, seed[0]);
            if (count == null || count == 0) {
                CreateTemplateRequest req = new CreateTemplateRequest();
                req.setName(seed[0]);
                req.setDocType(seed[1]);
                req.setDescription(seed[2]);
                req.setSections(seed[3]);
                req.setFormatRules("{\"output\":\"markdown\",\"language\":\"vi\",\"max_heading_depth\":3}");
                createTemplate(req);
            }
        }

        // Default collection
        String checkCol = String.format("SELECT COUNT(*) FROM [%s].[collection] WHERE name = N'Default'", schema);
        Integer colCount = jdbcTemplate.queryForObject(checkCol, Integer.class);
        if (colCount == null || colCount == 0) {
            String readmeTplSql = String.format("SELECT id FROM [%s].[template] WHERE name = 'README'", schema);
            List<UUID> tplIds = jdbcTemplate.query(readmeTplSql, (rs, rn) -> UUID.fromString(rs.getString("id")));
            UUID tplId = tplIds.isEmpty() ? null : tplIds.get(0);

            String insCol = String.format(
                "INSERT INTO [%s].[collection] (id, name, description, default_template_id) VALUES (?, N'Default', N'Bộ sưu tập mặc định', ?)",
                schema
            );
            jdbcTemplate.update(insCol, UUID.randomUUID(), tplId);
        }
    }
}

