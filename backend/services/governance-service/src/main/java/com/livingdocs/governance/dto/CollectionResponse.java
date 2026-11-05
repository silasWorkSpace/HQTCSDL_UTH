package com.livingdocs.governance.dto;

import java.time.Instant;
import java.util.UUID;

public class CollectionResponse {
    private UUID id;
    private String name;
    private String description;
    private UUID defaultTemplateId;
    private Instant createdAt;

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
    public UUID getDefaultTemplateId() { return defaultTemplateId; }
    public void setDefaultTemplateId(UUID defaultTemplateId) { this.defaultTemplateId = defaultTemplateId; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

