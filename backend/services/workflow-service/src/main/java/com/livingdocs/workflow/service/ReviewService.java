package com.livingdocs.workflow.service;

import com.livingdocs.workflow.dto.ReviewDecisionRequest;
import com.livingdocs.workflow.dto.ReviewTaskView;
import com.livingdocs.workflow.repo.WorkflowRepository;
import com.livingdocs.workflow.repo.WorkflowRepository.DecisionRow;
import com.livingdocs.workflow.repo.WorkflowRepository.DocumentRow;
import com.livingdocs.workflow.repo.WorkflowRepository.TaskRow;
import com.livingdocs.workflow.repo.WorkflowRepository.VersionRow;
import com.livingdocs.workflow.security.AuthContext;
import com.livingdocs.workflow.security.AuthContext.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Nghiệp vụ quy trình duyệt Staff → Manager (UC-11, UC-12) với tách biệt nhiệm vụ
 * FR-WF-22, audit trail FR-WF-20 và publish giả lập FR-WF-16.
 */
@Service
public class ReviewService {

    private final WorkflowRepository repo;
    private final AuditService audit;
    private final NotifyPort notify;
    private final PublishPort publishPort;

    public ReviewService(WorkflowRepository repo, AuditService audit, NotifyPort notify,
                         PublishPort publishPort) {
        this.repo = repo;
        this.audit = audit;
        this.notify = notify;
        this.publishPort = publishPort;
    }

    /* ---------- nộp duyệt (FR-GEN-10) ---------- */

    @Transactional
    public ReviewTaskView submit(String tenant, UUID documentId, CurrentUser user) {
        DocumentRow doc = repo.findDocument(tenant, documentId)
                .orElseThrow(() -> notFound("Tài liệu"));
        if (!"DRAFT".equals(doc.docStatus()) && !"CHANGES_REQUESTED".equals(doc.docStatus())
                && !"PENDING_DEVELOPER_ACTION".equals(doc.docStatus())) {
            throw conflict("Tài liệu ở trạng thái " + doc.docStatus() + ", không thể nộp duyệt");
        }
        if (doc.currentVersionId() == null) {
            throw conflict("Tài liệu chưa có phiên bản nội dung nào");
        }

        // Đổi trạng thái qua cổng SP — vai trò sai sẽ bị procedure chặn (50030)
        String actorRole = primaryRole(user);
        repo.transitionDocument(tenant, documentId, "IN_REVIEW_STAFF", actorRole, user.userId());

        // Tạo review_task cấp Staff; trùng task đang chờ thì SP/tuần tự ngăn lại
        if (repo.findTaskIdByDocumentAndLevel(tenant, documentId, "Staff", List.of()) == 0) {
            repo.insertReviewTask(tenant, documentId, doc.currentVersionId(), "Staff", user.userId());
        }

        audit.record(tenant, user.userId(), actorRole, "SUBMIT_DOCUMENT", "document",
                documentId, null,
                "{\"from\":\"" + doc.docStatus() + "\",\"to\":\"IN_REVIEW_STAFF\"}");
        notifyRole(tenant, "Staff", "DOC_SUBMITTED",
                "Tài liệu \"" + doc.title() + "\" đang chờ Staff duyệt");
        return toTaskView(tenant,
                repo.listQueue(tenant, "Staff").stream()
                        .filter(t -> t.documentId().equals(documentId)).findFirst()
                        .orElse(null), tenant);
    }

    /* ---------- hàng đợi (FR-WF-01, FR-WF-12) ---------- */

    public List<ReviewTaskView> queue(String tenant, String level, CurrentUser user) {
        String queueLevel = "manager".equalsIgnoreCase(level) ? "Manager" : "Staff";
        String requiredRole = queueLevel; // Staff xem hàng đợi Staff, Manager xem hàng đợi Manager
        if (!user.hasAnyRole(requiredRole, "Administrator", "Technical Lead")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Chỉ " + requiredRole + " được xem hàng đợi này");
        }
        return repo.listQueue(tenant, queueLevel).stream()
                .map(t -> toTaskView(tenant, t, tenant)).toList();
    }

    /* ---------- chi tiết task (FR-WF-03, 04, 05) ---------- */

