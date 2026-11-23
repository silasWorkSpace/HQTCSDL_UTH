package com.livingdocs.notification;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * notification-service — cụm Huy.
 * NTF-01: tiêu thụ topic ld.notifications, ghi bảng notification (kênh in_app),
 * cung cấp API xem thông báo và đánh dấu đã đọc. Slack để giai đoạn 2 (NTF-02).
 */
@SpringBootApplication
public class NotificationServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(NotificationServiceApplication.class, args);
    }
}
