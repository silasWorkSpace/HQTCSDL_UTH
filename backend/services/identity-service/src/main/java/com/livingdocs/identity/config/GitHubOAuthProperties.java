package com.livingdocs.identity.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.ConstructorBinding;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Cấu hình GitHub OAuth Client phục vụ đăng nhập (FR-AUTH-02) và tích hợp Repositories.
 */
@ConfigurationProperties(prefix = "github")
public record GitHubOAuthProperties(
        @DefaultValue("") String clientId,
        @DefaultValue("") String clientSecret,
        @DefaultValue("http://localhost:5173/auth/callback") String redirectUri,
        @DefaultValue("read:user,user:email,repo") String scope) {

    @ConstructorBinding
    public GitHubOAuthProperties {
    }

    public GitHubOAuthProperties(String clientId, String clientSecret, String redirectUri) {
        this(clientId, clientSecret, redirectUri, "read:user,user:email,repo");
    }
}
