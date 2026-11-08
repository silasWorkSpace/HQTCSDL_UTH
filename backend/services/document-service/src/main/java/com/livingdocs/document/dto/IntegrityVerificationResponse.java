package com.livingdocs.document.dto;

import java.util.List;
import java.util.UUID;

public class IntegrityVerificationResponse {
    private UUID documentId;
    private Boolean isValid;
    private List<IntegrityProblem> problems;

    public static class IntegrityProblem {
        private UUID documentVersionId;
        private Integer versionNo;
        private String problem;

        public IntegrityProblem() {}

        public IntegrityProblem(UUID documentVersionId, Integer versionNo, String problem) {
            this.documentVersionId = documentVersionId;
            this.versionNo = versionNo;
            this.problem = problem;
        }

        public UUID getDocumentVersionId() { return documentVersionId; }
        public void setDocumentVersionId(UUID documentVersionId) { this.documentVersionId = documentVersionId; }
        public Integer getVersionNo() { return versionNo; }
        public void setVersionNo(Integer versionNo) { this.versionNo = versionNo; }
        public String getProblem() { return problem; }
        public void setProblem(String problem) { this.problem = problem; }
    }

    public IntegrityVerificationResponse() {}

    public IntegrityVerificationResponse(UUID documentId, Boolean isValid, List<IntegrityProblem> problems) {
        this.documentId = documentId;
        this.isValid = isValid;
        this.problems = problems;
    }

    public UUID getDocumentId() { return documentId; }
    public void setDocumentId(UUID documentId) { this.documentId = documentId; }
    public Boolean getIsValid() { return isValid; }
    public void setIsValid(Boolean isValid) { this.isValid = isValid; }
    public List<IntegrityProblem> getProblems() { return problems; }
    public void setProblems(List<IntegrityProblem> problems) { this.problems = problems; }
}

