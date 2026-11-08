package com.livingdocs.notification.event;

import com.livingdocs.common.events.EnvelopeCodec;
import com.livingdocs.common.events.EventTypes;
import com.livingdocs.common.events.Topics;
import com.livingdocs.notification.service.NotificationService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Consumer topic ld.notifications: mọi service phát NOTIFICATION đến đây,
 * service ghi bảng notification kênh in_app (NTF-01).
 */
@Component
@ConditionalOnProperty(name = "app.kafka.enabled", havingValue = "true")
public class NotificationsConsumer {

    private static final Logger log = LoggerFactory.getLogger(NotificationsConsumer.class);

    private final NotificationService notificationService;

    public NotificationsConsumer(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @KafkaListener(topics = Topics.NOTIFICATIONS, groupId = "notification-service")
    public void onMessage(ConsumerRecord<String, String> record) {
        try {
            var envelope = EnvelopeCodec.deserialize(record.value());
            if (!EventTypes.NOTIFICATION.equals(envelope.type())) {
                return;
            }
            notificationService.recordFromKafka(envelope.tenant(), envelope.eventId(),
                    envelope.correlationId(), envelope.payload());
        } catch (Exception e) {
            log.error("Tieu thu ld.notifications that bai offset={}", record.offset(), e);
        }
    }
}
