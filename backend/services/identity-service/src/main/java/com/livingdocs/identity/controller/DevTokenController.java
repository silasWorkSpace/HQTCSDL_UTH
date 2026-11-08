package com.livingdocs.identity.controller;

import com.livingdocs.common.error.ApiException;
import com.livingdocs.common.security.Roles;
import com.livingdocs.common.security.TenantContext;
import com.livingdocs.identity.domain.UserRecord;
import com.livingdocs.identity.dto.DevTokenRequest;
import com.livingdocs.identity.dto.TokenResponse;
import com.livingdocs.identity.repository.UserRepository;
import com.livingdocs.identity.repository.WorkspaceRepository;
import com.livingdocs.identity.service.TokenService;
import com.livingdocs.common.security.LdSecurityProperties;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Cap token ma KHONG can mat khau, de ca nhom thu API ngay. Chi ton tai khi chay profile "dev".
 * Neu email ton tai trong workspace thi dung id that cua nguoi do, nguoc lai sinh id ngau nhien.
 */
@RestController
@Profile("dev")
@RequestMapping("/api/v1/auth")
public class DevTokenController {

    private static final Logger LOG = LoggerFactory.getLogger(DevTokenController.class);

    private final WorkspaceRepository workspaces;
    private final UserRepository users;
    private final TokenService tokens;
    private final LdSecurityProperties security;

    public DevTokenController(WorkspaceRepository workspaces, UserRepository users, TokenService tokens,
                              LdSecurityProperties security) {
        this.workspaces = workspaces;
        this.users = users;
        this.tokens = tokens;
        this.security = security;
    }

    @PostMapping("/dev-token")
    public TokenResponse devToken(@Valid @RequestBody DevTokenRequest request) {
        for (String role : request.roles()) {
            if (!Roles.ALL.contains(role)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Vai trò không hợp lệ",
                        "Vai trò phải là một trong: " + String.join(", ", Roles.ALL));
            }
        }
        String tenant = request.tenant().trim();
        if (tenant.startsWith("ws_")) {
            tenant = tenant.substring(3);
        }
        if (!workspaces.isActive(tenant)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy workspace", "Workspace không tồn tại.");
        }
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        final String effectiveTenant = tenant;
        UUID userId = TenantContext.runWith(effectiveTenant,
                () -> users.findByEmail(email).map(UserRecord::id).orElseGet(UUID::randomUUID));
        LOG.warn("DEV-TOKEN: cap token khong can mat khau cho {} ({}) o tenant {}", email, request.roles(),
                effectiveTenant);
        String access = tokens.issueAccessToken(userId, effectiveTenant, email, List.copyOf(request.roles()));
        return new TokenResponse(access, null, "Bearer", security.accessTokenTtl().toSeconds());
    }
}
