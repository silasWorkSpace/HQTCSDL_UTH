package com.livingdocs.document.dto;

import java.time.Instant;
import java.util.UUID;

public class DocumentVersionResponse {
    private UUID id;
    private UUID documentId;
    private Integer versionNo;
    private String content;
    private Boolean contentRedacted;
    private String actorRole;
    private UUID actorUserId;
    private String changeSource;
    private String statusAtVersion;
    private String sourceCommitSha;
    private Integer sourcePrNumber;
    private String sourcePrKind;
    private String reason;
    private Integer rolledBackFromVersionNo;
    private Boolean requiresReview;
    private Instant createdAt;

    public DocumentVersionResponse() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getDocumentId() { return documentId; }
    public void setDocumentId(UUID documentId) { this.documentId = documentId; }
    public Integer getVersionNo() { return versionNo; }
    public void setVersionNo(Integer versionNo) { this.versionNo = versionNo; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Boolean getContentRedacted() { return contentRedacted; }
    public void setContentRedacted(Boolean contentRedacted) { this.contentRedacted = contentRedacted; }
    public String getActorRole() { return actorRole; }
    public void setActorRole(String actorRole) { this.actorRole = actorRole; }
    public UUID getActorUserId() { return actorUserId; }
    public void setActorUserId(UUID actorUserId) { this.actorUserId = actorUserId; }
    public String getChangeSource() { return changeSource; }
    public void setChangeSource(String changeSource) { this.changeSource = changeSource; }
    public String getStatusAtVersion() { return statusAtVersion; }
    public void setStatusAtVersion(String statusAtVersion) { this.statusAtVersion = statusAtVersion; }
    public String getSourceCommitSha() { return sourceCommitSha; }
    public void setSourceCommitSha(String sourceCommitSha) { this.sourceCommitSha = sourceCommitSha; }
    public Integer getSourcePrNumber() { return sourcePrNumber; }
    public void setSourcePrNumber(Integer sourcePrNumber) { this.sourcePrNumber = sourcePrNumber; }
    public String getSourcePrKind() { return sourcePrKind; }
    public void setSourcePrKind(String sourcePrKind) { this.sourcePrKind = sourcePrKind; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public Integer getRolledBackFromVersionNo() { return rolledBackFromVersionNo; }
    public void setRolledBackFromVersionNo(Integer rolledBackFromVersionNo) { this.rolledBackFromVersionNo = rolledBackFromVersionNo; }
    public Boolean getRequiresReview() { return requiresReview; }
    public void setRequiresReview(Boolean requiresReview) { this.requiresReview = requiresReview; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

