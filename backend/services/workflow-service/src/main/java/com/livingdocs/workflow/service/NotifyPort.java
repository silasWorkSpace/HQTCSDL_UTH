package com.livingdocs.workflow.service;

import com.livingdocs.common.events.EventPublisher;
import com.livingdocs.common.events.EventTypes;
import com.livingdocs.common.events.EventsEnvelope;
import com.livingdocs.common.events.Topics;

import java.util.UUID;

/**
 * Cổng phát thông báo. Kafka bật → đẩy topic ld.notifications cho
 * notification-service; Kafka tắt (dev chưa dựng infra) → chỉ ghi log.
 */
public interface NotifyPort {

    void notifyUser(String tenant, UUID recipientUserId, String eventType, String message,
                    String payloadJson);
}
