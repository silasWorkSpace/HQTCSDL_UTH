package com.livingdocs.common.events;

/** Gia tri truong "type" trong EventEnvelope. */
public final class EventTypes {
    // ld.source-events
    public static final String PR_OPENED = "PR_OPENED";
    public static final String PR_UPDATED = "PR_UPDATED";
    public static final String PR_MERGED = "PR_MERGED";
    public static final String PR_CLOSED = "PR_CLOSED";
    public static final String PUSH = "PUSH";
    // ld.ai-jobs
    public static final String GENERATE_DOC = "GENERATE_DOC";
    // ld.ai-results
    public static final String DOC_DRAFT = "DOC_DRAFT";
    public static final String DRIFT_FOUND = "DRIFT_FOUND";
    // ld.notifications
    public static final String NOTIFY = "NOTIFY";

    private EventTypes() {
    }
}
