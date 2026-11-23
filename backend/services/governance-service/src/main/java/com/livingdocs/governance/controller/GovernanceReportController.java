package com.livingdocs.governance.controller;

import com.livingdocs.governance.service.GovernanceReportService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/governance/reports")
public class GovernanceReportController {

    private final GovernanceReportService reportService;

    public GovernanceReportController(GovernanceReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/health")
    @PreAuthorize("hasAnyRole('Developer', 'Staff', 'Manager', 'Technical Lead', 'Administrator')")
    public ResponseEntity<?> getHealthReport(
            @RequestParam(value = "repositoryId", required = false) UUID repositoryId,
            @RequestParam(value = "collectionId", required = false) UUID collectionId,
            @RequestParam(value = "severity", required = false) String severity,
            @RequestParam(value = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(value = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(value = "format", defaultValue = "json") String format) {

        List<Map<String, Object>> data = reportService.generateHealthReportData(repositoryId, collectionId, severity, from, to);

        if ("csv".equalsIgnoreCase(format)) {
            String csv = reportService.exportHealthReportCsv(data);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"health-report.csv\"")
                    .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                    .body(csv);
        }

        return ResponseEntity.ok(Map.of(
            "reportType", "health",
            "generatedAt", Instant.now().toString(),
            "totalRecords", data.size(),
            "records", data
        ));
    }

    @GetMapping("/compliance")
    @PreAuthorize("hasAnyRole('Developer', 'Staff', 'Manager', 'Technical Lead', 'Administrator')")
    public ResponseEntity<?> getComplianceReport(
            @RequestParam(value = "repositoryId", required = false) UUID repositoryId,
            @RequestParam(value = "collectionId", required = false) UUID collectionId,
            @RequestParam(value = "format", defaultValue = "json") String format) {

        List<Map<String, Object>> data = reportService.generateComplianceReportData(repositoryId, collectionId);

        if ("csv".equalsIgnoreCase(format)) {
            String csv = reportService.exportComplianceReportCsv(data);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"compliance-report.csv\"")
                    .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                    .body(csv);
        }

        return ResponseEntity.ok(Map.of(
            "reportType", "compliance",
            "generatedAt", Instant.now().toString(),
            "totalRecords", data.size(),
            "records", data
        ));
    }
}
