package com.livingdocs.integration.dto;

import java.time.Instant;
import java.util.UUID;

public record AnalysisRunResponse(UUID id, UUID repositoryId, String triggerType,
        String baseCommitSha, String headCommitSha, String status, int filesIndexed,
        int entitiesIndexed, String errorMessage, Instant createdAt, Instant startedAt,
        Instant completedAt) {}
