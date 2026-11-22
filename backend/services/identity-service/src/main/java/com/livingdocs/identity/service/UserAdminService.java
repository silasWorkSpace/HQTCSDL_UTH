package com.livingdocs.identity.service;

import com.livingdocs.common.audit.AuditService;
import com.livingdocs.common.error.ApiException;
import com.livingdocs.common.security.LdSecurityProperties;
import com.livingdocs.common.security.Roles;
import com.livingdocs.identity.domain.UserRecord;
import com.livingdocs.identity.dto.UserResponse;
import com.livingdocs.identity.repository.RoleRepository;
import com.livingdocs.identity.repository.UserRepository;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Quan ly nguoi dung va vai tro cho Administrator (FR-ADM-01, FR-ADM-13). */
@Service
public class UserAdminService {

    private static final Set<String> STATUSES = Set.of("active", "locked", "disabled");

    private final UserRepository users;
    private final RoleRepository roles;
    private final AuditService audit;
    private final TokenService tokens;
    private final LdSecurityProperties security;

    public UserAdminService(UserRepository users, RoleRepository roles, AuditService audit,
                            TokenService tokens, LdSecurityProperties security) {
        this.users = users;
        this.roles = roles;
        this.audit = audit;
        this.tokens = tokens;
        this.security = security;
    }

    public UserResponse me(UUID userId) {
        return toResponse(find(userId));
    }

    public List<UserResponse> list(int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        int offset = Math.max(page, 0) * safeSize;
        return users.list(offset, safeSize).stream().map(this::toResponse).toList();
    }

    @Transactional
    public UserResponse updateRoles(UUID userId, List<String> newRoles, Jwt actor) {
        UserRecord user = find(userId);
        List<String> distinct = newRoles.stream().map(String::trim).distinct().toList();
        for (String role : distinct) {
            if (!Roles.ALL.contains(role)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Vai trò không hợp lệ",
                        "Vai trò phải là một trong: " + String.join(", ", Roles.ALL));
            }
        }
        UUID actorId = UUID.fromString(actor.getSubject());
        // granted_by la khoa ngoai toi app_user, chi dat khi nguoi cap quyen co that trong workspace
        UUID grantedBy = users.findById(actorId).isPresent() ? actorId : null;
        roles.deleteWorkspaceRoles(userId);
        for (String role : distinct) {
            roles.addWorkspaceRole(userId, role, grantedBy);
        }
        audit.record("user.roles_changed", "user", actorId, null, "app_user", userId,
                Map.of("roles", String.join(",", distinct)));
        return toResponse(user);
    }

    @Transactional
    public void updateStatus(UUID userId, String status, Jwt actor) {
        if (!STATUSES.contains(status)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Trạng thái không hợp lệ",
                    "Trạng thái phải là một trong: active, locked, disabled");
        }
        find(userId);
        users.updateStatus(userId, status);
        UUID actorId = UUID.fromString(actor.getSubject());
        audit.record("user.status_changed", "user", actorId, null, "app_user", userId, Map.of("status", status));
    }

    @Transactional
    public UserResponse switchRole(UUID userId, String newRole, Jwt actor, HttpServletResponse response) {
        String role = newRole != null ? newRole.trim() : "";
        if (!Roles.ALL.contains(role)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Vai trò không hợp lệ",
                    "Vai trò phải là một trong: " + String.join(", ", Roles.ALL));
        }
        UserRecord user = find(userId);
        roles.deleteWorkspaceRoles(userId);
        roles.addWorkspaceRole(userId, role, userId);

        String tenant = actor != null ? actor.getClaim("tenant") : "demo";
        if (tenant == null || tenant.isBlank()) {
            tenant = "demo";
        }
        String access = tokens.issueAccessToken(userId, tenant, user.email(), List.of(role));
        if (response != null) {
            response.addHeader("Set-Cookie", ResponseCookie.from("ld_access", access)
                    .httpOnly(true).secure(false).path("/").sameSite("Lax")
                    .maxAge(security.accessTokenTtl()).build().toString());
        }
        audit.record("user.role_switched", "user", userId, null, "app_user", userId,
                Map.of("role", role));
        return toResponse(user);
    }

    private UserRecord find(UUID userId) {
        return users.findById(userId).orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng", "Người dùng không tồn tại."));
    }

    private UserResponse toResponse(UserRecord u) {
        return new UserResponse(u.id().toString(), u.email(), u.displayName(), u.status(), u.language(),
                roles.rolesOf(u.id()));
    }
}
