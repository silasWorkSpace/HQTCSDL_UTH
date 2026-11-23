package com.livingdocs.identity.controller;

import com.livingdocs.identity.dto.UpdateRolesRequest;
import com.livingdocs.identity.dto.UpdateStatusRequest;
import com.livingdocs.identity.dto.UserResponse;
import com.livingdocs.identity.service.UserAdminService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Chi Administrator (kiem tra phia server, NFR-SEC-02). */
@RestController
@RequestMapping("/api/v1/admin/users")
@PreAuthorize("hasRole('Administrator')")
public class AdminUserController {

    private final UserAdminService users;

    public AdminUserController(UserAdminService users) {
        this.users = users;
    }

    @GetMapping
    public List<UserResponse> list(@RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "20") int size) {
        return users.list(page, size);
    }

    @PutMapping("/{id}/roles")
    public UserResponse updateRoles(@PathVariable UUID id, @Valid @RequestBody UpdateRolesRequest request,
                                    @AuthenticationPrincipal Jwt jwt) {
        return users.updateRoles(id, request.roles(), jwt);
    }

    @PutMapping("/{id}/status")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateStatus(@PathVariable UUID id, @Valid @RequestBody UpdateStatusRequest request,
                             @AuthenticationPrincipal Jwt jwt) {
        users.updateStatus(id, request.status(), jwt);
    }
}
