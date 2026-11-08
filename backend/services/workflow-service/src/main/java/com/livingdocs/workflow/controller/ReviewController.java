package com.livingdocs.workflow.controller;

import com.livingdocs.workflow.dto.ReviewDecisionRequest;
import com.livingdocs.workflow.dto.ReviewTaskView;
import com.livingdocs.workflow.security.AuthContext;
import com.livingdocs.workflow.security.RequireRole;
import com.livingdocs.workflow.service.ReviewService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * API quy trình duyệt Staff → Manager.
 *
 * <p>Ánh x yêu cầu SRS (cụm Huy): WF-01/12 (hàng đợi), WF-03/04/05 (chi tiết duyệt),
 * WF-09/10/14/15/22 (quyết định), GEN-10 (nộp duyệt).
 */
@RestController
@RequestMapping("/api/v1")
public class ReviewController {

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    /** GEN-10: Developer nộp bản Draft vào duyệt, tạo review_task cấp Staff. */
    @PostMapping("/documents/{id}/submit")
    @RequireRole({"Developer", "Staff", "Manager", "Technical Lead", "Administrator"})
    public ResponseEntity<ReviewTaskView> submit(@PathVariable UUID id) {
        return ResponseEntity.accepted()
                .body(reviewService.submit(AuthContext.get().tenant(), id, AuthContext.get()));
    }

    /** WF-01, WF-12: hàng đợi chờ Staff (?level=staff) hoặc chờ Manager (?level=manager). */
    @GetMapping("/reviews/queue")
    @RequireRole({"Staff", "Manager", "Technical Lead", "Administrator"})
    public List<ReviewTaskView> queue(@RequestParam(defaultValue = "staff") String level) {
        return reviewService.queue(AuthContext.get().tenant(), level, AuthContext.get());
    }

    /** WF-03/04/05: tài liệu, bằng chứng, change log, so sánh bản duyệt gần nhất. */
    @GetMapping("/reviews/{id}")
    @RequireRole({"Staff", "Manager", "Technical Lead", "Administrator"})
    public Map<String, Object> detail(@PathVariable UUID id) {
        return reviewService.detail(AuthContext.get().tenant(), id, AuthContext.get());
    }

    /** WF-09/10/14/15: approve | reject | request_changes | return. Người nộp không duyệt được (WF-22). */
    @PostMapping("/reviews/{id}/decisions")
    @RequireRole({"Staff", "Manager", "Administrator"})
    public ReviewTaskView decide(@PathVariable UUID id, @RequestBody ReviewDecisionRequest request) {
        return reviewService.decide(AuthContext.get().tenant(), id, request, AuthContext.get());
    }
}
