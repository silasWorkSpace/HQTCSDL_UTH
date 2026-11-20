package com.livingdocs.identity.controller;

import com.livingdocs.identity.dto.GitHubAuthUrlResponse;
import com.livingdocs.identity.dto.GitHubCallbackRequest;
import com.livingdocs.identity.dto.AuthSessionResponse;
import com.livingdocs.identity.dto.LoginRequest;
import com.livingdocs.identity.dto.RegisterRequest;
import com.livingdocs.identity.dto.TokenResponse;
import com.livingdocs.identity.dto.UserResponse;
import com.livingdocs.identity.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.CookieValue;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseCookie;
import org.springframework.beans.factory.annotation.Value;
import com.livingdocs.identity.config.IdentityProperties;
import java.time.Duration;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService auth;
    private final IdentityProperties identityProperties;
    private final boolean secureCookies;

    public AuthController(AuthService auth, IdentityProperties identityProperties,
                          @Value("${COOKIE_SECURE:true}") boolean secureCookies) {
        this.auth = auth;
        this.identityProperties = identityProperties;
        this.secureCookies = secureCookies;
    }

    @GetMapping("/github/url")
    public GitHubAuthUrlResponse getGitHubAuthUrl(
            @RequestParam(name = "tenant") String tenant,
            @RequestParam(name = "redirectUri", required = false) String redirectUri) {
        return auth.getGitHubAuthUrl(tenant, redirectUri);
    }

    @GetMapping("/csrf")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void csrfBootstrap() {
        // The shared CSRF filter sets a same-site readable token cookie on this safe request.
    }

    @PostMapping("/github/callback")
    public AuthSessionResponse handleGitHubCallback(@Valid @RequestBody GitHubCallbackRequest request,
                                                    HttpServletResponse response) {
        TokenResponse tokens = auth.handleGitHubCallback(request);
        setSessionCookies(tokens, response);
        return new AuthSessionResponse(true, tokens.githubConnectionId());
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse register(@Valid @RequestBody RegisterRequest request) {
        return auth.register(request);
    }

    @PostMapping("/login")
    public AuthSessionResponse login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        setSessionCookies(auth.login(request), response);
        return new AuthSessionResponse(true, null);
    }

    @PostMapping("/refresh")
    public AuthSessionResponse refresh(
            @CookieValue(name = "ld_refresh", required = false) String refreshToken,
            HttpServletResponse response) {
        try {
            setSessionCookies(auth.refresh(refreshToken), response);
            return new AuthSessionResponse(true, null);
        } catch (RuntimeException e) {
            clearSessionCookies(response);
            throw e;
        }
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal Jwt jwt,
                       @CookieValue(name = "ld_refresh", required = false) String refreshToken,
                       HttpServletResponse response) {
        auth.logout(jwt, refreshToken);
        clearSessionCookies(response);
    }

    private void setSessionCookies(TokenResponse tokens, HttpServletResponse response) {
        response.addHeader("Set-Cookie", ResponseCookie.from("ld_access", tokens.accessToken())
                .httpOnly(true).secure(secureCookies).path("/").sameSite("Lax")
                .maxAge(Duration.ofSeconds(tokens.expiresIn())).build().toString());
        response.addHeader("Set-Cookie", ResponseCookie.from("ld_refresh", tokens.refreshToken())
                .httpOnly(true).secure(secureCookies).path("/api/v1/auth").sameSite("Lax")
                .maxAge(identityProperties.refreshTokenTtl()).build().toString());
    }

    private void clearSessionCookies(HttpServletResponse response) {
        response.addHeader("Set-Cookie", ResponseCookie.from("ld_access", "")
                .httpOnly(true).secure(secureCookies).path("/").sameSite("Lax").maxAge(Duration.ZERO).build().toString());
        response.addHeader("Set-Cookie", ResponseCookie.from("ld_refresh", "")
                .httpOnly(true).secure(secureCookies).path("/api/v1/auth").sameSite("Lax")
                .maxAge(Duration.ZERO).build().toString());
    }
}
