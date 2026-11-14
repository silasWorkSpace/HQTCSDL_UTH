package com.livingdocs.identity.controller;

import com.livingdocs.identity.dto.GitHubAuthUrlResponse;
import com.livingdocs.identity.dto.GitHubCallbackRequest;
import com.livingdocs.identity.dto.GitHubRepositoryDto;
import com.livingdocs.identity.dto.LoginRequest;
import com.livingdocs.identity.dto.LogoutRequest;
import com.livingdocs.identity.dto.RefreshRequest;
import com.livingdocs.identity.dto.RegisterRequest;
import com.livingdocs.identity.dto.TokenResponse;
import com.livingdocs.identity.dto.UserResponse;
import com.livingdocs.identity.service.AuthService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @GetMapping("/github/url")
    public GitHubAuthUrlResponse getGitHubAuthUrl(
            @RequestParam(name = "tenant", required = false, defaultValue = "demo") String tenant,
            @RequestParam(name = "redirectUri", required = false) String redirectUri) {
        return auth.getGitHubAuthUrl(tenant, redirectUri);
    }

    @PostMapping("/github/callback")
    public TokenResponse handleGitHubCallback(@Valid @RequestBody GitHubCallbackRequest request) {
        return auth.handleGitHubCallback(request);
    }

    @GetMapping("/github/repos")
    public List<GitHubRepositoryDto> getGitHubRepos(
            @RequestHeader(name = "X-GitHub-Token", required = false) String headerToken,
            @RequestParam(name = "token", required = false) String paramToken) {
        String token = (headerToken != null && !headerToken.isBlank()) ? headerToken : paramToken;
        return auth.getGitHubRepositories(token);
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse register(@Valid @RequestBody RegisterRequest request) {
        return auth.register(request);
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest request) {
        return auth.login(request);
    }

    @PostMapping("/refresh")
    public TokenResponse refresh(@Valid @RequestBody RefreshRequest request) {
        return auth.refresh(request.refreshToken());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal Jwt jwt, @RequestBody(required = false) LogoutRequest request) {
        auth.logout(jwt, request == null ? null : request.refreshToken());
    }
}
