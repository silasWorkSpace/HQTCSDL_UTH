package com.livingdocs.common.events;

/**
 * Loại sự kiện trong {@code payload.type} của envelope. Chỉ liệt kê những loại
 * nằm trong phạm vi giai đoạn 1 của dự án.
 */
public final class EventTypes {

    /** Bên gửi: ai-engine (ld.ai-results) — kèm cảnh báo drift và gợi ý cập nhật. */
    public static final String DRIFT_FOUND = "DRIFT_FOUND";

    /** Bên gửi: ai-engine (ld.ai-results) — bản nháp tài liệu do AI sinh. */
    public static final String DOC_DRAFT = "DOC_DRAFT";

    /** Bên gửi: mọi service (ld.notifications) — yêu cầu tạo thông báo in-app. */
    public static final String NOTIFICATION = "NOTIFICATION";

    /** Bên gửi: integration-service (ld.source-events) — webhook PR/commit đến. */
    public static final String SOURCE_EVENT_INGESTED = "SOURCE_EVENT_INGESTED";

    private EventTypes() {
    }
}
