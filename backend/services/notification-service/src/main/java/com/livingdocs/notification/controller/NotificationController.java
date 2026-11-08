package com.livingdocs.notification.controller;

import com.livingdocs.notification.security.AuthContext;
import com.livingdocs.notification.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * NTF-01: GET /api/v1/notifications?unread=true và
 * POST /api/v1/notifications/{id}/read.
 */
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public List<Map<String, Object>> myNotifications(
            @RequestParam(name = "unread", defaultValue = "false") boolean unread) {
        var user = AuthContext.get();
        return notificationService.myNotifications(user.tenant(), user.userId(), unread);
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable UUID id) {
        var user = AuthContext.get();
        notificationService.markRead(user.tenant(), id, user.userId());
        return ResponseEntity.noContent().build();
    }
}
