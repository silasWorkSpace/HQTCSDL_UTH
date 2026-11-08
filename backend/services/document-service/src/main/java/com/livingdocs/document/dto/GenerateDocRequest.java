package com.livingdocs.document.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public class GenerateDocRequest {
    @NotBlank
    private String scopeType; // FILE, MODULE, REPOSITORY

    @NotBlank
    private String scopeReference;

    @NotNull
    private UUID repositoryId;

    @NotNull
    private UUID templateId;

    private String commitSha;

    public GenerateDocRequest() {}

    public String getScopeType() { return scopeType; }
    public void setScopeType(String scopeType) { this.scopeType = scopeType; }
    public String getScopeReference() { return scopeReference; }
    public void setScopeReference(String scopeReference) { this.scopeReference = scopeReference; }
    public UUID getRepositoryId() { return repositoryId; }
    public void setRepositoryId(UUID repositoryId) { this.repositoryId = repositoryId; }
    public UUID getTemplateId() { return templateId; }
    public void setTemplateId(UUID templateId) { this.templateId = templateId; }
    public String getCommitSha() { return commitSha; }
    public void setCommitSha(String commitSha) { this.commitSha = commitSha; }
}

