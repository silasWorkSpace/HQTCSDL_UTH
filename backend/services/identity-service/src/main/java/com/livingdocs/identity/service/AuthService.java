package com.livingdocs.identity.service;

import com.livingdocs.common.audit.AuditService;
import com.livingdocs.common.error.ApiException;
import com.livingdocs.common.security.TenantContext;
import com.livingdocs.identity.config.IdentityProperties;
import com.livingdocs.identity.domain.UserRecord;
import com.livingdocs.identity.dto.LoginRequest;
import com.livingdocs.identity.dto.RegisterRequest;
import com.livingdocs.identity.dto.TokenResponse;
import com.livingdocs.identity.dto.UserResponse;
import com.livingdocs.identity.repository.RoleRepository;
import com.livingdocs.identity.repository.UserRepository;
import com.livingdocs.identity.repository.WorkspaceRepository;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Dang ky, dang nhap, lam moi token, dang xuat (FR-AUTH-01, 02, 05). */
@Service
public class AuthService {

    private final WorkspaceRepository workspaces;
    private final UserRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder encoder;
    private final TokenService tokens;
    private final AuditService audit;
    private final IdentityProperties props;

    public AuthService(WorkspaceRepository workspaces, UserRepository users, RoleRepository roles,
                       PasswordEncoder encoder, TokenService tokens, AuditService audit, IdentityProperties props) {
        this.workspaces = workspaces;
        this.users = users;
        this.roles = roles;
        this.encoder = encoder;
        this.tokens = tokens;
        this.audit = audit;
        this.props = props;
    }

    @Transactional
    public UserResponse register(RegisterRequest req) {
        requireActiveWorkspace(req.tenant());
        return TenantContext.runWith(req.tenant(), () -> {
            String email = normalize(req.email());
            if (users.findByEmail(email).isPresent()) {
                throw emailTaken();
            }
            UUID id;
            try {
                id = users.insert(email, req.displayName().trim(), encoder.encode(req.password()));
            } catch (DuplicateKeyException e) {
                throw emailTaken();
            }
            roles.addWorkspaceRole(id, props.defaultRole(), null);
            audit.record("user.registered", "user", id, props.defaultRole(), "app_user", id, Map.of("email", email));
            return new UserResponse(id.toString(), email, req.displayName().trim(), "active", "vi",
                    List.of(props.defaultRole()));
        });
    }

    public TokenResponse login(LoginRequest req) {
        requireActiveWorkspace(req.tenant());
        return TenantContext.runWith(req.tenant(), () -> {
            UserRecord user = users.findByEmail(normalize(req.email())).orElse(null);
            // Cung mot thong bao cho "khong co tai khoan" va "sai mat khau" de khong lo tai khoan nao ton tai
            if (user == null || user.passwordHash() == null || !encoder.matches(req.password(), user.passwordHash())) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Đăng nhập thất bại", "Email hoặc mật khẩu không đúng.");
            }
            if (!"active".equals(user.status())) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Tài khoản không khả dụng",
                        "Tài khoản đang bị khóa hoặc vô hiệu hóa.");
            }
            users.touchLastLogin(user.id());
            List<String> userRoles = roles.rolesOf(user.id());
            audit.record("auth.login", "user", user.id(), null, "app_user", user.id(), Map.of("email", user.email()));
            return tokens.issue(req.tenant(), user, userRoles);
        });
    }

    public TokenResponse refresh(String refreshToken) {
        TokenService.RefreshSession session = tokens.consumeRefreshToken(refreshToken);
        if (session == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Phiên hết hạn", "Refresh token không hợp lệ hoặc đã hết hạn.");
        }
        requireActiveWorkspace(session.tenant());
        return TenantContext.runWith(session.tenant(), () -> {
            UserRecord user = users.findById(session.userId())
                    .filter(u -> "active".equals(u.status()))
                    .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Phiên hết hạn",
                            "Tài khoản không còn khả dụng."));
            return tokens.issue(session.tenant(), user, roles.rolesOf(user.id()));
        });
    }

    /** Goi trong request da xac thuc (TenantContext da co tu JWT). */
    public void logout(Jwt jwt, String refreshToken) {
        tokens.revokeAccessToken(jwt);
        if (refreshToken != null && !refreshToken.isBlank()) {
            tokens.deleteRefreshToken(refreshToken);
        }
        UUID userId = UUID.fromString(jwt.getSubject());
        audit.record("auth.logout", "user", userId, null, "app_user", userId, null);
    }

    private void requireActiveWorkspace(String tenant) {
        if (!workspaces.isActive(tenant)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy workspace", "Workspace không tồn tại hoặc không hoạt động.");
        }
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static ApiException emailTaken() {
        return new ApiException(HttpStatus.CONFLICT, "Email đã được dùng", "Email này đã đăng ký trong workspace.");
    }
}
