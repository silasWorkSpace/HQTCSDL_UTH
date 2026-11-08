package com.livingdocs.workflow.controller;

import com.livingdocs.workflow.security.AuthContext;
import com.livingdocs.workflow.security.RequireRole;
import com.livingdocs.workflow.service.DriftService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * API drift và gợi ý cập nhật (đặt tại workflow-service theo quyết định chốt
 * Thứ Hai để cân tải giữa 4 người).
 *
 * <p>Ánh xạ SRS: DR-12 (lịch sử drift), AUTO-02 (hàng đợi Developer),
 * AUTO-07/08/09 + DR-09 (accept/edit/dismiss).
 */
@RestController
@RequestMapping("/api/v1")
public class DriftController {

    private final DriftService driftService;

    public DriftController(DriftService driftService) {
        this.driftService = driftService;
    }

    /** DR-12: lịch sử drift và trạng thái xử lý của một tài liệu. */
    @GetMapping("/documents/{id}/drift-alerts")
    @RequireRole({"Developer", "Staff", "Manager", "Technical Lead", "Administrator"})
    public List<Map<String, Object>> driftAlerts(@PathVariable UUID id) {
        return driftService.driftAlerts(AuthContext.get().tenant(), id);
    }

    /** AUTO-02: hàng đợi gợi ý của Developer; lọc theo ?status= (mặc định Pending Developer Action). */
    @GetMapping("/suggestions")
    @RequireRole({"Developer", "Staff", "Manager", "Technical Lead", "Administrator"})
    public List<Map<String, Object>> suggestions(
            @RequestParam(name = "status", required = false) String status) {
        return driftService.suggestions(AuthContext.get().tenant(), status);
    }

    /** AUTO-07/08 + DR-09: Accept — đưa nội dung gợi ý vào duyệt Staff → Manager. */
    @PostMapping("/suggestions/{id}/accept")
    @RequireRole({"Developer", "Administrator"})
    public Map<String, Object> accept(@PathVariable UUID id) {
        return driftService.handleSuggestion(AuthContext.get().tenant(), id, "accept", null, null);
    }

    /** AUTO-07/08 + DR-09: Edit — sửa nội dung rồi nộp vào duyệt. */
    @PostMapping("/suggestions/{id}/edit")
    @RequireRole({"Developer", "Administrator"})
    public Map<String, Object> edit(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        return driftService.handleSuggestion(AuthContext.get().tenant(), id, "edit",
                body.get("content"), null);
    }

    /** AUTO-09: Dismiss bắt buộc lý do, không vào quy trình duyệt. */
    @PostMapping("/suggestions/{id}/dismiss")
    @RequireRole({"Developer", "Administrator"})
    public Map<String, Object> dismiss(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        return driftService.handleSuggestion(AuthContext.get().tenant(), id, "dismiss", null,
                body.get("reason"));
    }
}
