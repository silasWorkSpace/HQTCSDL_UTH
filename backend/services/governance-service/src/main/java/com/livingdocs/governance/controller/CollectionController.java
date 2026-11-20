package com.livingdocs.governance.controller;

import com.livingdocs.governance.dto.CollectionResponse;
import com.livingdocs.governance.dto.CreateCollectionRequest;
import com.livingdocs.governance.dto.UpdateCollectionRequest;
import com.livingdocs.governance.service.CollectionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/governance/collections")
public class CollectionController {

    private final CollectionService collectionService;

    public CollectionController(CollectionService collectionService) {
        this.collectionService = collectionService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('Developer', 'Staff', 'Manager', 'Technical Lead', 'Administrator')")
    public ResponseEntity<List<CollectionResponse>> listCollections() {
        return ResponseEntity.ok(collectionService.listCollections());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('Developer', 'Staff', 'Manager', 'Technical Lead', 'Administrator')")
    public ResponseEntity<CollectionResponse> getCollectionById(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(collectionService.getCollectionById(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('Technical Lead', 'Manager', 'Administrator')")
    public ResponseEntity<CollectionResponse> createCollection(@Valid @RequestBody CreateCollectionRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(collectionService.createCollection(req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('Technical Lead', 'Manager', 'Administrator')")
    public ResponseEntity<CollectionResponse> updateCollection(
            @PathVariable("id") UUID id,
            @Valid @RequestBody UpdateCollectionRequest req) {
        return ResponseEntity.ok(collectionService.updateCollection(id, req));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('Technical Lead', 'Manager', 'Administrator')")
    public ResponseEntity<Void> deleteCollection(@PathVariable("id") UUID id) {
        collectionService.deleteCollection(id);
        return ResponseEntity.noContent().build();
    }
}
