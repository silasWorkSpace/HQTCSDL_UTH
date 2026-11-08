package com.livingdocs.common.events;

import java.util.List;
import java.util.UUID;

public class GenerateDocPayload {
    private String scopeType;      // FILE, MODULE, REPOSITORY
    private String scopeReference; // e.g. path or repo name
    private UUID repositoryId;
    private UUID templateId;
    private UUID requestedBy;
    private String commitSha;

    public GenerateDocPayload() {}

    public String getScopeType() {
        return scopeType;
    }

    public void setScopeType(String scopeType) {
        this.scopeType = scopeType;
    }

    public String getScopeReference() {
        return scopeReference;
    }

    public void setScopeReference(String scopeReference) {
        this.scopeReference = scopeReference;
    }

    public UUID getRepositoryId() {
        return repositoryId;
    }

    public void setRepositoryId(UUID repositoryId) {
        this.repositoryId = repositoryId;
    }

    public UUID getTemplateId() {
        return templateId;
    }

    public void setTemplateId(UUID templateId) {
        this.templateId = templateId;
    }

    public UUID getRequestedBy() {
        return requestedBy;
    }

    public void setRequestedBy(UUID requestedBy) {
        this.requestedBy = requestedBy;
    }

    public String getCommitSha() {
        return commitSha;
    }

    public void setCommitSha(String commitSha) {
        this.commitSha = commitSha;
    }
}

