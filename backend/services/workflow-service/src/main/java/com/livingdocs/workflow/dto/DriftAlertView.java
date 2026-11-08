package com.livingdocs.workflow.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Dòng trong danh sách drift_alert (DR-12: lịch sử drift và trạng thái xử lý). */
public record DriftAlertView(
        UUID id,
        UUID documentId,
        UUID sourceEventId,
        String driftType,
        String severity,
        String evidence,
        String handlingStatus,
        OffsetDateTime createdAt) {
}
