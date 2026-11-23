package com.livingdocs.governance.dto;

import java.time.Instant;
import java.util.UUID;

public class CollectionResponse {
    private UUID id;
    private String name;
    private String description;
    private UUID ownerId;
    private String ownerName;
    private UUID defaultTemplateId;
    private String defaultTemplateName;
    private long documentCount;
    private Instant createdAt;
    private Instant updatedAt;

    public CollectionResponse() {}

    public CollectionResponse(UUID id, String name, String description, UUID defaultTemplateId, Instant createdAt) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.defaultTemplateId = defaultTemplateId;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public UUID getOwnerId() { return ownerId; }
    public void setOwnerId(UUID ownerId) { this.ownerId = ownerId; }
    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }
    public UUID getDefaultTemplateId() { return defaultTemplateId; }
    public void setDefaultTemplateId(UUID defaultTemplateId) { this.defaultTemplateId = defaultTemplateId; }
    public String getDefaultTemplateName() { return defaultTemplateName; }
    public void setDefaultTemplateName(String defaultTemplateName) { this.defaultTemplateName = defaultTemplateName; }
    public long getDocumentCount() { return documentCount; }
    public void setDocumentCount(long documentCount) { this.documentCount = documentCount; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
