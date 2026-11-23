package com.livingdocs.document.dto;

import java.time.Instant;
import java.util.UUID;

public class InternalDocumentVersionDto {
    private UUID id;
    private UUID documentId;
    private int versionNo;
    private String title;
    private String pathInRepo;
    private String docType;
    private String docStatus;
    private String content;
    private UUID templateId;
    private UUID templateVersionId;
    private String changeSource;
    private Instant createdAt;

    public InternalDocumentVersionDto() {}

    public InternalDocumentVersionDto(UUID id, UUID documentId, int versionNo, String title, String pathInRepo, String docType, String docStatus, String content, UUID templateId, UUID templateVersionId, String changeSource, Instant createdAt) {
        this.id = id;
        this.documentId = documentId;
        this.versionNo = versionNo;
        this.title = title;
        this.pathInRepo = pathInRepo;
        this.docType = docType;
        this.docStatus = docStatus;
        this.content = content;
        this.templateId = templateId;
        this.templateVersionId = templateVersionId;
        this.changeSource = changeSource;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getDocumentId() { return documentId; }
    public void setDocumentId(UUID documentId) { this.documentId = documentId; }
    public int getVersionNo() { return versionNo; }
    public void setVersionNo(int versionNo) { this.versionNo = versionNo; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getPathInRepo() { return pathInRepo; }
    public void setPathInRepo(String pathInRepo) { this.pathInRepo = pathInRepo; }
    public String getDocType() { return docType; }
    public void setDocType(String docType) { this.docType = docType; }
    public String getDocStatus() { return docStatus; }
    public void setDocStatus(String docStatus) { this.docStatus = docStatus; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public UUID getTemplateId() { return templateId; }
    public void setTemplateId(UUID templateId) { this.templateId = templateId; }
    public UUID getTemplateVersionId() { return templateVersionId; }
    public void setTemplateVersionId(UUID templateVersionId) { this.templateVersionId = templateVersionId; }
    public String getChangeSource() { return changeSource; }
    public void setChangeSource(String changeSource) { this.changeSource = changeSource; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
