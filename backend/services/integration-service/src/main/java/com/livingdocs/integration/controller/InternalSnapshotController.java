package com.livingdocs.integration.controller;

import com.livingdocs.integration.dto.SourceFileSnapshot;
import com.livingdocs.integration.config.TenantContext;
import com.livingdocs.integration.service.RepositoryManagementService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.UUID;

/** Internal code snapshot boundary. GitHub credentials never leave Integration. */
@RestController
@RequestMapping("/internal/v1/repositories")
public class InternalSnapshotController {
    private final RepositoryManagementService repositories;
    private final String internalToken;

    public InternalSnapshotController(RepositoryManagementService repositories,
                                      @Value("${livingdocs.internal.service-token:}") String internalToken) {
        this.repositories = repositories;
        this.internalToken = internalToken;
    }

    @GetMapping("/{repositoryId}/snapshot")
    @PreAuthorize("permitAll()")
    public List<SourceFileSnapshot> snapshot(@PathVariable UUID repositoryId,
            @RequestParam String commitSha,
            @RequestHeader("X-Tenant") String tenant,
            @RequestHeader(value = "X-LivingDocs-Internal-Token", required = false) String suppliedToken) {
        if (internalToken.isBlank() || suppliedToken == null || !MessageDigest.isEqual(
                internalToken.getBytes(StandardCharsets.UTF_8), suppliedToken.getBytes(StandardCharsets.UTF_8))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid internal service credential");
        }
        return TenantContext.runWith(tenant, () -> repositories.getCodeSnapshot(repositoryId, commitSha));
    }
}
