package com.livingdocs.governance.dto;

import java.util.List;
import java.util.Map;

public class TemplatePreviewResponse {
    private String previewMarkdown;
    private List<Map<String, Object>> parsedSections;
    private Map<String, Object> appliedFormatRules;

    public TemplatePreviewResponse() {}

    public TemplatePreviewResponse(String previewMarkdown, List<Map<String, Object>> parsedSections, Map<String, Object> appliedFormatRules) {
        this.previewMarkdown = previewMarkdown;
        this.parsedSections = parsedSections;
        this.appliedFormatRules = appliedFormatRules;
    }

    public String getPreviewMarkdown() { return previewMarkdown; }
    public void setPreviewMarkdown(String previewMarkdown) { this.previewMarkdown = previewMarkdown; }
    public List<Map<String, Object>> getParsedSections() { return parsedSections; }
    public void setParsedSections(List<Map<String, Object>> parsedSections) { this.parsedSections = parsedSections; }
    public Map<String, Object> getAppliedFormatRules() { return appliedFormatRules; }
    public void setAppliedFormatRules(Map<String, Object> appliedFormatRules) { this.appliedFormatRules = appliedFormatRules; }
}
