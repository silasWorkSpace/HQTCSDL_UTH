package com.livingdocs.common.events;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public class GenerateDocPayload {
    private String scopeType;      // FILE, MODULE, REPOSITORY
    private String scopeReference; // e.g. path or repo name
    private UUID repositoryId;
    private UUID templateId;
    private UUID templateVersionId;
    private String templateSections;
    private String formatRules;
    private UUID requestedBy;
    private String commitSha;
    private List<UUID> codeEntityIds;
    private List<Map<String, Object>> entities;
    private String title;
    private String pathInRepo;

    public GenerateDocPayload() {}

    public String getScopeType() { return scopeType; }
    public void setScopeType(String scopeType) { this.scopeType = scopeType; }
    public String getScopeReference() { return scopeReference; }
    public void setScopeReference(String scopeReference) { this.scopeReference = scopeReference; }
    public UUID getRepositoryId() { return repositoryId; }
    public void setRepositoryId(UUID repositoryId) { this.repositoryId = repositoryId; }
    public UUID getTemplateId() { return templateId; }
    public void setTemplateId(UUID templateId) { this.templateId = templateId; }
    public UUID getTemplateVersionId() { return templateVersionId; }
    public void setTemplateVersionId(UUID templateVersionId) { this.templateVersionId = templateVersionId; }
    public String getTemplateSections() { return templateSections; }
    public void setTemplateSections(String templateSections) { this.templateSections = templateSections; }
    public String getFormatRules() { return formatRules; }
    public void setFormatRules(String formatRules) { this.formatRules = formatRules; }
    public UUID getRequestedBy() { return requestedBy; }
    public void setRequestedBy(UUID requestedBy) { this.requestedBy = requestedBy; }
    public String getCommitSha() { return commitSha; }
    public void setCommitSha(String commitSha) { this.commitSha = commitSha; }
    public List<UUID> getCodeEntityIds() { return codeEntityIds; }
    public void setCodeEntityIds(List<UUID> codeEntityIds) { this.codeEntityIds = codeEntityIds; }
    public List<Map<String, Object>> getEntities() { return entities; }
    public void setEntities(List<Map<String, Object>> entities) { this.entities = entities; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getPathInRepo() { return pathInRepo; }
    public void setPathInRepo(String pathInRepo) { this.pathInRepo = pathInRepo; }
}
