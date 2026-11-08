package com.livingdocs.common.events;

/** Ten cac topic Kafka dung chung. Khong tu dat ten topic o noi khac. */
public final class Topics {
    /** integration-service -> ai-engine: PR/commit tu webhook GitHub. */
    public static final String SOURCE_EVENTS = "ld.source-events";
    /** document-service -> ai-engine: yeu cau viec AI chu dong (vi du GENERATE_DOC). */
    public static final String AI_JOBS = "ld.ai-jobs";
    /** ai-engine -> document-service, workflow-service: ket qua (DOC_DRAFT, DRIFT_FOUND). */
    public static final String AI_RESULTS = "ld.ai-results";
    /** moi service -> notification-service. */
    public static final String NOTIFICATIONS = "ld.notifications";
    /** Job loi qua 3 lan (NFR-AVAIL-03). */
    public static final String AI_JOBS_DLQ = "ld.ai-jobs.dlq";

    private Topics() {
    }
}
