package com.livingdocs.workflow;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * workflow-service — cụm Duyệt, drift, thông báo (Huy).
 * Nhiệm vụ: GEN-10, WF-01/09/10/12/14/15/16/20/22/24, DR-02/03/05/06/08/09/12,
 * AUTO-02/07/08/09, NTF-01 (phát thông báo qua topic ld.notifications).
 *
 * <p>Kafka: listener DRIFT_FOUND chỉ đăng ký khi app.kafka.enabled=true;
 * KafkaTemplate luôn có nhưng chỉ kết nối khi thật sự gửi (dev một mình vẫn
 * chạy được chưa cần infra Kafka).
 */
@SpringBootApplication
public class WorkflowServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(WorkflowServiceApplication.class, args);
    }
}
