package com.livingdocs.identity.service;

import com.livingdocs.common.audit.AuditService;
import com.livingdocs.common.error.ApiException;
import com.livingdocs.common.security.TenantContext;
import com.livingdocs.identity.config.GitHubOAuthProperties;
import com.livingdocs.identity.config.IdentityProperties;
import com.livingdocs.identity.domain.UserRecord;
import com.livingdocs.identity.dto.GitHubAuthUrlResponse;
import com.livingdocs.identity.dto.GitHubCallbackRequest;
import com.livingdocs.identity.dto.GitHubRepositoryDto;
import com.livingdocs.identity.dto.LoginRequest;
import com.livingdocs.identity.dto.RegisterRequest;
import com.livingdocs.identity.dto.TokenResponse;
import com.livingdocs.identity.dto.UserResponse;
import com.livingdocs.identity.repository.RoleRepository;
import com.livingdocs.identity.repository.UserRepository;
import com.livingdocs.identity.repository.WorkspaceRepository;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

/** Dang ky, dang nhap, lam moi token, dang xuat (FR-AUTH-01, 02, 05). */
@Service
public class AuthService {

    private static final Logger LOG = LoggerFactory.getLogger(AuthService.class);

    private final WorkspaceRepository workspaces;
    private final UserRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder encoder;
    private final TokenService tokens;
    private final AuditService audit;
    private final IdentityProperties props;
    private final GitHubOAuthProperties gitHubProps;
    private final RestTemplate restTemplate;

