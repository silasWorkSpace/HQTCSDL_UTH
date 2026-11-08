package com.livingdocs.workflow;

import com.livingdocs.workflow.dto.ReviewDecisionRequest;
import com.livingdocs.workflow.repo.WorkflowRepository;
import com.livingdocs.workflow.security.AuthContext;
import com.livingdocs.workflow.service.AuditService;
import com.livingdocs.workflow.service.LoggingNotifyPort;
import com.livingdocs.workflow.service.PublishPort;
import com.livingdocs.workflow.service.PublishSimulator;
import com.livingdocs.workflow.service.ReviewService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Test luồng duyệt chính: submit → Staff approve → Manager approve, tách biệt
 * nhiệm vụ FR-WF-22 và từ chối bắt buộc lý do (FR-WF-10/15).
 */
class ReviewServiceTest {

    private WorkflowRepository repo;
    private ReviewService reviewService;
    private PublishPort publishPort;

    private final UUID docId = UUID.randomUUID();
    private final UUID versionId = UUID.randomUUID();
    private final UUID devId = UUID.randomUUID();
    private final UUID staffId = UUID.randomUUID();
    private final UUID managerId = UUID.randomUUID();
    private final UUID taskId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        repo = mock(WorkflowRepository.class);
        publishPort = mock(PublishPort.class);
        AuditService audit = mock(AuditService.class);
        reviewService = new ReviewService(repo, audit, new LoggingNotifyPort(), publishPort);

        WorkflowRepository.DocumentRow doc =
                new WorkflowRepository.DocumentRow(docId, "API Login", "DRAFT", versionId,
                        devId, null);
        when(repo.findDocument(anyString(), eq(docId))).thenReturn(Optional.of(doc));
        when(repo.findUserIdsWithRole(anyString(), anyString())).thenReturn(List.of());
    }

    @AfterEach
    void tearDown() {
        AuthContext.clear();
    }

    private void login(UUID userId, String... roles) {
        AuthContext.set(new AuthContext.CurrentUser(userId, "acme", List.of(roles)));
    }

    @Test
    void submitDraftCreatesStaffTaskAndTransitions() {
        login(devId, "Developer");
        WorkflowRepository.TaskRow pending = task("Staff", "Pending");
        when(repo.findTaskIdByDocumentAndLevel(anyString(), eq(docId), eq("Staff"), anyList()))
                .thenReturn(0);
        when(repo.listQueue(anyString(), eq("Staff"))).thenReturn(List.of(pending));

        reviewService.submit("acme", docId, AuthContext.get());

        verify(repo).transitionDocument("acme", docId, "IN_REVIEW_STAFF", "Developer", devId);
        verify(repo).insertReviewTask("acme", docId, versionId, "Staff", devId);
    }

    @Test
    void submitRejectedForWrongStatus() {
        login(devId, "Developer");
        when(repo.findDocument(anyString(), eq(docId))).thenReturn(Optional.of(
                new WorkflowRepository.DocumentRow(docId, "API", "IN_REVIEW_STAFF", versionId,
                        devId, null)));

        assertThatThrownBy(() -> reviewService.submit("acme", docId, AuthContext.get()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("không thể nộp duyệt");
    }

    @Test
    void staffApproveForwardsToManager() {
        login(staffId, "Staff");
        WorkflowRepository.TaskRow staffTask = task("Staff", "Pending");
        when(repo.findTask(anyString(), eq(taskId))).thenReturn(Optional.of(staffTask));
        WorkflowRepository.TaskRow managerTask = task("Manager", "Pending");
        when(repo.listQueue(anyString(), eq("Manager"))).thenReturn(List.of(managerTask));

        reviewService.decide("acme", taskId,
                new ReviewDecisionRequest(ReviewDecisionRequest.DecisionType.APPROVE, null, null),
                AuthContext.get());

        verify(repo).transitionDocument("acme", docId, "IN_REVIEW_MANAGER", "Staff", staffId);
        verify(repo).insertReviewTask("acme", docId, versionId, "Manager", devId);
        verify(publishPort, never()).publish(anyString(), any());
    }

    @Test
    void managerApproveTriggersPublish() {
        login(managerId, "Manager");
        when(repo.findTask(anyString(), eq(taskId)))
                .thenReturn(Optional.of(task("Manager", "Pending")));
        // Manager khác người đã duyệt Staff
        when(repo.listDecisions(anyString(), eq(taskId))).thenReturn(List.of());

        reviewService.decide("acme", taskId,
                new ReviewDecisionRequest(ReviewDecisionRequest.DecisionType.APPROVE, null, null),
                AuthContext.get());

        verify(repo).transitionDocument("acme", docId, "APPROVED", "Manager", managerId);
        verify(publishPort).publish("acme", docId);
    }

    @Test
    void submitterCannotReviewOwnDocument() {
        login(devId, "Staff"); // người nộp cũng giữ vai trò Staff
        when(repo.findTask(anyString(), eq(taskId)))
                .thenReturn(Optional.of(task("Staff", "Pending")));

        assertThatThrownBy(() -> reviewService.decide("acme", taskId,
                new ReviewDecisionRequest(ReviewDecisionRequest.DecisionType.APPROVE, null, null),
                AuthContext.get()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("FR-WF-22");
    }

    @Test
    void staffApproverCannotFinalApproveAsManager() {
        login(staffId, "Manager"); // cùng người, hai vai trò
        when(repo.findTask(anyString(), eq(taskId)))
                .thenReturn(Optional.of(task("Manager", "Pending")));
        when(repo.listDecisions(anyString(), eq(taskId))).thenReturn(List.of(
                new WorkflowRepository.DecisionRow(staffId, "APPROVE", null)));

        assertThatThrownBy(() -> reviewService.decide("acme", taskId,
                new ReviewDecisionRequest(ReviewDecisionRequest.DecisionType.APPROVE, null, null),
                AuthContext.get()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("FR-WF-22");
    }

    @Test
    void rejectRequiresReason() {
        login(staffId, "Staff");
        when(repo.findTask(anyString(), eq(taskId)))
                .thenReturn(Optional.of(task("Staff", "Pending")));

        assertThatThrownBy(() -> reviewService.decide("acme", taskId,
                new ReviewDecisionRequest(ReviewDecisionRequest.DecisionType.REJECT, "  ", null),
                AuthContext.get()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("lý do");
    }

    @Test
    void alreadyHandledTaskIsConflict() {
        login(staffId, "Staff");
        when(repo.findTask(anyString(), eq(taskId)))
                .thenReturn(Optional.of(task("Staff", "Completed")));

        assertThatThrownBy(() -> reviewService.decide("acme", taskId,
                new ReviewDecisionRequest(ReviewDecisionRequest.DecisionType.APPROVE, null, null),
                AuthContext.get()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("đã được xử lý");
    }

    private WorkflowRepository.TaskRow task(String level, String status) {
        return new WorkflowRepository.TaskRow(taskId, docId, versionId, level, devId, status, null);
    }
}
