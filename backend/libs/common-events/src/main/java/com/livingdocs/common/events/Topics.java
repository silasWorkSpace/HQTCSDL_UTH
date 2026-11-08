package com.livingdocs.common.events;

/**
 * Hằng số tên topic Kafka dùng chung (quy ước kiến trúc hệ thống).
 * Không cho phép mọi service tự đặt tên topic ngoài danh sách này.
 */
public final class Topics {

    /** PR mở, cập nhật, merge, push commit — integration-service gửi, ai-engine nhận. */
    public static final String SOURCE_EVENTS = "ld.source-events";

    /** Việc AI chủ động (GENERATE_DOC...). document-service gửi, ai-engine nhận. */
    public static final String AI_JOBS = "ld.ai-jobs";

    /** Kết quả AI: DOC_DRAFT, DRIFT_FOUND. ai-engine gửi, document/workflow nhận. */
    public static final String AI_RESULTS = "ld.ai-results";

    /** Thông báo cần gửi người dùng. Mọi service gửi, notification-service nhận. */
    public static final String NOTIFICATIONS = "ld.notifications";

    /** Job lỗi quá 3 lần retry (NFR-AVAIL-03), xem thủ công. */
    public static final String AI_JOBS_DLQ = "ld.ai-jobs.dlq";

    private Topics() {
    }
}
