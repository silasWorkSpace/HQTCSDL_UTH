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
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/integrations/github/connections")
@Tag(name = "GitHub Connection", description = "Quản lý kết nối GitHub App của Workspace")
public class GitHubConnectionController {

    private final GitHubConnectionService connectionService;

    public GitHubConnectionController(GitHubConnectionService connectionService) {
        this.connectionService = connectionService;
    }

    @PostMapping
    @Operation(summary = "Tạo kết nối GitHub App mới (GH-02)")
    public ResponseEntity<ConnectionResponse> createConnection(@Valid @RequestBody ConnectionRequest request) {
        ConnectionResponse response = connectionService.createConnection(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Xem thông tin kết nối theo ID")
    public ResponseEntity<ConnectionResponse> getConnection(@PathVariable UUID id) {
        return ResponseEntity.ok(connectionService.getConnection(id));
    }

    @GetMapping("/{id}/available-repos")
    @Operation(summary = "Liệt kê kho mã nguồn mà GitHub App được cấp quyền truy cập (GH-02, GH-03)")
    public ResponseEntity<List<Map<String, Object>>> getAvailableRepos(@PathVariable UUID id) {
        return ResponseEntity.ok(connectionService.getAvailableRepositories(id));
    }
}
