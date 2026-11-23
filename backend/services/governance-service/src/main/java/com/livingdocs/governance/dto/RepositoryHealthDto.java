package com.livingdocs.governance.dto;

import java.util.UUID;

public class RepositoryHealthDto {
    private UUID repositoryId;
    private String repositoryName;
    private double healthScore;
    private long documentCount;
    private long openDriftCount;
    private String status;

    public RepositoryHealthDto() {}

    public RepositoryHealthDto(UUID repositoryId, String repositoryName, double healthScore, long documentCount, long openDriftCount, String status) {
        this.repositoryId = repositoryId;
        this.repositoryName = repositoryName;
        this.healthScore = healthScore;
        this.documentCount = documentCount;
        this.openDriftCount = openDriftCount;
        this.status = status;
    }

    public UUID getRepositoryId() { return repositoryId; }
    public void setRepositoryId(UUID repositoryId) { this.repositoryId = repositoryId; }
    public String getRepositoryName() { return repositoryName; }
    public void setRepositoryName(String repositoryName) { this.repositoryName = repositoryName; }
    public double getHealthScore() { return healthScore; }
    public void setHealthScore(double healthScore) { this.healthScore = healthScore; }
    public long getDocumentCount() { return documentCount; }
    public void setDocumentCount(long documentCount) { this.documentCount = documentCount; }
    public long getOpenDriftCount() { return openDriftCount; }
    public void setOpenDriftCount(long openDriftCount) { this.openDriftCount = openDriftCount; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
