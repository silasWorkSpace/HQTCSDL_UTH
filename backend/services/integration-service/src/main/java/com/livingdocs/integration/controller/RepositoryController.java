package com.livingdocs.integration.controller;

import com.livingdocs.integration.dto.AddRepositoryRequest;
import com.livingdocs.integration.dto.RepositoryDto;
import com.livingdocs.integration.dto.SourceEventDto;
import com.livingdocs.integration.dto.PublishDocumentRequest;
import com.livingdocs.integration.dto.PublishDocumentResponse;
import com.livingdocs.integration.dto.GitHubContentEntry;
import com.livingdocs.integration.dto.GitHubFileContent;
import com.livingdocs.integration.dto.CodeEntityDto;
import com.livingdocs.integration.service.RepositoryManagementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;

@RestController
@RequestMapping("/api/v1/repositories")
@PreAuthorize("hasAnyRole('Developer', 'Staff', 'Manager', 'TechLead', 'Administrator')")
@Tag(name = "Repository", description = "Quản lý kho mã nguồn trong Workspace")
public class RepositoryController {

    private final RepositoryManagementService repositoryService;

    public RepositoryController(RepositoryManagementService repositoryService) {
        this.repositoryService = repositoryService;
    }

    @PostMapping
    @Operation(summary = "Thêm một kho mã nguồn vào Workspace (GH-03)")
    public ResponseEntity<RepositoryDto> addRepository(@Valid @RequestBody AddRepositoryRequest request, @AuthenticationPrincipal Jwt jwt) {
        RepositoryDto dto = repositoryService.addRepository(request, UUID.fromString(jwt.getSubject()));
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping
    @Operation(summary = "Xem danh sách các kho mã nguồn trong Workspace (GH-05)")
    public ResponseEntity<List<RepositoryDto>> listRepositories() {
        return ResponseEntity.ok(repositoryService.listRepositories());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Xem chi tiết kho mã nguồn theo ID (GH-05)")
    public ResponseEntity<RepositoryDto> getRepository(@PathVariable UUID id) {
        return ResponseEntity.ok(repositoryService.getRepository(id));
    }

    @PostMapping("/{id}/analysis-runs")
    @PreAuthorize("hasAnyRole('Developer', 'TechLead', 'Administrator')")
    public ResponseEntity<java.util.Map<String, String>> startAnalysisRun(@PathVariable UUID id) {
        UUID runId = repositoryService.startAnalysisRun(id);
        return ResponseEntity.accepted().body(java.util.Map.of("runId", runId.toString(), "status", "queued"));
    }

    @GetMapping("/{id}/contents")
    @Operation(summary = "List files and folders from the connected GitHub repository")
    public ResponseEntity<List<GitHubContentEntry>> getRepositoryContents(
            @PathVariable UUID id, @RequestParam(required = false) String path) {
        return ResponseEntity.ok(repositoryService.getRepositoryContents(id, path));
    }

    @GetMapping("/{id}/file")
    @Operation(summary = "Read a UTF-8 text file from the connected GitHub repository")
    public ResponseEntity<GitHubFileContent> getRepositoryFile(
            @PathVariable UUID id, @RequestParam String path) {
        return ResponseEntity.ok(repositoryService.getRepositoryFile(id, path));
    }

    @GetMapping("/{id}/code-entities")
    public ResponseEntity<List<CodeEntityDto>> listCodeEntities(@PathVariable UUID id,
            @RequestParam String commitSha,
            @RequestParam(required = false) String pathPrefix,
            @RequestParam(required = false) String kind,
            @RequestParam(required = false) String q) {
        return ResponseEntity.ok(repositoryService.listCodeEntities(id, commitSha, pathPrefix, kind, q));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Ngắt kết nối kho mã nguồn bằng sp_disconnect_repository (GH-04)")
    public ResponseEntity<Void> disconnectRepository(@PathVariable UUID id) {
        repositoryService.disconnectRepository(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/events")
    @Operation(summary = "Xem danh sách sự kiện PR và commit đã nhận của kho mã nguồn (GH-07)")
    public ResponseEntity<List<SourceEventDto>> listEvents(@PathVariable UUID id) {
        return ResponseEntity.ok(repositoryService.listEvents(id));
    }

    @PostMapping("/{id}/publish")
    @PreAuthorize("hasAnyRole('Manager', 'Administrator')")
    @Operation(summary = "Publish approved document content to the connected GitHub branch")
    public ResponseEntity<PublishDocumentResponse> publishDocument(
            @PathVariable UUID id, @Valid @RequestBody PublishDocumentRequest request) {
        return ResponseEntity.ok(repositoryService.publishDocument(id, request));
    }
}
