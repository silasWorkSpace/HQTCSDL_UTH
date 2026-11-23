package com.livingdocs.integration.controller;

import com.livingdocs.integration.dto.AnalysisRunResponse;
import com.livingdocs.integration.service.AnalysisRunService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;
import java.util.List;

@RestController
@RequestMapping("/api/v1/analysis-runs")
@PreAuthorize("hasAnyRole('Developer', 'Staff', 'Manager', 'TechLead', 'Administrator')")
public class AnalysisRunController {
    private final AnalysisRunService analysisRuns;

    public AnalysisRunController(AnalysisRunService analysisRuns) {
        this.analysisRuns = analysisRuns;
    }

    @GetMapping("/{id}")
    public AnalysisRunResponse get(@PathVariable UUID id) {
        return analysisRuns.get(id);
    }

    @GetMapping
    public List<AnalysisRunResponse> list(@RequestParam UUID repositoryId) {
        return analysisRuns.list(repositoryId);
    }
}
