package com.livingdocs.integration.dto;

import java.time.Instant;
import java.util.UUID;

public record ConnectionResponse(
        UUID id,
        String installationId,
        String accountLogin,
        String status,
        UUID connectedBy,
        Instant createdAt
) {}
