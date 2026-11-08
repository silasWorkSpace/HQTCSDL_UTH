package com.livingdocs.common.events;

/**
 * Loại sự kiện trong {@code payload.type} hoặc {@code type} của envelope.
 * Bao gồm các sự kiện trong phạm vi giai đoạn 1 của dự án.
 */
public final class EventTypes {

    // ld.source-events: webhook PR/commit đến (integration-service gửi, ai-engine nhận)
    public static final String PR_OPENED = "PR_OPENED";
    public static final String PR_UPDATED = "PR_UPDATED";
    public static final String PR_MERGED = "PR_MERGED";
    public static final String PR_CLOSED = "PR_CLOSED";
    public static final String PUSH = "PUSH";
    public static final String SOURCE_EVENT_INGESTED = "SOURCE_EVENT_INGESTED";

    // ld.ai-jobs: việc AI chủ động (document-service gửi, ai-engine nhận)
    public static final String GENERATE_DOC = "GENERATE_DOC";

    // ld.ai-results: kết quả AI (ai-engine gửi, document-service / workflow-service nhận)
    public static final String DOC_DRAFT = "DOC_DRAFT";
    public static final String DRIFT_FOUND = "DRIFT_FOUND";

    // ld.notifications: yêu cầu tạo thông báo in-app (mọi service gửi, notification-service nhận)
    public static final String NOTIFY = "NOTIFY";
    public static final String NOTIFICATION = "NOTIFICATION";

    private EventTypes() {
    }
}
