package com.livingdocs.governance.controller;

import com.livingdocs.governance.dto.CollectionResponse;
import com.livingdocs.governance.dto.CreateTemplateRequest;
import com.livingdocs.governance.dto.TemplateResponse;
import com.livingdocs.governance.service.TemplateService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/governance")
public class TemplateController {

    private final TemplateService templateService;

    public TemplateController(TemplateService templateService) {
        this.templateService = templateService;
    }

    @PostMapping("/templates")
    @PreAuthorize("hasAnyRole('Technical Lead', 'Manager', 'Administrator')")
    public ResponseEntity<TemplateResponse> createTemplate(@Valid @RequestBody CreateTemplateRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(templateService.createTemplate(req));
    }

    @GetMapping("/templates")
    @PreAuthorize("hasAnyRole('Developer', 'Staff', 'Manager', 'Technical Lead', 'Administrator')")
    public ResponseEntity<List<TemplateResponse>> listTemplates() {
        return ResponseEntity.ok(templateService.listTemplates());
    }

    @GetMapping("/templates/{id}")
    @PreAuthorize("hasAnyRole('Developer', 'Staff', 'Manager', 'Technical Lead', 'Administrator')")
    public ResponseEntity<TemplateResponse> getTemplateById(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(templateService.getTemplateById(id));
    }

    @PutMapping("/templates/{id}")
    @PreAuthorize("hasAnyRole('Technical Lead', 'Manager', 'Administrator')")
    public ResponseEntity<TemplateResponse> updateTemplate(
            @PathVariable("id") UUID id,
            @Valid @RequestBody CreateTemplateRequest req) {
        return ResponseEntity.ok(templateService.updateTemplate(id, req));
    }

    @DeleteMapping("/templates/{id}")
    @PreAuthorize("hasAnyRole('Technical Lead', 'Manager', 'Administrator')")
    public ResponseEntity<Void> archiveTemplate(@PathVariable("id") UUID id) {
        templateService.archiveTemplate(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/templates/{id}/clone")
    @PreAuthorize("hasAnyRole('Technical Lead', 'Manager', 'Administrator')")
    public ResponseEntity<TemplateResponse> cloneTemplate(
            @PathVariable("id") UUID id,
            @RequestParam(value = "newName", required = false) String newName) {
        return ResponseEntity.status(HttpStatus.CREATED).body(templateService.cloneTemplate(id, newName));
    }

    @PostMapping("/templates/seed")
    @PreAuthorize("hasAnyRole('Administrator', 'Technical Lead')")
    public ResponseEntity<Void> seedTemplates() {
        templateService.seedDefaultTemplatesAndCollection();
        return ResponseEntity.ok().build();
    }

    @GetMapping("/collections")
    @PreAuthorize("hasAnyRole('Developer', 'Staff', 'Manager', 'Technical Lead', 'Administrator')")
    public ResponseEntity<List<CollectionResponse>> listCollections() {
        return ResponseEntity.ok(templateService.listCollections());
    }
}

