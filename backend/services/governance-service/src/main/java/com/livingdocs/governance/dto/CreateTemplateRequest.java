package com.livingdocs.governance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class CreateTemplateRequest {
    @NotBlank
    private String name;

    @NotBlank
    @Pattern(regexp = "API_REFERENCE|README|MODULE_GUIDE|ONBOARDING_GUIDE|ADR|OTHER")
    private String docType;

    private String description;

    @NotBlank
    private String sections; // JSON string

    private String formatRules; // JSON string

    public CreateTemplateRequest() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDocType() { return docType; }
    public void setDocType(String docType) { this.docType = docType; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getSections() { return sections; }
    public void setSections(String sections) { this.sections = sections; }
    public String getFormatRules() { return formatRules; }
    public void setFormatRules(String formatRules) { this.formatRules = formatRules; }
}

