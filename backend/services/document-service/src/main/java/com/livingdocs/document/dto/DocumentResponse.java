package com.livingdocs.document.dto;

import java.time.Instant;
import java.util.UUID;

public class DocumentResponse {
    private UUID id;
    private UUID repositoryId;
    private String docType;
    private UUID templateId;
    private UUID collectionId;
    private UUID ownerId;
    private String title;
    private String pathInRepo;
    private UUID currentVersionId;
    private Integer currentVersionNo;
    private String docStatus;
    private String publishStatus;
    private String prStatus;
    private Instant createdAt;
    private Instant updatedAt;

    public DocumentResponse() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getDocumentId() { return id; }
    public void setDocumentId(UUID documentId) { if (this.id == null) this.id = documentId; }
    public UUID getRepositoryId() { return repositoryId; }
    public void setRepositoryId(UUID repositoryId) { this.repositoryId = repositoryId; }
    public String getDocType() { return docType; }
    public void setDocType(String docType) { this.docType = docType; }
    public UUID getTemplateId() { return templateId; }
    public void setTemplateId(UUID templateId) { this.templateId = templateId; }
    public UUID getCollectionId() { return collectionId; }
    public void setCollectionId(UUID collectionId) { this.collectionId = collectionId; }
    public UUID getOwnerId() { return ownerId; }
    public void setOwnerId(UUID ownerId) { this.ownerId = ownerId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getPathInRepo() { return pathInRepo; }
    public void setPathInRepo(String pathInRepo) { this.pathInRepo = pathInRepo; }
    public UUID getCurrentVersionId() { return currentVersionId; }
    public void setCurrentVersionId(UUID currentVersionId) { this.currentVersionId = currentVersionId; }
    public Integer getCurrentVersionNo() { return currentVersionNo; }
    public void setCurrentVersionNo(Integer currentVersionNo) { this.currentVersionNo = currentVersionNo; }
    public String getDocStatus() { return docStatus; }
    public void setDocStatus(String docStatus) { this.docStatus = docStatus; }
    public String getPublishStatus() { return publishStatus; }
    public void setPublishStatus(String publishStatus) { this.publishStatus = publishStatus; }
    public String getPrStatus() { return prStatus; }
    public void setPrStatus(String prStatus) { this.prStatus = prStatus; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}

