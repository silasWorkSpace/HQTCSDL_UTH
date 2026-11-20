package com.livingdocs.document.dto;

import java.util.UUID;

public class InternalDocumentLinkDto {
    private UUID id;
    private UUID documentId;
    private String documentTitle;
    private String pathInRepo;
    private String linkType;
    private UUID codeEntityId;
    private String externalRef;

    public InternalDocumentLinkDto() {}

    public InternalDocumentLinkDto(UUID id, UUID documentId, String documentTitle, String pathInRepo, String linkType, UUID codeEntityId, String externalRef) {
        this.id = id;
        this.documentId = documentId;
        this.documentTitle = documentTitle;
        this.pathInRepo = pathInRepo;
        this.linkType = linkType;
        this.codeEntityId = codeEntityId;
        this.externalRef = externalRef;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getDocumentId() { return documentId; }
    public void setDocumentId(UUID documentId) { this.documentId = documentId; }
    public String getDocumentTitle() { return documentTitle; }
    public void setDocumentTitle(String documentTitle) { this.documentTitle = documentTitle; }
    public String getPathInRepo() { return pathInRepo; }
    public void setPathInRepo(String pathInRepo) { this.pathInRepo = pathInRepo; }
    public String getLinkType() { return linkType; }
    public void setLinkType(String linkType) { this.linkType = linkType; }
    public UUID getCodeEntityId() { return codeEntityId; }
    public void setCodeEntityId(UUID codeEntityId) { this.codeEntityId = codeEntityId; }
    public String getExternalRef() { return externalRef; }
    public void setExternalRef(String externalRef) { this.externalRef = externalRef; }
}