    public AuthService(WorkspaceRepository workspaces, UserRepository users, RoleRepository roles,
                       PasswordEncoder encoder, TokenService tokens, AuditService audit, IdentityProperties props,
                       GitHubOAuthProperties gitHubProps) {
        this.workspaces = workspaces;
        this.users = users;
        this.roles = roles;
        this.encoder = encoder;
        this.tokens = tokens;
        this.audit = audit;
        this.props = props;
        this.gitHubProps = gitHubProps;
        this.restTemplate = new RestTemplate();
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

    public GitHubAuthUrlResponse getGitHubAuthUrl(String tenant, String redirectUri) {
        String targetTenant = (tenant != null && !tenant.isBlank()) ? tenant : "demo";
        String targetRedirectUri = (redirectUri != null && !redirectUri.isBlank()) ? redirectUri : gitHubProps.redirectUri();
        String clientId = gitHubProps.clientId();

        // Neu chua cau hinh GITHUB_CLIENT_ID that (con la placeholder mac dinh)
        if (clientId == null || clientId.isBlank() || "your-github-client-id".equals(clientId)) {
            LOG.warn("Chua cau hinh GITHUB_CLIENT_ID hop le (hien tai: '{}'). Tu dong chuyen huong sang mock OAuth callback de tranh loi 404 tu GitHub.", clientId);
            String separator = targetRedirectUri.contains("?") ? "&" : "?";
            String mockUrl = targetRedirectUri + separator + "code=mock_github_code_" + targetTenant + "&state=" + URLEncoder.encode(targetTenant, StandardCharsets.UTF_8);
            return new GitHubAuthUrlResponse(mockUrl);
        }

        String scope = (gitHubProps.scope() != null && !gitHubProps.scope().isBlank())
                ? gitHubProps.scope() : "read:user,user:email,repo";

        String url = "https://github.com/login/oauth/authorize"
                + "?client_id=" + URLEncoder.encode(clientId, StandardCharsets.UTF_8)
                + "&redirect_uri=" + URLEncoder.encode(targetRedirectUri, StandardCharsets.UTF_8)
                + "&scope=" + URLEncoder.encode(scope, StandardCharsets.UTF_8)
                + "&state=" + URLEncoder.encode(targetTenant, StandardCharsets.UTF_8);

        return new GitHubAuthUrlResponse(url);
    }

    @Transactional
    public TokenResponse handleGitHubCallback(GitHubCallbackRequest req) {
        String tenant = (req.tenant() != null && !req.tenant().isBlank()) ? req.tenant() : "demo";
        requireActiveWorkspace(tenant);

        String targetRedirectUri = (req.redirectUri() != null && !req.redirectUri().isBlank()) ? req.redirectUri() : gitHubProps.redirectUri();

        long githubId;
        String email;
        String displayName;
        String ghAccessToken;

        // Ho tro mock code cho moi truong dev/test offline hoac khi chua co credentials that
        if (req.code().startsWith("mock_") || gitHubProps.clientId() == null || gitHubProps.clientId().isBlank()
                || "your-github-client-id".equals(gitHubProps.clientId())) {
            LOG.info("Su dung mock GitHub OAuth profile cho code: {}", req.code());
            githubId = 242319708L;
            email = "silas@livingdocs.internal";
            displayName = "silasWorkSpace";
            ghAccessToken = "mock_gh_access_token_" + tenant;
        } else {
            // 1. Goi https://github.com/login/oauth/access_token
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));

            Map<String, String> body = Map.of(
                    "client_id", gitHubProps.clientId(),
                    "client_secret", gitHubProps.clientSecret(),
                    "code", req.code(),
                    "redirect_uri", targetRedirectUri
            );

            HttpEntity<Map<String, String>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<Map> tokenResp;
            try {
                tokenResp = restTemplate.postForEntity("https://github.com/login/oauth/access_token", entity, Map.class);
            } catch (Exception e) {
                LOG.error("Loi ket noi GitHub OAuth token endpoint: {}", e.getMessage());
                throw new ApiException(HttpStatus.BAD_GATEWAY, "Lỗi kết nối GitHub", "Không thể kết nối đến máy chủ GitHub OAuth: " + e.getMessage());
            }

            Map<?, ?> tokenBody = tokenResp.getBody();
            if (tokenBody == null || !tokenBody.containsKey("access_token")) {
                String errorDesc = tokenBody != null && tokenBody.containsKey("error_description")
                        ? (String) tokenBody.get("error_description") : "Không nhận được access_token từ GitHub.";
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Đăng nhập GitHub thất bại", errorDesc);
            }
            ghAccessToken = (String) tokenBody.get("access_token");

            // 2. Goi https://api.github.com/user
            HttpHeaders userHeaders = new HttpHeaders();
            userHeaders.setBearerAuth(ghAccessToken);
            userHeaders.set("User-Agent", "LivingDocs-Identity-Service");
            userHeaders.setAccept(List.of(MediaType.parseMediaType("application/vnd.github+json")));

            HttpEntity<Void> userEntity = new HttpEntity<>(userHeaders);
            ResponseEntity<Map> userResp;
            try {
                userResp = restTemplate.exchange("https://api.github.com/user", HttpMethod.GET, userEntity, Map.class);
            } catch (Exception e) {
                LOG.error("Loi khi goi GitHub /user API: {}", e.getMessage());
                throw new ApiException(HttpStatus.BAD_GATEWAY, "Lỗi GitHub API", "Không thể lấy thông tin người dùng từ GitHub: " + e.getMessage());
            }

            Map<?, ?> ghUser = userResp.getBody();
            if (ghUser == null || !ghUser.containsKey("id")) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Lỗi người dùng GitHub", "Thông tin người dùng GitHub không hợp lệ.");
            }

            githubId = ((Number) ghUser.get("id")).longValue();
            String login = (String) ghUser.get("login");
            String name = (String) ghUser.get("name");
            email = (String) ghUser.get("email");

            // 3. Neu email private thi goi tiep /user/emails
            if (email == null || email.isBlank()) {
                try {
                    ResponseEntity<List> emailResp = restTemplate.exchange(
                            "https://api.github.com/user/emails", HttpMethod.GET, userEntity, List.class);
                    List<?> emailsList = emailResp.getBody();
                    if (emailsList != null) {
                        for (Object item : emailsList) {
                            if (item instanceof Map<?, ?> m) {
                                Boolean isPrimary = (Boolean) m.get("primary");
                                Boolean isVerified = (Boolean) m.get("verified");
                                if (Boolean.TRUE.equals(isPrimary) && Boolean.TRUE.equals(isVerified)) {
                                    email = (String) m.get("email");
                                    break;
                                }
                            }
                        }
                    }
                } catch (Exception e) {
                    LOG.warn("Khong the lay danh sach email tu GitHub: {}", e.getMessage());
                }
            }

