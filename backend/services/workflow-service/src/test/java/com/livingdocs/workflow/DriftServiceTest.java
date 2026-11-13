package com.livingdocs.workflow;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.livingdocs.workflow.repo.WorkflowRepository;
import com.livingdocs.workflow.security.AuthContext;
import com.livingdocs.workflow.service.AuditService;
import com.livingdocs.workflow.service.DriftService;
import com.livingdocs.workflow.service.LoggingNotifyPort;
import com.livingdocs.workflow.service.ReviewService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Test consumer DRIFT_FOUND và Accept/Dismiss gợi ý (DR-12, AUTO-02/07/08/09). */
class DriftServiceTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private WorkflowRepository repo;
    private DriftService driftService;
    private ReviewService reviewService;

    private final UUID docId = UUID.randomUUID();
    private final UUID sourceEventId = UUID.randomUUID();
    private final UUID devId = UUID.randomUUID();
    private final UUID suggestionId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        repo = mock(WorkflowRepository.class);
        reviewService = mock(ReviewService.class);
        AuditService audit = mock(AuditService.class);
        driftService = new DriftService(repo, audit, new LoggingNotifyPort(), reviewService);

        when(repo.findDocument(anyString(), eq(docId))).thenReturn(Optional.of(
                new WorkflowRepository.DocumentRow(docId, "API Login", "DRAFT", UUID.randomUUID(),
                        devId, null)));
        when(repo.listDriftAlerts(anyString(), eq(docId))).thenReturn(List.of());
    }

    @AfterEach
    void tearDown() {
        AuthContext.clear();
    }

    @Test
    void driftFoundCreatesAlertAndSuggestion() throws Exception {
        String payload = """
                {"documentId":"%s","sourceEventId":"%s",
                 "findings":[{"driftType":"Referential","severity":"High",
                   "evidence":{"entity":"UserService"},
                   "suggestion":{"content":"Cap nhat tham chieu","confidence":0.85}}]}
                """.formatted(docId, sourceEventId);

        driftService.onDriftFound("acme", MAPPER.readTree(payload));

        verify(repo).createDriftAlert(eq("acme"), eq(sourceEventId), eq(docId),
                eq("Referential"), eq("High"), anyString(), eq("Open"));
        verify(repo).createUpdateSuggestion(eq("acme"), eq(docId), any(), eq("drift"),
                eq("Cap nhat tham chieu"), any(), anyString());
        // FR-DR-17: hợp nhất gợi ý cũ, giữ bản mới
        verify(repo).supersedeStaleSuggestions(eq("acme"), eq(docId), any());
    }

    @Test
    void duplicateAlertIsSkipped() throws Exception {
        // Alert cùng (source_event, document, type) đã tồn tại → idempotent (FR-DR-13)
        when(repo.listDriftAlerts(anyString(), eq(docId))).thenReturn(List.of(
                Map.of("source_event_id", sourceEventId, "drift_type", "Referential")));
        String payload = """
                {"documentId":"%s","sourceEventId":"%s",
                 "findings":[{"driftType":"Referential","severity":"High","evidence":{}}]}
                """.formatted(docId, sourceEventId);

        driftService.onDriftFound("acme", MAPPER.readTree(payload));

        verify(repo, never()).createDriftAlert(anyString(), any(), any(), any(), any(), any(),
                any());
    }

    @Test
    void duplicateAlertDoesNotCreateSuggestionAgain() throws Exception {
        when(repo.listDriftAlerts(anyString(), eq(docId))).thenReturn(List.of(
                Map.of("source_event_id", sourceEventId, "drift_type", "Referential")));
        String payload = """
                {"documentId":"%s","sourceEventId":"%s",
                 "findings":[{"driftType":"Referential","severity":"High","evidence":{},
                   "suggestion":{"content":"Cap nhat tham chieu","confidence":0.85}}]}
                """.formatted(docId, sourceEventId);

        driftService.onDriftFound("acme", MAPPER.readTree(payload));

        verify(repo, never()).createUpdateSuggestion(anyString(), any(), any(), any(), any(),
                any(), any());
    }

    @Test
    void acceptPutsSuggestionIntoReviewFlow() {
        login();
        when(repo.findSuggestion(anyString(), eq(suggestionId))).thenReturn(Optional.of(
                new WorkflowRepository.SuggestionRow(suggestionId, docId, "Gợi ý nội dung",
                        "Pending Developer Action", "drift")));

        driftService.handleSuggestion("acme", suggestionId, "accept", null, null);

        verify(repo).appendDocumentVersion(eq("acme"), eq(docId), eq("Gợi ý nội dung"),
                eq("Developer"), eq(devId), eq("DRIFT_SUGGESTION"), anyString());
        verify(repo).updateSuggestionStatus("acme", suggestionId, "Accepted", null);
        verify(repo).updateDriftAlertStatusBySuggestion("acme", suggestionId, "Accepted");
        verify(reviewService).submit(eq("acme"), eq(docId), any());
    }

    @Test
    void dismissWithReasonMarksAlertDismissed() {
        login();
        when(repo.findSuggestion(anyString(), eq(suggestionId))).thenReturn(Optional.of(
                new WorkflowRepository.SuggestionRow(suggestionId, docId, "nội dung",
                        "Pending Developer Action", "drift")));

        driftService.handleSuggestion("acme", suggestionId, "dismiss", null, "Gợi ý sai");

        verify(repo).updateSuggestionStatus("acme", suggestionId, "Dismissed", "Gợi ý sai");
        verify(repo).updateDriftAlertStatusBySuggestion("acme", suggestionId, "Dismissed");
    }

    @Test
    void dismissWithoutReasonIsRejected() {
        login();
        when(repo.findSuggestion(anyString(), eq(suggestionId))).thenReturn(Optional.of(
                new WorkflowRepository.SuggestionRow(suggestionId, docId, "nội dung",
                        "Pending Developer Action", "drift")));

        assertThatThrownBy(() ->
                driftService.handleSuggestion("acme", suggestionId, "dismiss", null, "  "))
                .hasMessageContaining("lý do");
        verify(repo, never()).updateSuggestionStatus(anyString(), any(), any(), any());
    }

    private void login() {
        AuthContext.set(new AuthContext.CurrentUser(devId, "acme", List.of("Developer")));
    }
}
