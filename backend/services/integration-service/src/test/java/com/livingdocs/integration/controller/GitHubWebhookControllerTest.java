package com.livingdocs.integration.controller;

import com.livingdocs.integration.service.WebhookProcessingService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(value = GitHubWebhookController.class, properties = "JWT_SECRET=test-only-signing-key-with-at-least-32-characters")
class GitHubWebhookControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private WebhookProcessingService webhookService;

    @Test
    @DisplayName("NFR-SEC-06: Thiếu header X-Hub-Signature-256 phải trả về HTTP 401 Unauthorized")
    void testMissingSignatureReturns401() throws Exception {
        mockMvc.perform(post("/api/v1/webhooks/github")
                        .header("X-Tenant", "test_tenant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"action\":\"opened\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Thiếu header chữ ký X-Hub-Signature-256"));
    }

    @Test
    @DisplayName("NFR-PERF-06: Chữ ký hợp lệ tiếp nhận và trả về HTTP 202 Accepted")
    void testValidSignatureReturns202() throws Exception {
        UUID eventId = UUID.randomUUID();
        Mockito.when(webhookService.processWebhook(anyString(), anyString(), anyString(), anyString()))
                .thenReturn(new WebhookProcessingService.WebhookResult(
                        eventId, false, false, "Tiếp nhận sự kiện thành công."
                ));

        mockMvc.perform(post("/api/v1/webhooks/github")
                        .header("X-Tenant", "test_tenant")
                        .header("X-Hub-Signature-256", "sha256=abcdef1234567890")
                        .header("X-GitHub-Event", "pull_request")
                        .header("X-GitHub-Delivery", "delivery-guid-123")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"action\":\"opened\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("accepted"))
                .andExpect(jsonPath("$.eventId").value(eventId.toString()))
                .andExpect(jsonPath("$.isDuplicate").value(false));
    }
}
