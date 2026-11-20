package com.livingdocs.governance.dto;

import java.time.Instant;
import java.util.UUID;

public class TemplateVersionResponse {
    private UUID id;
    private UUID templateId;
    private int versionNo;
    private String sections;
    private String formatRules;
    private String changeNote;
    private UUID createdBy;
    private Instant createdAt;

    public TemplateVersionResponse() {}

    public TemplateVersionResponse(UUID id, UUID templateId, int versionNo, String sections, String formatRules, String changeNote, UUID createdBy, Instant createdAt) {
        this.id = id;
        this.templateId = templateId;
        this.versionNo = versionNo;
        this.sections = sections;
        this.formatRules = formatRules;
        this.changeNote = changeNote;
        this.createdBy = createdBy;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getTemplateId() { return templateId; }
    public void setTemplateId(UUID templateId) { this.templateId = templateId; }
    public int getVersionNo() { return versionNo; }
    public void setVersionNo(int versionNo) { this.versionNo = versionNo; }
    public String getSections() { return sections; }
    public void setSections(String sections) { this.sections = sections; }
    public String getFormatRules() { return formatRules; }
    public void setFormatRules(String formatRules) { this.formatRules = formatRules; }
    public String getChangeNote() { return changeNote; }
    public void setChangeNote(String changeNote) { this.changeNote = changeNote; }
    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
