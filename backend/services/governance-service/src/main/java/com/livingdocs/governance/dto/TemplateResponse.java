package com.livingdocs.governance.dto;

import java.time.Instant;
import java.util.UUID;

public class TemplateResponse {
    private UUID id;
    private String name;
    private String docType;
    private String description;
    private UUID currentVersionId;
    private Integer currentVersionNo;
    private String status;
    private String sections;
    private String formatRules;
    private Instant createdAt;
    private Instant updatedAt;

    public TemplateResponse() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDocType() { return docType; }
    public void setDocType(String docType) { this.docType = docType; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public UUID getCurrentVersionId() { return currentVersionId; }
    public void setCurrentVersionId(UUID currentVersionId) { this.currentVersionId = currentVersionId; }
    public Integer getCurrentVersionNo() { return currentVersionNo; }
    public void setCurrentVersionNo(Integer currentVersionNo) { this.currentVersionNo = currentVersionNo; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getSections() { return sections; }
    public void setSections(String sections) { this.sections = sections; }
    public String getFormatRules() { return formatRules; }
    public void setFormatRules(String formatRules) { this.formatRules = formatRules; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}

