package com.livingdocs.document.controller;

import com.livingdocs.common.security.TenantContext;
import com.livingdocs.document.dto.DocCodeLinkResponse;
import com.livingdocs.document.dto.InternalDocumentLinkDto;
import com.livingdocs.document.dto.InternalDocumentVersionDto;
import com.livingdocs.document.service.DocumentService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/internal/v1")
public class InternalDocumentController {

    private final DocumentService documentService;
    private final JdbcTemplate jdbcTemplate;
    private final String internalToken;

    public InternalDocumentController(DocumentService documentService,
                                      JdbcTemplate jdbcTemplate,
                                      @Value("${livingdocs.internal.service-token:}") String internalToken) {
        this.documentService = documentService;
        this.jdbcTemplate = jdbcTemplate;
        this.internalToken = internalToken;
    }

    private void verifyInternalToken(String suppliedToken) {
        if (internalToken == null || internalToken.isBlank() || suppliedToken == null
                || !MessageDigest.isEqual(internalToken.getBytes(StandardCharsets.UTF_8), suppliedToken.getBytes(StandardCharsets.UTF_8))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid internal service credential");
        }
    }

    @GetMapping("/documents/{documentId}/version")
    @PreAuthorize("permitAll()")
    public InternalDocumentVersionDto getDocumentVersion(
            @PathVariable UUID documentId,
            @RequestParam(value = "versionNo", required = false) Integer versionNo,
            @RequestHeader(value = "X-Tenant", defaultValue = "demo") String tenant,
            @RequestHeader(value = "X-LivingDocs-Internal-Token", required = false) String suppliedToken) {

        verifyInternalToken(suppliedToken);

        return TenantContext.runWith(tenant, () -> {
            String schema = TenantContext.getSchema();
            String sql;
            List<Object> args = new java.util.ArrayList<>();

            if (versionNo != null) {
                sql = String.format(
                    "SELECT dv.id, dv.document_id, dv.version_no, d.title, d.path_in_repo, d.doc_type, dv.status_at_version, " +
                    "dv.content, d.template_id, dv.template_version_id, dv.change_source, dv.created_at " +
                    "FROM [%s].[document_version] dv " +
                    "JOIN [%s].[document] d ON d.id = dv.document_id " +
                    "WHERE dv.document_id = ? AND dv.version_no = ?",
                    schema, schema
                );
                args.add(documentId);
                args.add(versionNo);
            } else {
                sql = String.format(
                    "SELECT dv.id, dv.document_id, dv.version_no, d.title, d.path_in_repo, d.doc_type, dv.status_at_version, " +
                    "dv.content, d.template_id, dv.template_version_id, dv.change_source, dv.created_at " +
                    "FROM [%s].[document] d " +
                    "JOIN [%s].[document_version] dv ON dv.id = d.current_version_id " +
                    "WHERE d.id = ?",
                    schema, schema
                );
                args.add(documentId);
            }

            List<InternalDocumentVersionDto> list = jdbcTemplate.query(sql, (rs, rn) -> {
                String tplStr = rs.getString("template_id");
                String tvStr = null;
                try {
                    tvStr = rs.getString("template_version_id");
                } catch (Exception ignored) {}

                return new InternalDocumentVersionDto(
                    UUID.fromString(rs.getString("id")),
                    UUID.fromString(rs.getString("document_id")),
                    rs.getInt("version_no"),
                    rs.getString("title"),
                    rs.getString("path_in_repo"),
                    rs.getString("doc_type"),
                    rs.getString("status_at_version"),
                    rs.getString("content"),
                    tplStr != null ? UUID.fromString(tplStr) : null,
                    tvStr != null ? UUID.fromString(tvStr) : null,
                    rs.getString("change_source"),
                    rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toInstant() : null
                );
            }, args.toArray());

            if (list.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document or version not found");
            }
            return list.get(0);
        });
    }

    @GetMapping("/documents/{documentId}/links")
    @PreAuthorize("permitAll()")
    public List<DocCodeLinkResponse> getDocumentLinks(
            @PathVariable UUID documentId,
            @RequestHeader(value = "X-Tenant", defaultValue = "demo") String tenant,
            @RequestHeader(value = "X-LivingDocs-Internal-Token", required = false) String suppliedToken) {

        verifyInternalToken(suppliedToken);

        return TenantContext.runWith(tenant, () -> documentService.getDocumentLinks(documentId));
    }

    @GetMapping("/repositories/{repositoryId}/document-links")
    @PreAuthorize("permitAll()")
    public List<InternalDocumentLinkDto> getRepositoryDocumentLinks(
            @PathVariable UUID repositoryId,
            @RequestHeader(value = "X-Tenant", defaultValue = "demo") String tenant,
            @RequestHeader(value = "X-LivingDocs-Internal-Token", required = false) String suppliedToken) {

        verifyInternalToken(suppliedToken);

        return TenantContext.runWith(tenant, () -> {
            String schema = TenantContext.getSchema();
            String sql = String.format(
                "SELECT l.id, l.document_id, d.title, d.path_in_repo, l.link_type, l.code_entity_id, l.external_ref " +
                "FROM [%s].[doc_code_link] l " +
                "JOIN [%s].[document] d ON d.id = l.document_id " +
                "WHERE d.repository_id = ? " +
                "ORDER BY d.title ASC, l.created_at ASC",
                schema, schema
            );

            return jdbcTemplate.query(sql, (rs, rn) -> {
                String ceId = rs.getString("code_entity_id");
                return new InternalDocumentLinkDto(
                    UUID.fromString(rs.getString("id")),
                    UUID.fromString(rs.getString("document_id")),
                    rs.getString("title"),
                    rs.getString("path_in_repo"),
                    rs.getString("link_type"),
                    ceId != null ? UUID.fromString(ceId) : null,
                    rs.getString("external_ref")
                );
            }, repositoryId);
        });
    }
}
