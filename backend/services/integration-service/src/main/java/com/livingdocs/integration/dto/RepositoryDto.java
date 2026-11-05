package com.livingdocs.integration.dto;

import java.time.Instant;
import java.util.UUID;

public record RepositoryDto(
        UUID id,
        UUID connectionId,
        Long githubRepoId,
        String fullName,
        String defaultBranch,
        String connectionStatus,
        Instant lastSyncedAt,
        Instant createdAt
) {}
