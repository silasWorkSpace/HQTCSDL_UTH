package com.livingdocs.document.dto;

import java.time.Instant;
import java.util.UUID;

public record AiJobResponse(UUID jobId, String jobType, String status, int retryCount,
        boolean inDlq, Instant nextRetryAt, String errorMessage, UUID resultDocumentId,
        Instant createdAt, Instant updatedAt) {}
