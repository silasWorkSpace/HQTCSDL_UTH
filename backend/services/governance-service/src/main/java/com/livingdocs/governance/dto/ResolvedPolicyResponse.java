package com.livingdocs.governance.dto;

import java.util.List;
import java.util.Map;

public class ResolvedPolicyResponse {
    private String policyType;
    private Map<String, Object> effectiveConfig;
    private String winningScopeLevel;
    private String winningScopeId;
    private String winningPolicyId;
    private String resolutionReason;
    private List<Map<String, Object>> candidatePolicies;

    public ResolvedPolicyResponse() {}

    public ResolvedPolicyResponse(String policyType, Map<String, Object> effectiveConfig, String winningScopeLevel, String winningScopeId, String winningPolicyId, String resolutionReason, List<Map<String, Object>> candidatePolicies) {
        this.policyType = policyType;
        this.effectiveConfig = effectiveConfig;
        this.winningScopeLevel = winningScopeLevel;
        this.winningScopeId = winningScopeId;
        this.winningPolicyId = winningPolicyId;
        this.resolutionReason = resolutionReason;
        this.candidatePolicies = candidatePolicies;
    }

    public String getPolicyType() { return policyType; }
    public void setPolicyType(String policyType) { this.policyType = policyType; }
    public Map<String, Object> getEffectiveConfig() { return effectiveConfig; }
    public void setEffectiveConfig(Map<String, Object> effectiveConfig) { this.effectiveConfig = effectiveConfig; }
    public String getWinningScopeLevel() { return winningScopeLevel; }
    public void setWinningScopeLevel(String winningScopeLevel) { this.winningScopeLevel = winningScopeLevel; }
    public String getWinningScopeId() { return winningScopeId; }
    public void setWinningScopeId(String winningScopeId) { this.winningScopeId = winningScopeId; }
    public String getWinningPolicyId() { return winningPolicyId; }
    public void setWinningPolicyId(String winningPolicyId) { this.winningPolicyId = winningPolicyId; }
    public String getResolutionReason() { return resolutionReason; }
    public void setResolutionReason(String resolutionReason) { this.resolutionReason = resolutionReason; }
    public List<Map<String, Object>> getCandidatePolicies() { return candidatePolicies; }
    public void setCandidatePolicies(List<Map<String, Object>> candidatePolicies) { this.candidatePolicies = candidatePolicies; }
}