            if (email == null || email.isBlank()) {
                email = login + "@users.noreply.github.com";
            }
            displayName = (name != null && !name.isBlank()) ? name.trim() : login;
        }

        final String finalEmail = normalize(email);
        final String finalDisplayName = displayName;
        final long finalGithubId = githubId;
        final String finalGhAccessToken = ghAccessToken;

        return TenantContext.runWith(tenant, () -> {
            UserRepository.GithubUserProvisionResult provision = users.findOrProvisionGithubUser(
                    finalEmail, finalDisplayName, String.valueOf(finalGithubId), finalGithubId);
            UserRecord user = provision.user();

            if (provision.isNew()) {
                roles.addWorkspaceRole(user.id(), props.defaultRole(), null);
                audit.record("user.registered_github", "user", user.id(), props.defaultRole(), "app_user", user.id(),
                        Map.of("email", finalEmail, "githubId", finalGithubId));
            } else {
                audit.record("auth.github_link", "user", user.id(), null, "app_user", user.id(),
                        Map.of("email", finalEmail, "githubId", finalGithubId));
            }

            if (!"active".equals(user.status())) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Tài khoản không khả dụng", "Tài khoản đang bị khóa hoặc vô hiệu hóa.");
            }

            users.touchLastLogin(user.id());
            List<String> userRoles = roles.rolesOf(user.id());
            if (userRoles.isEmpty()) {
                roles.addWorkspaceRole(user.id(), props.defaultRole(), null);
                userRoles = List.of(props.defaultRole());
            }

            audit.record("auth.github_login", "user", user.id(), null, "app_user", user.id(),
                    Map.of("email", user.email(), "githubId", finalGithubId));
            TokenResponse token = tokens.issue(tenant, user, userRoles);
            return new TokenResponse(
                    token.accessToken(),
                    token.refreshToken(),
                    token.tokenType(),
                    token.expiresIn(),
                    finalGhAccessToken
            );
        });
    }

    /**
     * Lay danh sach kho ma nguon tu GitHub API dua vao access_token da duoc uy quyen.
     */
    public List<GitHubRepositoryDto> getGitHubRepositories(String token) {
        if (token == null || token.isBlank() || token.startsWith("mock_")) {
            LOG.info("Tra ve danh sach mock repositories cho offline/dev");
            return List.of(
                    new GitHubRepositoryDto(101L, "livingdocs-core", "silas/livingdocs-core", "main", false, "https://github.com/silas/livingdocs-core", "Core platform for LivingDocs"),
                    new GitHubRepositoryDto(102L, "ecommerce-api", "silas/ecommerce-api", "main", true, "https://github.com/silas/ecommerce-api", "E-commerce Microservices Backend"),
                    new GitHubRepositoryDto(103L, "tsql-database-hqtcsdl", "silas/tsql-database-hqtcsdl", "master", false, "https://github.com/silas/tsql-database-hqtcsdl", "Database course project")
            );
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(token);
            headers.set("User-Agent", "LivingDocs-Identity-Service");
            headers.setAccept(List.of(MediaType.parseMediaType("application/vnd.github+json")));

            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<List> response = restTemplate.exchange(
                    "https://api.github.com/user/repos?sort=updated&per_page=100&type=all",
                    HttpMethod.GET,
                    entity,
                    List.class
            );

            List<?> body = response.getBody();
            if (body == null) {
                return List.of();
            }

            List<GitHubRepositoryDto> repos = new ArrayList<>();
            for (Object item : body) {
                if (item instanceof Map<?, ?> map) {
                    long id = map.get("id") instanceof Number n ? n.longValue() : 0L;
                    String name = (String) map.get("name");
                    String fullName = (String) map.get("full_name");
                    String defaultBranch = map.get("default_branch") != null ? (String) map.get("default_branch") : "main";
                    boolean isPrivate = Boolean.TRUE.equals(map.get("private"));
                    String htmlUrl = (String) map.get("html_url");
                    String description = (String) map.get("description");

                    repos.add(new GitHubRepositoryDto(id, name, fullName, defaultBranch, isPrivate, htmlUrl, description));
                }
            }
            return repos;
        } catch (Exception e) {
            LOG.error("Loi khi lay danh sach repositories tu GitHub API: {}", e.getMessage());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Lỗi GitHub API", "Không thể lấy danh sách kho mã nguồn từ GitHub: " + e.getMessage());
        }
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
