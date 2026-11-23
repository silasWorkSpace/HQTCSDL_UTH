package com.livingdocs.governance.dto;

import java.util.List;
import java.util.Map;

public class GovernanceHealthDashboardResponse {
    private long totalDocuments;
    private long publishedDocuments;
    private long draftDocuments;
    private long pendingReviewDocuments;
    private double freshnessScore; // 0.0 - 100.0%
    private double coverageScore;  // 0.0 - 100.0%
    private long openDriftAlerts;
    private double averageConfidence;
    private List<RepositoryHealthDto> repositoryScores;
    private Map<String, Object> dependencyGraph;

    public GovernanceHealthDashboardResponse() {}

    public long getTotalDocuments() { return totalDocuments; }
    public void setTotalDocuments(long totalDocuments) { this.totalDocuments = totalDocuments; }
    public long getPublishedDocuments() { return publishedDocuments; }
    public void setPublishedDocuments(long publishedDocuments) { this.publishedDocuments = publishedDocuments; }
    public long getDraftDocuments() { return draftDocuments; }
    public void setDraftDocuments(long draftDocuments) { this.draftDocuments = draftDocuments; }
    public long getPendingReviewDocuments() { return pendingReviewDocuments; }
    public void setPendingReviewDocuments(long pendingReviewDocuments) { this.pendingReviewDocuments = pendingReviewDocuments; }
    public double getFreshnessScore() { return freshnessScore; }
    public void setFreshnessScore(double freshnessScore) { this.freshnessScore = freshnessScore; }
    public double getCoverageScore() { return coverageScore; }
    public void setCoverageScore(double coverageScore) { this.coverageScore = coverageScore; }
    public long getOpenDriftAlerts() { return openDriftAlerts; }
    public void setOpenDriftAlerts(long openDriftAlerts) { this.openDriftAlerts = openDriftAlerts; }
    public double getAverageConfidence() { return averageConfidence; }
    public void setAverageConfidence(double averageConfidence) { this.averageConfidence = averageConfidence; }
    public List<RepositoryHealthDto> getRepositoryScores() { return repositoryScores; }
    public void setRepositoryScores(List<RepositoryHealthDto> repositoryScores) { this.repositoryScores = repositoryScores; }
    public Map<String, Object> getDependencyGraph() { return dependencyGraph; }
    public void setDependencyGraph(Map<String, Object> dependencyGraph) { this.dependencyGraph = dependencyGraph; }
}
