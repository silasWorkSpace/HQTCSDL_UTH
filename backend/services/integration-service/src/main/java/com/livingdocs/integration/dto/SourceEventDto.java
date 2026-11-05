package com.livingdocs.integration.dto;

import java.time.Instant;
import java.util.UUID;

public record SourceEventDto(
        UUID id,
        UUID repositoryId,
        String eventType,
        String githubRef,
        String state,
        String deliveryId,
        String diffDigest,
        boolean createdByLivingDocs,
        UUID correlationId,
        Instant receivedAt,
        String payload
) {}
