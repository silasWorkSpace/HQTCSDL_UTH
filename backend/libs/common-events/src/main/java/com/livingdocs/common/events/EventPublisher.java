package com.livingdocs.common.events;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;

/**
 * Producer dùng chung: gửi {@link EventsEnvelope} vào topic với key = tenant
 * (giữ thứ tự sự kiện trong cùng workspace) và correlationId vào header để
 * truy vết log (NFR-REL-02).
 */
public class EventPublisher {

    private static final Logger log = LoggerFactory.getLogger(EventPublisher.class);

    private final KafkaTemplate<String, String> kafkaTemplate;

    public EventPublisher(KafkaTemplate<String, String> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publish(String topic, EventsEnvelope envelope) {
        String json = EnvelopeCodec.serialize(envelope);
        kafkaTemplate.send(topic, envelope.tenant(), json)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Gui message that bai topic={} eventId={}", topic, envelope.eventId(), ex);
                    } else {
                        log.debug("Da gui message topic={} eventId={} partition={}",
                                topic, envelope.eventId(), result.getRecordMetadata().partition());
                    }
                });
    }
}
