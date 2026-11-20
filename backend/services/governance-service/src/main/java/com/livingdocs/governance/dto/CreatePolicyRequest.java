package com.livingdocs.governance.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.UUID;

public class CreatePolicyRequest {
    @NotBlank
    private String policyType;

    @NotBlank
    private String scopeLevel;

    private UUID scopeId;

    @NotBlank
    private String configLevel;

    @NotBlank
    private String config; // JSON string

    private Instant effectiveFrom;
    private Instant effectiveTo;

    public CreatePolicyRequest() {}

    public String getPolicyType() { return policyType; }
    public void setPolicyType(String policyType) { this.policyType = policyType; }
    public String getScopeLevel() { return scopeLevel; }
    public void setScopeLevel(String scopeLevel) { this.scopeLevel = scopeLevel; }
    public UUID getScopeId() { return scopeId; }
    public void setScopeId(UUID scopeId) { this.scopeId = scopeId; }
    public String getConfigLevel() { return configLevel; }
    public void setConfigLevel(String configLevel) { this.configLevel = configLevel; }
    public String getConfig() { return config; }
    public void setConfig(String config) { this.config = config; }
    public Instant getEffectiveFrom() { return effectiveFrom; }
    public void setEffectiveFrom(Instant effectiveFrom) { this.effectiveFrom = effectiveFrom; }
    public Instant getEffectiveTo() { return effectiveTo; }
    public void setEffectiveTo(Instant effectiveTo) { this.effectiveTo = effectiveTo; }
}
