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
import java.security.SecureRandom;
import java.util.Base64;
import java.time.Duration;
import java.time.temporal.ChronoUnit;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
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
import org.springframework.http.client.SimpleClientHttpRequestFactory;

/** Dang ky, dang nhap, lam moi token, dang xuat (FR-AUTH-01, 02, 05). */
@Service
public class AuthService {

    private static final Logger LOG = LoggerFactory.getLogger(AuthService.class);
    private static final SecureRandom STATE_RANDOM = new SecureRandom();
    private static final String OAUTH_STATE_PREFIX = "oauth:github:state:";
    private static final Duration OAUTH_STATE_TTL = Duration.ofMinutes(5);

    private final WorkspaceRepository workspaces;
    private final UserRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder encoder;
    private final TokenService tokens;
    private final AuditService audit;
    private final IdentityProperties props;
    private final GitHubOAuthProperties gitHubProps;
    private final GitHubLoginProvisioner githubLoginProvisioner;
    private final RestTemplate restTemplate;
    @Value("${livingdocs.integration.base-url}")
    private String integrationBaseUrl;
    @Autowired
    private StringRedisTemplate redis;

    public AuthService(WorkspaceRepository workspaces, UserRepository users, RoleRepository roles,
                       PasswordEncoder encoder, TokenService tokens, AuditService audit, IdentityProperties props,
                       GitHubOAuthProperties gitHubProps, GitHubLoginProvisioner githubLoginProvisioner) {
        this.workspaces = workspaces;
        this.users = users;
        this.roles = roles;
        this.encoder = encoder;
        this.tokens = tokens;
        this.audit = audit;
        this.props = props;
        this.gitHubProps = gitHubProps;
        this.githubLoginProvisioner = githubLoginProvisioner;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.of(5, ChronoUnit.SECONDS));
        // The GitHub connection callback calls Integration, which may make its own
        // GitHub API request before returning. Allow that nested request to finish.
        requestFactory.setReadTimeout(Duration.of(20, ChronoUnit.SECONDS));
        this.restTemplate = new RestTemplate(requestFactory);
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
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Phiên hết hạn", "Refresh cookie không tồn tại hoặc đã hết hạn.");
        }
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
        if (!targetTenant.matches("[a-z0-9_]{2,30}")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Workspace không hợp lệ", "Mã workspace không đúng định dạng.");
        }
        requireActiveWorkspace(targetTenant);
        String targetRedirectUri = gitHubProps.redirectUri();
        if (redirectUri != null && !redirectUri.isBlank() && !redirectUri.equals(targetRedirectUri)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Redirect URI không hợp lệ",
                    "Callback URL phải khớp với cấu hình máy chủ.");
        }
        String clientId = gitHubProps.clientId();
        if (clientId == null || clientId.isBlank() || gitHubProps.clientSecret() == null || gitHubProps.clientSecret().isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "GitHub OAuth chưa được cấu hình",
                    "Máy chủ chưa có GitHub OAuth credentials hợp lệ.");
        }

        if (redis == null) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "OAuth state storage unavailable",
                    "Không thể khởi tạo phiên OAuth an toàn.");
        }

        byte[] stateBytes = new byte[32];
        STATE_RANDOM.nextBytes(stateBytes);
        String state = Base64.getUrlEncoder().withoutPadding().encodeToString(stateBytes);
        redis.opsForValue().set(OAUTH_STATE_PREFIX + state, targetTenant, OAUTH_STATE_TTL);

        String scope = (gitHubProps.scope() != null && !gitHubProps.scope().isBlank())
                ? gitHubProps.scope() : "read:user,user:email,repo";

        String url = "https://github.com/login/oauth/authorize"
                + "?client_id=" + URLEncoder.encode(clientId, StandardCharsets.UTF_8)
                + "&redirect_uri=" + URLEncoder.encode(targetRedirectUri, StandardCharsets.UTF_8)
                + "&scope=" + URLEncoder.encode(scope, StandardCharsets.UTF_8)
                + "&state=" + URLEncoder.encode(state, StandardCharsets.UTF_8);

        return new GitHubAuthUrlResponse(url);
    }

    public TokenResponse handleGitHubCallback(GitHubCallbackRequest req) {
        String tenant = consumeOAuthState(req.state());
        requireActiveWorkspace(tenant);

        String targetRedirectUri = gitHubProps.redirectUri();
        if (req.redirectUri() != null && !req.redirectUri().isBlank() && !req.redirectUri().equals(targetRedirectUri)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Redirect URI không hợp lệ",
                    "Callback URL phải khớp với cấu hình máy chủ.");
        }

        long githubId;
        String email;
        String displayName;
        String ghAccessToken;

        {
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
            email = null;
            try {
                ResponseEntity<List> emailResp = restTemplate.exchange(
                        "https://api.github.com/user/emails", HttpMethod.GET, userEntity, List.class);
                List<?> emailsList = emailResp.getBody();
                int primaryEmailCount = 0;
                int verifiedEmailCount = 0;
                int eligibleEmailCount = 0;
                if (emailsList != null) for (Object item : emailsList) {
                    if (item instanceof Map<?, ?> m) {
                        boolean primary = Boolean.TRUE.equals(m.get("primary"));
                        boolean verified = Boolean.TRUE.equals(m.get("verified"));
                        if (primary) primaryEmailCount++;
                        if (verified) verifiedEmailCount++;
                        if (primary && verified) {
                            eligibleEmailCount++;
                            if (email == null) email = (String) m.get("email");
                        }
                    }
                }
                if (email == null || email.isBlank()) {
                    LOG.warn("GitHub /user/emails returned no primary verified email (entries={}, primary={}, verified={}, primaryVerified={})",
                            emailsList == null ? 0 : emailsList.size(), primaryEmailCount, verifiedEmailCount, eligibleEmailCount);
                }
            } catch (Exception e) {
                LOG.warn("Không thể xác nhận email GitHub: {}", e.getMessage());
            }
            if (email == null || email.isBlank()) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Email GitHub chưa xác thực",
                        "Tài khoản GitHub cần có email chính đã xác thực để đăng nhập.");
            }
            displayName = (name != null && !name.isBlank()) ? name.trim() : login;
        }

        final String finalEmail = normalize(email);
        final String finalDisplayName = displayName;
        final long finalGithubId = githubId;
        final String finalGhAccessToken = ghAccessToken;

        TokenResponse token = githubLoginProvisioner.provision(
                tenant, finalEmail, finalDisplayName, finalGithubId);
        String connectionId = createGitHubConnection(token.accessToken(), finalGhAccessToken);
        return new TokenResponse(
                token.accessToken(),
                token.refreshToken(),
                token.tokenType(),
                token.expiresIn(),
                connectionId
        );
    }

    private String createGitHubConnection(String appAccessToken, String githubAccessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(appAccessToken);
        headers.set("X-GitHub-Token", githubAccessToken);
        ResponseEntity<Map> response;
        try {
            response = restTemplate.postForEntity(
                    integrationBaseUrl + "/api/v1/integrations/github/connections/oauth",
                    new HttpEntity<>(null, headers), Map.class);
        } catch (Exception e) {
            LOG.error("Could not persist GitHub connection in integration service: {}", e.getMessage());
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Không thể lưu kết nối GitHub",
                    "Dịch vụ tích hợp GitHub hiện không khả dụng. Vui lòng thử đăng nhập lại.");
        }
        Object id = response.getBody() == null ? null : response.getBody().get("id");
        if (id == null) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Không thể lưu kết nối GitHub",
                    "Dịch vụ tích hợp không trả về mã kết nối hợp lệ.");
        }
        return id.toString();
    }

    /**
     * Lay danh sach kho ma nguon tu GitHub API dua vao access_token da duoc uy quyen.
     */
    public List<GitHubRepositoryDto> getGitHubRepositories(String token) {
        if (token == null || token.isBlank() || token.startsWith("mock_")) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "GitHub token không hợp lệ",
                    "Cần access token thật từ GitHub OAuth.");
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

    private String consumeOAuthState(String state) {
        if (state == null || state.isBlank() || redis == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "OAuth state không hợp lệ",
                    "Phiên đăng nhập đã hết hạn hoặc không hợp lệ.");
        }
        String tenant = redis.opsForValue().getAndDelete(OAUTH_STATE_PREFIX + state);
        if (tenant == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "OAuth state không hợp lệ",
                    "Phiên đăng nhập đã hết hạn hoặc đã được sử dụng.");
        }
        return tenant;
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