    public Map<String, Object> detail(String tenant, UUID taskId, CurrentUser user) {
        TaskRow task = repo.findTask(tenant, taskId)
                .orElseThrow(() -> notFound("Review task"));
        DocumentRow doc = repo.findDocument(tenant, task.documentId()).orElse(null);

        Map<String, Object> result = new HashMap<>();
        result.put("task", toTaskView(tenant, task, tenant));
        result.put("document", doc);
        // Bằng chứng: phiên bản đang chờ duyệt
        repo.findVersion(tenant, task.documentVersionId())
                .ifPresent(v -> result.put("versionUnderReview", v));
        // Change log (FR-WF-04)
        result.put("changeLog", repo.listVersions(tenant, task.documentId()));
        // So sánh với bản đã duyệt gần nhất (FR-WF-05) — diff trình bày phía client
        repo.findLastApprovedVersion(tenant, task.documentId())
                .ifPresent(v -> result.put("lastApprovedVersion", v));
        // Quyết định và comment đã có trong task này
        result.put("decisions", repo.listDecisions(tenant, taskId));
        // Comment theo mục (FR-WF-07) — để màn hình duyệt hiển thị lại
        result.put("comments", repo.listComments(tenant, taskId));
        return result;
    }

    /* ---------- quyết định (FR-WF-09/10/14/15, FR-WF-22, FR-WF-20) ---------- */

    @Transactional
    public ReviewTaskView decide(String tenant, UUID taskId, ReviewDecisionRequest request,
                                 CurrentUser user) {
        if (request == null || request.decision() == null) {
            throw badRequest("Thiếu quyết định duyệt");
        }
        TaskRow task = repo.findTask(tenant, taskId)
                .orElseThrow(() -> notFound("Review task"));
        if (!"Pending".equals(task.status())) {
            throw conflict("Review task đã được xử lý (" + task.status() + ")");
        }
        String level = task.level();
        if (!user.hasAnyRole(level, "Administrator")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Task này thuộc cấp " + level + ", vai trò bạn không thể duyệt");
        }
        // FR-WF-22a: người nộp không được duyệt bản của chính mình — chặn ở server
        if (task.submitterId().equals(user.userId())) {
            throw conflict("Bạn là người nộp bản này, không thể tự duyệt (FR-WF-22)");
        }
        // FR-WF-22b: người đã duyệt ở bước Staff không được duyệt cuối với tư cách Manager
        if ("Manager".equals(level) && hasStaffDecisionBy(tenant, task, user.userId())) {
            throw conflict("Bạn đã duyệt bản này ở bước Staff, không thể duyệt lại với tư cách Manager (FR-WF-22)");
        }
        DocumentRow doc = repo.findDocument(tenant, task.documentId())
                .orElseThrow(() -> notFound("Tài liệu"));
        String actorRole = primaryRole(user);
        UUID nextTaskId = null;

        switch (request.decision()) {
            case APPROVE -> nextTaskId = approve(tenant, task, doc, user, actorRole);
            case REJECT -> {
                if (reasonMissing(request)) {
                    throw badRequest("Từ chối bắt buộc kèm lý do");
                }
                repo.transitionDocument(tenant, doc.id(), "REJECTED", actorRole, user.userId());
                repo.updateTaskStatus(tenant, taskId, "Rejected");
                notify.notifyUser(tenant, doc.ownerId(), "DOC_REJECTED",
                        "Tài liệu \"" + doc.title() + "\" bị từ chối: " + request.reason(), null);
            }
            case REQUEST_CHANGES -> {
                repo.transitionDocument(tenant, doc.id(), "CHANGES_REQUESTED", actorRole, user.userId());
                repo.updateTaskStatus(tenant, taskId, "Changes Requested");
                notify.notifyUser(tenant, doc.ownerId(), "DOC_CHANGES_REQUESTED",
                        "Tài liệu \"" + doc.title() + "\" bị trả lại để sửa", null);
            }
            case RETURN -> {
                if (!"Manager".equals(level)) {
                    throw badRequest("Chỉ Manager được trả lại bản về Staff");
                }
                repo.transitionDocument(tenant, doc.id(), "IN_REVIEW_STAFF", actorRole, user.userId());
                repo.updateTaskStatus(tenant, taskId, "Returned");
                repo.insertReviewTask(tenant, doc.id(), task.documentVersionId(), "Staff",
                        task.submitterId());
                notifyRole(tenant, "Staff", "DOC_RETURNED",
                        "Tài liệu \"" + doc.title() + "\" được Manager trả lại Staff");
            }
        }

        // Ghi quyết định, comment theo mục và audit trail (FR-WF-20)
        repo.insertReviewDecision(tenant, taskId, user.userId(), request.decision().name(),
                request.reason());
        if (request.comments() != null) {
            for (ReviewDecisionRequest.SectionComment c : request.comments()) {
                repo.insertReviewComment(tenant, taskId, user.userId(), c.content(), c.lineNumber());
            }
        }
        audit.record(tenant, user.userId(), actorRole, "REVIEW_DECISION", "document", doc.id(),
                null, "{\"task\":\"" + taskId + "\",\"decision\":\"" + request.decision()
                        + "\",\"level\":\"" + level + "\"}");

        return nextTaskId != null
                ? toTaskView(tenant, repo.findTask(tenant, nextTaskId).orElse(null), tenant)
                : toTaskView(tenant, task, tenant);
    }

