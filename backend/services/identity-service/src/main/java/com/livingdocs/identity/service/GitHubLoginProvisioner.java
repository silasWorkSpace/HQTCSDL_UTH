package com.livingdocs.identity.service;

import com.livingdocs.common.audit.AuditService;
import com.livingdocs.common.error.ApiException;
import com.livingdocs.common.security.TenantContext;
import com.livingdocs.identity.config.IdentityProperties;
import com.livingdocs.identity.domain.UserRecord;
import com.livingdocs.identity.dto.TokenResponse;
import com.livingdocs.identity.repository.RoleRepository;
import com.livingdocs.identity.repository.UserRepository;
import com.livingdocs.identity.repository.WorkspaceRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/** Commits local user and session work before another service references the user. */
@Service
public class GitHubLoginProvisioner {
    private final WorkspaceRepository workspaces;
    private final UserRepository users;
    private final RoleRepository roles;
    private final IdentityProperties props;
    private final AuditService audit;
    private final TokenService tokens;

    public GitHubLoginProvisioner(WorkspaceRepository workspaces, UserRepository users, RoleRepository roles,
                                  IdentityProperties props, AuditService audit, TokenService tokens) {
        this.workspaces = workspaces;
        this.users = users;
        this.roles = roles;
        this.props = props;
        this.audit = audit;
        this.tokens = tokens;
    }

    @Transactional
    public TokenResponse provision(String tenant, String email, String displayName, long githubId) {
        return TenantContext.runWith(tenant, () -> {
            boolean existingWorkspaceUser = users.findByGithubUserId(githubId).isPresent()
                    || users.findByEmail(email).isPresent();
            if (!existingWorkspaceUser && !workspaces.allowsGitHubSignup(tenant)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Workspace GitHub signup is closed",
                        "Workspace chưa bật đăng ký GitHub. Hãy liên hệ quản trị viên để được mời.");
            }

            UserRepository.GithubUserProvisionResult result = users.findOrProvisionGithubUser(
                    email, displayName, String.valueOf(githubId), githubId);
            UserRecord user = result.user();
            if (result.isNew()) {
                roles.addWorkspaceRole(user.id(), props.defaultRole(), null);
                audit.record("user.registered_github", "user", user.id(), props.defaultRole(), "app_user", user.id(),
                        Map.of("email", email, "githubId", githubId));
            } else {
                audit.record("auth.github_link", "user", user.id(), null, "app_user", user.id(),
                        Map.of("email", email, "githubId", githubId));
            }

            if (!"active".equals(user.status())) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Account unavailable",
                        "Tài khoản đang bị khóa hoặc vô hiệu hóa.");
            }
            users.touchLastLogin(user.id());
            List<String> userRoles = roles.rolesOf(user.id());
            if (userRoles.isEmpty()) {
                roles.addWorkspaceRole(user.id(), props.defaultRole(), null);
                userRoles = List.of(props.defaultRole());
            }
            audit.record("auth.github_login", "user", user.id(), null, "app_user", user.id(),
                    Map.of("email", user.email(), "githubId", githubId));
            return tokens.issue(tenant, user, userRoles);
        });
    }
}
