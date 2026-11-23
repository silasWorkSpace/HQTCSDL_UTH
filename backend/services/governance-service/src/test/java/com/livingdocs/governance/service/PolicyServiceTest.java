package com.livingdocs.governance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.livingdocs.common.security.TenantContext;
import com.livingdocs.governance.dto.PolicyResponse;
import com.livingdocs.governance.dto.ResolvePolicyRequest;
import com.livingdocs.governance.dto.ResolvedPolicyResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class PolicyServiceTest {

    private JdbcTemplate jdbcTemplate;
    private ObjectMapper objectMapper;
    private PolicyService policyService;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        objectMapper = new ObjectMapper();
        policyService = new PolicyService(jdbcTemplate, objectMapper);
        TenantContext.set("demo");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void testResolvePolicy_DefaultFallbackWhenNoPolicies() {
        Mockito.when(jdbcTemplate.query(Mockito.anyString(), Mockito.<RowMapper<PolicyResponse>>any(), Mockito.any()))
                .thenReturn(List.of());

        ResolvePolicyRequest req = new ResolvePolicyRequest(UUID.randomUUID(), "order-service", "API_REFERENCE", "drift");
        ResolvedPolicyResponse res = policyService.resolvePolicy(req);

        assertNotNull(res);
        assertEquals("drift", res.getPolicyType());
        assertEquals("DEFAULT", res.getWinningScopeLevel());
        assertNotNull(res.getEffectiveConfig());
        assertTrue(res.getEffectiveConfig().containsKey("threshold"));
    }

    @Test
    void testResolvePolicy_SelectsMostRestrictiveDriftThreshold() {
        PolicyResponse wsPolicy = new PolicyResponse();
        wsPolicy.setId(UUID.randomUUID());
        wsPolicy.setPolicyType("drift");
        wsPolicy.setScopeLevel("WORKSPACE");
        wsPolicy.setConfigLevel("Administrator");
        wsPolicy.setConfig("{\"threshold\": 0.70, \"minSeverity\": \"Low\", \"exclusionRules\": [\"tests/**\"]}");

        PolicyResponse repoPolicy = new PolicyResponse();
        repoPolicy.setId(UUID.randomUUID());
        repoPolicy.setPolicyType("drift");
        repoPolicy.setScopeLevel("REPOSITORY");
        repoPolicy.setScopeId(UUID.randomUUID());
        repoPolicy.setConfigLevel("TechLead");
        repoPolicy.setConfig("{\"threshold\": 0.85, \"minSeverity\": \"High\", \"exclusionRules\": [\"*.spec.ts\"]}");

        Mockito.when(jdbcTemplate.query(Mockito.anyString(), Mockito.<RowMapper<PolicyResponse>>any(), Mockito.any()))
                .thenReturn(List.of(wsPolicy, repoPolicy));

        ResolvePolicyRequest req = new ResolvePolicyRequest(repoPolicy.getScopeId(), null, null, "drift");
        ResolvedPolicyResponse res = policyService.resolvePolicy(req);

        assertNotNull(res);
        assertEquals(0.85, ((Number) res.getEffectiveConfig().get("threshold")).doubleValue());
        assertEquals("High", res.getEffectiveConfig().get("minSeverity"));

        List<?> exclusions = (List<?>) res.getEffectiveConfig().get("exclusionRules");
        assertTrue(exclusions.contains("tests/**"));
        assertTrue(exclusions.contains("*.spec.ts"));
    }

    @Test
    void testResolvePolicy_AutoUpdateDisabledWins() {
        PolicyResponse wsPolicy = new PolicyResponse();
        wsPolicy.setId(UUID.randomUUID());
        wsPolicy.setPolicyType("auto_update");
        wsPolicy.setScopeLevel("WORKSPACE");
        wsPolicy.setConfigLevel("Administrator");
        wsPolicy.setConfig("{\"enabled\": true, \"confidenceThreshold\": 0.85, \"maxLinesChanged\": 200}");

        PolicyResponse repoPolicy = new PolicyResponse();
        repoPolicy.setId(UUID.randomUUID());
        repoPolicy.setPolicyType("auto_update");
        repoPolicy.setScopeLevel("REPOSITORY");
        repoPolicy.setScopeId(UUID.randomUUID());
        repoPolicy.setConfigLevel("Manager");
        repoPolicy.setConfig("{\"enabled\": false, \"confidenceThreshold\": 0.95, \"maxLinesChanged\": 50}");

        Mockito.when(jdbcTemplate.query(Mockito.anyString(), Mockito.<RowMapper<PolicyResponse>>any(), Mockito.any()))
                .thenReturn(List.of(wsPolicy, repoPolicy));

        ResolvePolicyRequest req = new ResolvePolicyRequest(repoPolicy.getScopeId(), null, null, "auto_update");
        ResolvedPolicyResponse res = policyService.resolvePolicy(req);

        assertNotNull(res);
        assertEquals(false, res.getEffectiveConfig().get("enabled"));
        assertEquals(0.95, ((Number) res.getEffectiveConfig().get("confidenceThreshold")).doubleValue());
        assertEquals(50, ((Number) res.getEffectiveConfig().get("maxLinesChanged")).intValue());
    }
}
