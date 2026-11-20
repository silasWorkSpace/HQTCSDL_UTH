package com.livingdocs.governance.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.livingdocs.common.security.SecurityUtils;
import com.livingdocs.common.security.TenantContext;
import com.livingdocs.governance.dto.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Service
public class PolicyService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public PolicyService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    private void validateJson(String jsonStr) {
        if (jsonStr == null || jsonStr.isBlank()) {
            throw new IllegalArgumentException("Policy config JSON cannot be empty.");
        }
        try {
            objectMapper.readTree(jsonStr);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid policy config JSON: " + e.getMessage(), e);
        }
    }

    private void validatePolicyTypeAndScope(String policyType, String scopeLevel) {
        Set<String> allowedTypes = Set.of("drift", "auto_update", "auto_apply", "merge", "manager_required_type", "exclusion_rule", "retention");
        if (!allowedTypes.contains(policyType)) {
            throw new IllegalArgumentException("Unsupported policy type: " + policyType);
        }
        Set<String> allowedScopes = Set.of("WORKSPACE", "REPOSITORY", "MODULE", "DOC_TYPE");
        if (!allowedScopes.contains(scopeLevel.toUpperCase())) {
            throw new IllegalArgumentException("Unsupported scope level: " + scopeLevel + ". Expected WORKSPACE, REPOSITORY, MODULE, or DOC_TYPE.");
        }
    }

    public List<PolicyResponse> listPolicies(String policyType, String scopeLevel, UUID scopeId) {
        String schema = TenantContext.getSchema();
        StringBuilder sql = new StringBuilder(String.format(
            "SELECT id, policy_type, scope_level, scope_id, config_level, config, approved_by, effective_from, effective_to, created_at, updated_at " +
            "FROM [%s].[policy] WHERE 1=1 ", schema
        ));
        List<Object> params = new ArrayList<>();

        if (policyType != null && !policyType.isBlank()) {
            sql.append("AND policy_type = ? ");
            params.add(policyType);
        }
        if (scopeLevel != null && !scopeLevel.isBlank()) {
            sql.append("AND UPPER(scope_level) = ? ");
            params.add(scopeLevel.toUpperCase());
        }
        if (scopeId != null) {
            sql.append("AND scope_id = ? ");
            params.add(scopeId);
        }
        sql.append("ORDER BY created_at DESC");

        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> mapPolicyRow(rs), params.toArray());
    }

    public PolicyResponse getPolicyById(UUID id) {
        String schema = TenantContext.getSchema();
        String sql = String.format(
            "SELECT id, policy_type, scope_level, scope_id, config_level, config, approved_by, effective_from, effective_to, created_at, updated_at " +
            "FROM [%s].[policy] WHERE id = ?", schema
        );
        List<PolicyResponse> results = jdbcTemplate.query(sql, (rs, rowNum) -> mapPolicyRow(rs), id);
        if (results.isEmpty()) {
            throw new IllegalArgumentException("Policy not found: " + id);
        }
        return results.get(0);
    }

    @Transactional
    public PolicyResponse createPolicy(CreatePolicyRequest req) {
        validatePolicyTypeAndScope(req.getPolicyType(), req.getScopeLevel());
        validateJson(req.getConfig());

        String schema = TenantContext.getSchema();
        UUID userId = SecurityUtils.getCurrentUserId();
        UUID id = UUID.randomUUID();
        Instant now = Instant.now();
        Instant effectiveFrom = req.getEffectiveFrom() != null ? req.getEffectiveFrom() : now;

        String insertSql = String.format(
            "INSERT INTO [%s].[policy] (id, policy_type, scope_level, scope_id, config_level, config, approved_by, effective_from, effective_to, created_by, updated_by) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            schema
        );
        jdbcTemplate.update(insertSql,
            id,
            req.getPolicyType(),
            req.getScopeLevel().toUpperCase(),
            req.getScopeId(),
            req.getConfigLevel(),
            req.getConfig(),
            userId,
            Timestamp.from(effectiveFrom),
            req.getEffectiveTo() != null ? Timestamp.from(req.getEffectiveTo()) : null,
            userId,
            userId
        );
        return getPolicyById(id);
    }

    @Transactional
    public PolicyResponse updatePolicy(UUID id, UpdatePolicyRequest req) {
        validatePolicyTypeAndScope(req.getPolicyType(), req.getScopeLevel());
        validateJson(req.getConfig());

        String schema = TenantContext.getSchema();
        UUID userId = SecurityUtils.getCurrentUserId();

        String updateSql = String.format(
            "UPDATE [%s].[policy] SET policy_type = ?, scope_level = ?, scope_id = ?, config_level = ?, config = ?, effective_from = ?, effective_to = ?, updated_by = ?, updated_at = SYSUTCDATETIME() " +
            "WHERE id = ?",
            schema
        );
        int rows = jdbcTemplate.update(updateSql,
            req.getPolicyType(),
            req.getScopeLevel().toUpperCase(),
            req.getScopeId(),
            req.getConfigLevel(),
            req.getConfig(),
            req.getEffectiveFrom() != null ? Timestamp.from(req.getEffectiveFrom()) : null,
            req.getEffectiveTo() != null ? Timestamp.from(req.getEffectiveTo()) : null,
            userId,
            id
        );
        if (rows == 0) {
            throw new IllegalArgumentException("Policy not found: " + id);
        }
        return getPolicyById(id);
    }

    @Transactional
    public void deletePolicy(UUID id) {
        String schema = TenantContext.getSchema();
        String sql = String.format("DELETE FROM [%s].[policy] WHERE id = ?", schema);
        int rows = jdbcTemplate.update(sql, id);
        if (rows == 0) {
            throw new IllegalArgumentException("Policy not found: " + id);
        }
    }

    /**
     * Resolves effective policy according to hierarchy: WORKSPACE -> REPOSITORY -> MODULE -> DOC_TYPE.
     * Selects the most restrictive policy and returns the winning effective config and source provenance.
     */
    public ResolvedPolicyResponse resolvePolicy(ResolvePolicyRequest req) {
        String targetType = req.getPolicyType() != null && !req.getPolicyType().isBlank() ? req.getPolicyType() : "drift";
        List<PolicyResponse> allPolicies = listPolicies(targetType, null, null);

        // Filter active candidate policies by scope hierarchy
        List<PolicyResponse> candidates = new ArrayList<>();
        for (PolicyResponse p : allPolicies) {
            String s = p.getScopeLevel().toUpperCase();
            if ("WORKSPACE".equals(s)) {
                candidates.add(p);
            } else if ("REPOSITORY".equals(s) && req.getRepositoryId() != null && req.getRepositoryId().equals(p.getScopeId())) {
                candidates.add(p);
            } else if ("DOC_TYPE".equals(s)) {
                // If doc_type specified
                if (req.getDocType() != null) {
                    candidates.add(p);
                }
            } else if ("MODULE".equals(s) && req.getModuleName() != null) {
                candidates.add(p);
            }
        }

        if (candidates.isEmpty()) {
            // Return sensible default
            Map<String, Object> defaultConfig = getDefaultConfigForType(targetType);
            return new ResolvedPolicyResponse(targetType, defaultConfig, "DEFAULT", null, null,
                "No custom policy defined. Using system default baseline.", Collections.emptyList());
        }

        // Sort hierarchy: DOC_TYPE (4) -> MODULE (3) -> REPOSITORY (2) -> WORKSPACE (1)
        candidates.sort((a, b) -> Integer.compare(scopePriority(b.getScopeLevel()), scopePriority(a.getScopeLevel())));

        List<Map<String, Object>> candidateDetails = new ArrayList<>();
        for (PolicyResponse c : candidates) {
            try {
                Map<String, Object> parsed = objectMapper.readValue(c.getConfig(), Map.class);
                candidateDetails.add(Map.of(
                    "policyId", c.getId().toString(),
                    "scopeLevel", c.getScopeLevel(),
                    "configLevel", c.getConfigLevel(),
                    "config", parsed
                ));
            } catch (Exception ignored) {}
        }

        // Apply restrictive resolution
        return resolveRestrictive(targetType, candidates, candidateDetails);
    }

    private ResolvedPolicyResponse resolveRestrictive(String policyType, List<PolicyResponse> candidates, List<Map<String, Object>> candidateDetails) {
        Map<String, Object> merged = new LinkedHashMap<>();
        PolicyResponse mostSpecific = candidates.get(0);
        String reason = "Resolved from highest specificity scope: " + mostSpecific.getScopeLevel();

        try {
            if ("drift".equals(policyType)) {
                double highestThreshold = 0.0;
                String strictestSeverity = "Low";
                Set<String> combinedExclusions = new LinkedHashSet<>();
                PolicyResponse thresholdWinner = mostSpecific;

                for (PolicyResponse c : candidates) {
                    JsonNode node = objectMapper.readTree(c.getConfig());
                    if (node.has("threshold") && node.get("threshold").asDouble() > highestThreshold) {
                        highestThreshold = node.get("threshold").asDouble();
                        thresholdWinner = c;
                    }
                    if (node.has("minSeverity")) {
                        String sev = node.get("minSeverity").asText();
                        if (severityWeight(sev) > severityWeight(strictestSeverity)) {
                            strictestSeverity = sev;
                        }
                    }
                    if (node.has("exclusionRules") && node.get("exclusionRules").isArray()) {
                        for (JsonNode rule : node.get("exclusionRules")) {
                            combinedExclusions.add(rule.asText());
                        }
                    }
                }

                if (highestThreshold == 0.0) highestThreshold = 0.80;
                merged.put("threshold", highestThreshold);
                merged.put("minSeverity", strictestSeverity);
                merged.put("exclusionRules", new ArrayList<>(combinedExclusions));
                reason = String.format("Drift threshold clamped to most restrictive value (%.2f from policy %s at %s), with cumulative exclusion rules.",
                    highestThreshold, thresholdWinner.getId(), thresholdWinner.getScopeLevel());

                return new ResolvedPolicyResponse(policyType, merged, thresholdWinner.getScopeLevel(),
                    thresholdWinner.getScopeId() != null ? thresholdWinner.getScopeId().toString() : null,
                    thresholdWinner.getId().toString(), reason, candidateDetails);

            } else if ("auto_update".equals(policyType) || "auto_apply".equals(policyType)) {
                boolean allEnabled = true;
                double maxConfidence = 0.0;
                int minMaxLines = Integer.MAX_VALUE;
                PolicyResponse winner = mostSpecific;

                for (PolicyResponse c : candidates) {
                    JsonNode node = objectMapper.readTree(c.getConfig());
                    if (node.has("enabled") && !node.get("enabled").asBoolean()) {
                        allEnabled = false;
                        winner = c;
                    }
                    if (node.has("confidenceThreshold") && node.get("confidenceThreshold").asDouble() > maxConfidence) {
                        maxConfidence = node.get("confidenceThreshold").asDouble();
                    }
                    if (node.has("maxLinesChanged") && node.get("maxLinesChanged").asInt() < minMaxLines) {
                        minMaxLines = node.get("maxLinesChanged").asInt();
                    }
                }

                merged.put("enabled", allEnabled);
                merged.put("confidenceThreshold", maxConfidence > 0 ? maxConfidence : 0.90);
                merged.put("maxLinesChanged", minMaxLines != Integer.MAX_VALUE ? minMaxLines : 100);
                reason = allEnabled
                    ? "Auto-update enabled with strictest confidence threshold and line limit across scopes."
                    : String.format("Auto-update disabled by restrictive policy %s at %s.", winner.getId(), winner.getScopeLevel());

                return new ResolvedPolicyResponse(policyType, merged, winner.getScopeLevel(),
                    winner.getScopeId() != null ? winner.getScopeId().toString() : null,
                    winner.getId().toString(), reason, candidateDetails);

            } else if ("manager_required_type".equals(policyType)) {
                Set<String> requiredTypes = new LinkedHashSet<>();
                for (PolicyResponse c : candidates) {
                    JsonNode node = objectMapper.readTree(c.getConfig());
                    if (node.has("docTypes") && node.get("docTypes").isArray()) {
                        for (JsonNode t : node.get("docTypes")) {
                            requiredTypes.add(t.asText());
                        }
                    }
                }
                merged.put("docTypes", new ArrayList<>(requiredTypes));
                reason = "Cumulative union of all document types requiring manager approval across scopes.";
                return new ResolvedPolicyResponse(policyType, merged, mostSpecific.getScopeLevel(),
                    mostSpecific.getScopeId() != null ? mostSpecific.getScopeId().toString() : null,
                    mostSpecific.getId().toString(), reason, candidateDetails);

            } else {
                // Default: use the most specific candidate's config
                Map<String, Object> cfg = objectMapper.readValue(mostSpecific.getConfig(), Map.class);
                return new ResolvedPolicyResponse(policyType, cfg, mostSpecific.getScopeLevel(),
                    mostSpecific.getScopeId() != null ? mostSpecific.getScopeId().toString() : null,
                    mostSpecific.getId().toString(), reason, candidateDetails);
            }
        } catch (Exception e) {
            Map<String, Object> fallback = getDefaultConfigForType(policyType);
            return new ResolvedPolicyResponse(policyType, fallback, "FALLBACK", null, null,
                "Error resolving restrictive rules: " + e.getMessage() + ". Used safe default.", candidateDetails);
        }
    }

    private int scopePriority(String scope) {
        return switch (scope.toUpperCase()) {
            case "DOC_TYPE" -> 4;
            case "MODULE" -> 3;
            case "REPOSITORY" -> 2;
            case "WORKSPACE" -> 1;
            default -> 0;
        };
    }

    private int severityWeight(String sev) {
        return switch (sev.toLowerCase()) {
            case "critical" -> 4;
            case "high" -> 3;
            case "medium" -> 2;
            case "low" -> 1;
            default -> 0;
        };
    }

    private Map<String, Object> getDefaultConfigForType(String type) {
        return switch (type) {
            case "drift" -> Map.of("threshold", 0.75, "minSeverity", "Medium", "exclusionRules", List.of("tests/**", "*.test.*"));
            case "auto_update" -> Map.of("enabled", true, "scope", "NON_BREAKING", "maxLinesChanged", 100);
            case "auto_apply" -> Map.of("enabled", false, "confidenceThreshold", 0.95);
            case "manager_required_type" -> Map.of("docTypes", List.of("API_REFERENCE", "ADR"));
            case "merge" -> Map.of("requirePr", true, "requireSignoff", true);
            case "retention" -> Map.of("retentionDays", 365, "keepVersionsCount", 10);
            default -> Map.of("enabled", true);
        };
    }

    private PolicyResponse mapPolicyRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        PolicyResponse p = new PolicyResponse();
        p.setId(UUID.fromString(rs.getString("id")));
        p.setPolicyType(rs.getString("policy_type"));
        p.setScopeLevel(rs.getString("scope_level"));
        String scopeStr = rs.getString("scope_id");
        if (scopeStr != null) p.setScopeId(UUID.fromString(scopeStr));
        p.setConfigLevel(rs.getString("config_level"));
        p.setConfig(rs.getString("config"));
        String appStr = rs.getString("approved_by");
        if (appStr != null) p.setApprovedBy(UUID.fromString(appStr));
        p.setEffectiveFrom(rs.getTimestamp("effective_from") != null ? rs.getTimestamp("effective_from").toInstant() : null);
        p.setEffectiveTo(rs.getTimestamp("effective_to") != null ? rs.getTimestamp("effective_to").toInstant() : null);
        p.setCreatedAt(rs.getTimestamp("created_at").toInstant());
        p.setUpdatedAt(rs.getTimestamp("updated_at") != null ? rs.getTimestamp("updated_at").toInstant() : null);
        return p;
    }
}
