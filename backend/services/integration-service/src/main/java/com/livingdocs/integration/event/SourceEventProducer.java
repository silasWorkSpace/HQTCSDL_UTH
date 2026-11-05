package com.livingdocs.integration.event;

import com.livingdocs.integration.config.TenantContext;
import com.livingdocs.integration.dto.EventEnvelope;
import com.livingdocs.integration.dto.SourceEventDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class SourceEventProducer {

    private static final Logger log = LoggerFactory.getLogger(SourceEventProducer.class);

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final String topic;

    public SourceEventProducer(
            @Value("#{null}") KafkaTemplate<String, Object> kafkaTemplate,
            @Value("${livingdocs.kafka.topics.source-events:ld.source-events}") String topic
    ) {
        this.kafkaTemplate = kafkaTemplate;
        this.topic = topic;
    }

    public void publishSourceEvent(SourceEventDto eventDto) {
        String tenant = TenantContext.getTenant();
        UUID correlationId = eventDto.correlationId() != null ? eventDto.correlationId() : UUID.randomUUID();

        EventEnvelope<SourceEventDto> envelope = EventEnvelope.of(
                "SOURCE_EVENT_RECEIVED",
                tenant,
                correlationId,
                eventDto
        );

        if (kafkaTemplate != null) {
            try {
                String partitionKey = eventDto.repositoryId() != null ? eventDto.repositoryId().toString() : tenant;
                kafkaTemplate.send(topic, partitionKey, envelope)
                        .whenComplete((result, ex) -> {
                            if (ex != null) {
                                log.error("Lỗi khi gửi sự kiện sang Kafka topic {}: {}", topic, ex.getMessage());
                            } else {
                                log.info("Đã gửi sự kiện sang Kafka topic {} [partition={}, offset={}]",
                                        topic, result.getRecordMetadata().partition(), result.getRecordMetadata().offset());
                            }
                        });
            } catch (Exception e) {
                log.warn("Không thể gửi sự kiện sang Kafka: {}. Bỏ qua trong môi trường dev.", e.getMessage());
            }
        } else {
            log.info("[MOCK KAFKA] Sự kiện đã được đóng gói và sẵn sàng đẩy sang topic {}: eventId={}, type={}",
                    topic, envelope.eventId(), envelope.type());
        }
    }
}
