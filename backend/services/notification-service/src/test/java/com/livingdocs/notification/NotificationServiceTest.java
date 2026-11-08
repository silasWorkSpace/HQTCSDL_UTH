package com.livingdocs.notification;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.livingdocs.notification.service.NotificationRepository;
import com.livingdocs.notification.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** NTF-01: ghi thông báo từ Kafka, xem danh sách, đánh dấu đã đọc (chỉ người nhận). */
class NotificationServiceTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private NotificationRepository repo;
    private NotificationService service;

    private final UUID user = UUID.randomUUID();
    private final UUID other = UUID.randomUUID();
    private final UUID eventId = UUID.randomUUID();
    private final UUID correlationId = UUID.randomUUID();
    private final UUID notificationId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        repo = mock(NotificationRepository.class);
        service = new NotificationService(repo);
    }

    @Test
    void recordFromKafkaStoresInAppNotificationWithEventTypeAndMessage() throws Exception {
        String payload = "{\"recipientUserId\":\"" + user + "\",\"eventType\":\"DOC_SUBMITTED\","
                + "\"message\":\"Tài liệu đang chờ Staff duyệt\"}";

        service.recordFromKafka("acme", eventId, correlationId, payload);

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(repo).insert(eq("acme"), eq(user), eq("in_app"), eq("DOC_SUBMITTED"),
                body.capture(), eq(correlationId));
        JsonNode stored = MAPPER.readTree(body.getValue());
        assertThat(stored.path("message").asText()).isEqualTo("Tài liệu đang chờ Staff duyệt");
    }

    @Test
    void recordFromKafkaKeepsExtraPayloadFields() throws Exception {
        String payload = "{\"recipientUserId\":\"" + user + "\",\"eventType\":\"DRIFT_FOUND\","
                + "\"message\":\"m\",\"payload\":{\"documentId\":\"d1\"}}";

        service.recordFromKafka("acme", eventId, correlationId, payload);

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(repo).insert(eq("acme"), eq(user), eq("in_app"), eq("DRIFT_FOUND"),
                body.capture(), any());
        JsonNode stored = MAPPER.readTree(body.getValue());
        assertThat(stored.path("documentId").asText()).isEqualTo("d1");
        assertThat(stored.path("message").asText()).isEqualTo("m");
    }

    @Test
    void recordFromKafkaDefaultsEventTypeToGeneral() {
        String payload = "{\"recipientUserId\":\"" + user + "\",\"message\":\"m\"}";

        service.recordFromKafka("acme", eventId, correlationId, payload);

        verify(repo).insert(eq("acme"), eq(user), eq("in_app"), eq("GENERAL"), anyString(), any());
    }

    @Test
    void recordFromKafkaIgnoresMalformedMessageWithoutThrowing() {
        service.recordFromKafka("acme", eventId, correlationId, "not json");
        service.recordFromKafka("acme", eventId, correlationId, "{\"message\":\"no recipient\"}");

        verify(repo, never()).insert(any(), any(), any(), any(), any(), any());
    }

    @Test
    void myNotificationsDelegatesWithUnreadFilter() {
        when(repo.listForUser("acme", user, true)).thenReturn(List.of(Map.of("id", "n1")));

        assertThat(service.myNotifications("acme", user, true)).hasSize(1);
        verify(repo).listForUser("acme", user, true);
    }

    @Test
    void markReadByRecipientUpdatesNotification() {
        when(repo.findRecipient("acme", notificationId)).thenReturn(Optional.of(user));

        service.markRead("acme", notificationId, user);

        verify(repo).markRead("acme", notificationId);
    }

    @Test
    void markReadByAnotherUserIsForbidden() {
        when(repo.findRecipient("acme", notificationId)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.markRead("acme", notificationId, other))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
        verify(repo, never()).markRead(any(), any());
    }

    @Test
    void markReadOfUnknownNotificationIsNotFound() {
        when(repo.findRecipient("acme", notificationId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.markRead("acme", notificationId, user))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }
}
