package com.livingdocs.governance.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public class UpdateCollectionRequest {
    @NotBlank
    private String name;
    private String description;
    private UUID ownerId;
    private UUID defaultTemplateId;

    public UpdateCollectionRequest() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public UUID getOwnerId() { return ownerId; }
    public void setOwnerId(UUID ownerId) { this.ownerId = ownerId; }
    public UUID getDefaultTemplateId() { return defaultTemplateId; }
    public void setDefaultTemplateId(UUID defaultTemplateId) { this.defaultTemplateId = defaultTemplateId; }
}
