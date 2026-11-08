package com.livingdocs.workflow.dto;

import java.util.List;
import java.util.UUID;

/** Body của POST /api/v1/reviews/{id}/decisions (FR-WF-09/10/14/15). */
public record ReviewDecisionRequest(
        DecisionType decision,
        String reason,
        List<SectionComment> comments) {

    /** Comment theo từng mục, khớp bảng review_comment (line_number tùy chọn). */
    public record SectionComment(String content, Integer lineNumber) {
    }

    public enum DecisionType {
        APPROVE, REJECT, REQUEST_CHANGES, RETURN
    }

    public boolean hasValidContent(UUID taskId) {
        return taskId != null && decision != null;
    }
}