    private UUID approve(String tenant, TaskRow task, DocumentRow doc, CurrentUser user,
                         String actorRole) {
        if ("Staff".equals(task.level())) {
            // FR-WF-09: Staff duyệt → chuyển tiếp lên Manager
            repo.transitionDocument(tenant, doc.id(), "IN_REVIEW_MANAGER", actorRole, user.userId());
            repo.updateTaskStatus(tenant, task.id(), "Completed");
            repo.insertReviewTask(tenant, doc.id(), task.documentVersionId(), "Manager",
                    task.submitterId());
            notifyRole(tenant, "Manager", "DOC_PENDING_MANAGER",
                    "Tài liệu \"" + doc.title() + "\" chờ Manager phê duyệt cuối");
            return repo.listQueue(tenant, "Manager").stream()
                    .filter(t -> t.documentId().equals(doc.id())).findFirst()
                    .map(TaskRow::id).orElse(null);
        }
        // FR-WF-14/16: Manager phê duyệt cuối → publish (giả lập tuần này)
        repo.transitionDocument(tenant, doc.id(), "APPROVED", actorRole, user.userId());
        repo.updateTaskStatus(tenant, task.id(), "Completed");
        publishPort.publish(tenant, doc.id());
        notify.notifyUser(tenant, doc.ownerId(), "DOC_PUBLISHED",
                "Tài liệu \"" + doc.title() + "\" đã được phê duyệt và publish (giả lập)", null);
        return null;
    }

    private boolean hasStaffDecisionBy(String tenant, TaskRow task, UUID reviewerId) {
        return repo.listDecisions(tenant, task.id()).stream()
                .anyMatch(d -> reviewerId.equals(d.reviewerId())
                        && "APPROVE".equals(d.decision()));
    }

    private static boolean reasonMissing(ReviewDecisionRequest request) {
        return request.reason() == null || request.reason().isBlank();
    }

    /** Phát thông báo đến mọi user đang giữ vai trò trong workspace (NTF-01). */
    private void notifyRole(String tenant, String role, String eventType, String message) {
        for (UUID userId : repo.findUserIdsWithRole(tenant, role)) {
            notify.notifyUser(tenant, userId, eventType, message, null);
        }
    }

    private static String primaryRole(CurrentUser user) {
        if (user.roles() != null && !user.roles().isEmpty()) {
            return user.roles().get(0);
        }
        return "Developer";
    }

    private ReviewTaskView toTaskView(String tenant, TaskRow t, String ignoredTenant) {
        if (t == null) {
            return null;
        }
        String title = repo.findDocument(tenant, t.documentId())
                .map(DocumentRow::title).orElse(null);
        String submitterName = repo.findSubmitterEmail(tenant, t.submitterId()).orElse(null);
        String docStatus = repo.findDocument(tenant, t.documentId())
                .map(DocumentRow::docStatus).orElse(null);
        return new ReviewTaskView(t.id(), t.documentId(), title, t.documentVersionId(), t.level(),
                t.submitterId(), submitterName, null, t.status(), docStatus, t.createdAt());
    }

    private static ResponseStatusException notFound(String what) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, what + " không tồn tại");
    }

    private static ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
