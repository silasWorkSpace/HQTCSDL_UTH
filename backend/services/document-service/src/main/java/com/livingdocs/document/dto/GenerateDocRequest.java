package com.livingdocs.document.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import java.util.List;

public class GenerateDocRequest {
    @NotBlank
    private String scopeType; // FILE, MODULE, REPOSITORY

    private String scopeReference;

    @NotNull
    private UUID repositoryId;

    private UUID templateId;

    private String commitSha;
    private List<UUID> codeEntityIds;
    @NotBlank
    private String title;
    @NotBlank
    private String pathInRepo;

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
    public List<UUID> getCodeEntityIds() { return codeEntityIds; }
    public void setCodeEntityIds(List<UUID> codeEntityIds) { this.codeEntityIds = codeEntityIds; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getPathInRepo() { return pathInRepo; }
    public void setPathInRepo(String pathInRepo) { this.pathInRepo = pathInRepo; }
}

