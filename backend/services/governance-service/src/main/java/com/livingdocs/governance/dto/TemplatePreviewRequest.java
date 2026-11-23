package com.livingdocs.governance.dto;

import java.util.Map;

public class TemplatePreviewRequest {
    private String sections;
    private String formatRules;
    private Map<String, Object> variables;

    public TemplatePreviewRequest() {}

    public String getSections() { return sections; }
    public void setSections(String sections) { this.sections = sections; }
    public String getFormatRules() { return formatRules; }
    public void setFormatRules(String formatRules) { this.formatRules = formatRules; }
    public Map<String, Object> getVariables() { return variables; }
    public void setVariables(Map<String, Object> variables) { this.variables = variables; }
}
