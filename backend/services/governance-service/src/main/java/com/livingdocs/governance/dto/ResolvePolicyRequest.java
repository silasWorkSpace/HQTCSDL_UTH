package com.livingdocs.governance.dto;

import java.util.UUID;

public class ResolvePolicyRequest {
    private UUID repositoryId;
    private String moduleName;
    private String docType;
    private String policyType;

    public ResolvePolicyRequest() {}

    public ResolvePolicyRequest(UUID repositoryId, String moduleName, String docType, String policyType) {
        this.repositoryId = repositoryId;
        this.moduleName = moduleName;
        this.docType = docType;
        this.policyType = policyType;
    }

    public UUID getRepositoryId() { return repositoryId; }
    public void setRepositoryId(UUID repositoryId) { this.repositoryId = repositoryId; }
    public String getModuleName() { return moduleName; }
    public void setModuleName(String moduleName) { this.moduleName = moduleName; }
    public String getDocType() { return docType; }
    public void setDocType(String docType) { this.docType = docType; }
    public String getPolicyType() { return policyType; }
    public void setPolicyType(String policyType) { this.policyType = policyType; }
}
