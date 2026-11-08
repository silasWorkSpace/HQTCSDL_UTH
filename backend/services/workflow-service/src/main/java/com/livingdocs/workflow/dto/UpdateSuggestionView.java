package com.livingdocs.workflow.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Dòng trong hàng đợi gợi ý cập nhật của Developer (AUTO-02, DR-08). */
public record UpdateSuggestionView(
        UUID id,
        UUID documentId,
        String documentTitle,
        UUID driftAlertId,
        String origin,
        String content,
        BigDecimal confidenceScore,
        String evidence,
        String status,
        String dismissReason,
        OffsetDateTime createdAt) {
}
