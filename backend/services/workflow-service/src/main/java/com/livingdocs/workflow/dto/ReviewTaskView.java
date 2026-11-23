package com.livingdocs.workflow.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Đối tượng trả ra của các API review. Bản ghi thô giữ nguyên tên cột DB. */
public record ReviewTaskView(
        UUID id,
        UUID documentId,
        String documentTitle,
        UUID documentVersionId,
        String level,
        UUID submitterId,
        String submitterName,
        UUID assigneeId,
        String status,
        String docStatus,
        OffsetDateTime createdAt) {
}
