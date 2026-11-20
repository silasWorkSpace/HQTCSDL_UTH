package com.livingdocs.governance.controller;

import com.livingdocs.governance.dto.*;
import com.livingdocs.governance.service.PolicyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/governance/policies")
public class PolicyController {

    private final PolicyService policyService;

    public PolicyController(PolicyService policyService) {
        this.policyService = policyService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('Developer', 'Staff', 'Manager', 'Technical Lead', 'Administrator')")
    public ResponseEntity<List<PolicyResponse>> listPolicies(
            @RequestParam(value = "policyType", required = false) String policyType,
            @RequestParam(value = "scopeLevel", required = false) String scopeLevel,
            @RequestParam(value = "scopeId", required = false) UUID scopeId) {
        return ResponseEntity.ok(policyService.listPolicies(policyType, scopeLevel, scopeId));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('Developer', 'Staff', 'Manager', 'Technical Lead', 'Administrator')")
    public ResponseEntity<PolicyResponse> getPolicyById(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(policyService.getPolicyById(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('Technical Lead', 'Manager', 'Administrator')")
    public ResponseEntity<PolicyResponse> createPolicy(@Valid @RequestBody CreatePolicyRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(policyService.createPolicy(req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('Technical Lead', 'Manager', 'Administrator')")
    public ResponseEntity<PolicyResponse> updatePolicy(
            @PathVariable("id") UUID id,
            @Valid @RequestBody UpdatePolicyRequest req) {
        return ResponseEntity.ok(policyService.updatePolicy(id, req));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('Technical Lead', 'Manager', 'Administrator')")
    public ResponseEntity<Void> deletePolicy(@PathVariable("id") UUID id) {
        policyService.deletePolicy(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/resolve")
    @PreAuthorize("hasAnyRole('Developer', 'Staff', 'Manager', 'Technical Lead', 'Administrator')")
    public ResponseEntity<ResolvedPolicyResponse> resolvePolicy(@RequestBody ResolvePolicyRequest req) {
        return ResponseEntity.ok(policyService.resolvePolicy(req));
    }
}
