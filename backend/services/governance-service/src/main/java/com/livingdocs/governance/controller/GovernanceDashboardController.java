package com.livingdocs.governance.controller;

import com.livingdocs.governance.dto.GovernanceHealthDashboardResponse;
import com.livingdocs.governance.service.GovernanceDashboardService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/governance/dashboard")
public class GovernanceDashboardController {

    private final GovernanceDashboardService dashboardService;

    public GovernanceDashboardController(GovernanceDashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/health")
    @PreAuthorize("hasAnyRole('Developer', 'Staff', 'Manager', 'Technical Lead', 'Administrator')")
    public ResponseEntity<GovernanceHealthDashboardResponse> getHealthDashboard() {
        return ResponseEntity.ok(dashboardService.getHealthDashboard());
    }
}
