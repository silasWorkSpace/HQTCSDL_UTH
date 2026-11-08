package com.livingdocs.workflow.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.UUID;

/**
 * Dự phòng khi Kafka chưa dựng (tuần này docker-compose mới có mssql): thông báo
 * chỉ ghi log. Khi Người 1 thêm Kafka vào compose và bật KAFKA_ENABLED=true,
 * NotifyConfig sẽ chọn {@link KafkaNotifyPort} thay thế.
 */
public class LoggingNotifyPort implements NotifyPort {

    private static final Logger log = LoggerFactory.getLogger(LoggingNotifyPort.class);

    @Override
    public void notifyUser(String tenant, UUID recipientUserId, String eventType, String message,
                           String payloadJson) {
        log.info("[Kafka OFF] Thong bao cho user {} tenant {}: {}",
                recipientUserId, tenant, message);
    }
}
