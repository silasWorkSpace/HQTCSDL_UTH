package com.livingdocs.common.events;

import java.util.List;
import java.util.UUID;

public class DocDraftPayload {
    private UUID repositoryId;
    private String docType;
    private String title;
    private String pathInRepo;
    private UUID templateId;
    private UUID collectionId;
    private UUID ownerId;
    private String markdownContent;
    private List<SectionResult> sections;
    private Double overallConfidence;
    private List<EvidenceItem> evidenceList;
    private String sourceCommitSha;

    public static class SectionResult {
        private String sectionKey;
        private String sectionTitle;
        private String content;
        private Double confidence;

        public SectionResult() {}

        public String getSectionKey() { return sectionKey; }
        public void setSectionKey(String sectionKey) { this.sectionKey = sectionKey; }
        public String getSectionTitle() { return sectionTitle; }
        public void setSectionTitle(String sectionTitle) { this.sectionTitle = sectionTitle; }
        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
        public Double getConfidence() { return confidence; }
        public void setConfidence(Double confidence) { this.confidence = confidence; }
    }

    public static class EvidenceItem {
        private String sourceFile;
        private String entityName;
        private String entityKind;
        private String lineRange;
        private String snippet;

        public EvidenceItem() {}

        public String getSourceFile() { return sourceFile; }
        public void setSourceFile(String sourceFile) { this.sourceFile = sourceFile; }
        public String getEntityName() { return entityName; }
        public void setEntityName(String entityName) { this.entityName = entityName; }
        public String getEntityKind() { return entityKind; }
        public void setEntityKind(String entityKind) { this.entityKind = entityKind; }
        public String getLineRange() { return lineRange; }
        public void setLineRange(String lineRange) { this.lineRange = lineRange; }
        public String getSnippet() { return snippet; }
        public void setSnippet(String snippet) { this.snippet = snippet; }
    }

    public DocDraftPayload() {}

    public UUID getRepositoryId() { return repositoryId; }
    public void setRepositoryId(UUID repositoryId) { this.repositoryId = repositoryId; }
    public String getDocType() { return docType; }
    public void setDocType(String docType) { this.docType = docType; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getPathInRepo() { return pathInRepo; }
    public void setPathInRepo(String pathInRepo) { this.pathInRepo = pathInRepo; }
    public UUID getTemplateId() { return templateId; }
    public void setTemplateId(UUID templateId) { this.templateId = templateId; }
    public UUID getCollectionId() { return collectionId; }
    public void setCollectionId(UUID collectionId) { this.collectionId = collectionId; }
    public UUID getOwnerId() { return ownerId; }
    public void setOwnerId(UUID ownerId) { this.ownerId = ownerId; }
    public String getMarkdownContent() { return markdownContent; }
    public void setMarkdownContent(String markdownContent) { this.markdownContent = markdownContent; }
    public List<SectionResult> getSections() { return sections; }
    public void setSections(List<SectionResult> sections) { this.sections = sections; }
    public Double getOverallConfidence() { return overallConfidence; }
    public void setOverallConfidence(Double overallConfidence) { this.overallConfidence = overallConfidence; }
    public List<EvidenceItem> getEvidenceList() { return evidenceList; }
    public void setEvidenceList(List<EvidenceItem> evidenceList) { this.evidenceList = evidenceList; }
    public String getSourceCommitSha() { return sourceCommitSha; }
    public void setSourceCommitSha(String sourceCommitSha) { this.sourceCommitSha = sourceCommitSha; }
}

