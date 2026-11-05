package com.livingdocs.document.controller;

import com.livingdocs.document.dto.*;
import com.livingdocs.document.service.DocumentService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/documents")
public class DocumentController {

    private final DocumentService documentService;

    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    @GetMapping
    public ResponseEntity<List<DocumentResponse>> listDocuments(
            @RequestParam(value = "repositoryId", required = false) UUID repositoryId,
            @RequestParam(value = "docStatus", required = false) String docStatus,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        return ResponseEntity.ok(documentService.listDocuments(repositoryId, docStatus, page, size));
    }

    @GetMapping("/{id}")
    public ResponseEntity<DocumentResponse> getDocumentById(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(documentService.getDocumentById(id));
    }

    @PutMapping("/{id}/draft")
    @PreAuthorize("hasAnyRole('Developer', 'Staff', 'Manager', 'Technical Lead', 'Administrator')")
    public ResponseEntity<DocumentVersionResponse> updateDraft(
            @PathVariable("id") UUID id,
            @Valid @RequestBody UpdateDraftRequest req) {
        return ResponseEntity.ok(documentService.updateDraft(id, req));
    }

    @GetMapping("/{id}/versions")
    public ResponseEntity<List<DocumentVersionResponse>> getVersions(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(documentService.getDocumentVersions(id));
    }

    @GetMapping("/{id}/versions/{n}")
    public ResponseEntity<DocumentVersionResponse> getVersion(
            @PathVariable("id") UUID id,
            @PathVariable("n") int n) {
        return ResponseEntity.ok(documentService.getDocumentVersion(id, n));
    }

    @GetMapping("/{id}/diff")
    public ResponseEntity<DiffResponse> getDiff(
            @PathVariable("id") UUID id,
            @RequestParam("from") int from,
            @RequestParam("to") int to) {
        return ResponseEntity.ok(documentService.calculateDiff(id, from, to));
    }

    @PostMapping("/{id}/rollback")
    @PreAuthorize("hasAnyRole('Developer', 'Manager', 'Technical Lead', 'Administrator')")
    public ResponseEntity<DocumentVersionResponse> rollback(
            @PathVariable("id") UUID id,
            @Valid @RequestBody RollbackRequest req) {
        return ResponseEntity.ok(documentService.rollbackDocument(id, req));
    }

    @GetMapping("/{id}/integrity")
    public ResponseEntity<IntegrityVerificationResponse> verifyIntegrity(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(documentService.verifyIntegrity(id));
    }

    @GetMapping("/{id}/links")
    public ResponseEntity<List<DocCodeLinkResponse>> getLinks(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(documentService.getDocumentLinks(id));
    }

    @PostMapping("/generate")
    @PreAuthorize("hasAnyRole('Developer', 'Staff', 'Manager', 'Technical Lead', 'Administrator')")
    public ResponseEntity<Map<String, String>> generateDocument(@Valid @RequestBody GenerateDocRequest req) {
        String jobId = documentService.requestGenerateDocument(req);
        return ResponseEntity.accepted().body(Map.of(
            "jobId", jobId,
            "status", "QUEUED",
            "message", "AI document generation task has been queued."
        ));
    }
}

