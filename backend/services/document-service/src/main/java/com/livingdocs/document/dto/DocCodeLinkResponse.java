package com.livingdocs.document.dto;

import java.time.Instant;
import java.util.UUID;

public class DocCodeLinkResponse {
    private UUID id;
    private UUID documentId;
    private String linkType;
    private UUID codeEntityId;
    private String externalRef;
    private Instant createdAt;

    public DocCodeLinkResponse() {}

    public DocCodeLinkResponse(UUID id, UUID documentId, String linkType, UUID codeEntityId, String externalRef, Instant createdAt) {
        this.id = id;
        this.documentId = documentId;
        this.linkType = linkType;
        this.codeEntityId = codeEntityId;
        this.externalRef = externalRef;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getDocumentId() { return documentId; }
    public void setDocumentId(UUID documentId) { this.documentId = documentId; }
    public String getLinkType() { return linkType; }
    public void setLinkType(String linkType) { this.linkType = linkType; }
    public UUID getCodeEntityId() { return codeEntityId; }
    public void setCodeEntityId(UUID codeEntityId) { this.codeEntityId = codeEntityId; }
    public String getExternalRef() { return externalRef; }
    public void setExternalRef(String externalRef) { this.externalRef = externalRef; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

