package com.livingdocs.integration.controller;

import com.livingdocs.integration.dto.ConnectionRequest;
import com.livingdocs.integration.dto.ConnectionResponse;
import com.livingdocs.integration.service.GitHubConnectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;

@RestController
@RequestMapping("/api/v1/integrations/github/connections")
@PreAuthorize("hasAnyRole('Developer', 'Staff', 'Manager', 'Technical Lead', 'Administrator')")
@Tag(name = "GitHub Connection", description = "Quản lý kết nối GitHub App của Workspace")
public class GitHubConnectionController {

    private final GitHubConnectionService connectionService;

    public GitHubConnectionController(GitHubConnectionService connectionService) {
        this.connectionService = connectionService;
    }

    @PostMapping
    @Operation(summary = "Tạo kết nối GitHub App mới (GH-02)")
    public ResponseEntity<ConnectionResponse> createConnection(@Valid @RequestBody ConnectionRequest request, @AuthenticationPrincipal Jwt jwt) {
        ConnectionRequest authenticated = new ConnectionRequest(request.installationId(), request.accountLogin(), UUID.fromString(jwt.getSubject()));
        ConnectionResponse response = connectionService.createConnection(authenticated);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/app-installation")
    public ResponseEntity<ConnectionResponse> connectAppInstallation(
            @RequestBody Map<String, String> request, @AuthenticationPrincipal Jwt jwt) {
        String installationId = request == null ? null : request.get("installationId");
        ConnectionResponse response = connectionService.createConnection(new ConnectionRequest(
                installationId, null, UUID.fromString(jwt.getSubject())));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/oauth")
    public ResponseEntity<ConnectionResponse> createOAuthConnection(
            @RequestHeader("X-GitHub-Token") String githubToken, @AuthenticationPrincipal Jwt jwt) {
        ConnectionResponse response = connectionService.createOAuthConnection(githubToken, UUID.fromString(jwt.getSubject()));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Xem thông tin kết nối theo ID")
    public ResponseEntity<ConnectionResponse> getConnection(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(connectionService.getConnection(id, UUID.fromString(jwt.getSubject())));
    }

    @GetMapping("/{id}/available-repos")
    @Operation(summary = "Liệt kê kho mã nguồn mà GitHub App được cấp quyền truy cập (GH-02, GH-03)")
    public ResponseEntity<List<Map<String, Object>>> getAvailableRepos(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(connectionService.getAvailableRepositories(id, UUID.fromString(jwt.getSubject())));
    }
}
