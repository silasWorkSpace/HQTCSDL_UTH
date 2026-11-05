package com.livingdocs.integration.controller;

import com.livingdocs.integration.dto.AddRepositoryRequest;
import com.livingdocs.integration.dto.RepositoryDto;
import com.livingdocs.integration.dto.SourceEventDto;
import com.livingdocs.integration.service.RepositoryManagementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/repositories")
@Tag(name = "Repository", description = "Quản lý kho mã nguồn trong Workspace")
public class RepositoryController {

    private final RepositoryManagementService repositoryService;

    public RepositoryController(RepositoryManagementService repositoryService) {
        this.repositoryService = repositoryService;
    }

    @PostMapping
    @Operation(summary = "Thêm một kho mã nguồn vào Workspace (GH-03)")
    public ResponseEntity<RepositoryDto> addRepository(@Valid @RequestBody AddRepositoryRequest request) {
        RepositoryDto dto = repositoryService.addRepository(request);
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
}
