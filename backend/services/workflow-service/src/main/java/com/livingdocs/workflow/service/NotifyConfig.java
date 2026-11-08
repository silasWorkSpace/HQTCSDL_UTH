package com.livingdocs.workflow.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Chọn cổng thông báo theo cấu hình: Kafka bật → {@link KafkaNotifyPort},
 * chưa bật → {@link LoggingNotifyPort} (chỉ ghi log, dùng khi dev chưa dựng infra).
 */
@Configuration
public class NotifyConfig {

    @Bean
    @ConditionalOnProperty(name = "app.kafka.enabled", havingValue = "true")
    public com.livingdocs.common.events.EventPublisher eventPublisher(
            org.springframework.kafka.core.KafkaTemplate<String, String> kafkaTemplate) {
        return new com.livingdocs.common.events.EventPublisher(kafkaTemplate);
    }

    @Bean
    @ConditionalOnProperty(name = "app.kafka.enabled", havingValue = "true")
    public NotifyPort kafkaNotifyPort(com.livingdocs.common.events.EventPublisher publisher) {
        return new KafkaNotifyPort(publisher);
    }

    @Bean
    @ConditionalOnProperty(name = "app.kafka.enabled", havingValue = "false", matchIfMissing = true)
    public NotifyPort loggingNotifyPort() {
        return new LoggingNotifyPort();
    }
}
