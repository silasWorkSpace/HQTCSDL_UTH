package com.livingdocs.common.security;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Cau hinh bao mat dung chung.
 *
 * @param jwtSecret      khoa HS256, lay tu bien moi truong JWT_SECRET, dai it nhat 32 ky tu
 * @param issuer         gia tri claim "iss"
 * @param accessTokenTtl thoi han access token
 * @param publicPaths    cac duong dan khong can dang nhap (them vao cac duong dan mac dinh cua actuator, swagger)
 */
@ConfigurationProperties(prefix = "livingdocs.security")
public record LdSecurityProperties(
        String jwtSecret,
        @DefaultValue("livingdocs") String issuer,
        @DefaultValue("15m") Duration accessTokenTtl,
        @DefaultValue List<String> publicPaths) {

    public SecretKey secretKey() {
        if (jwtSecret == null || jwtSecret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET phải dài ít nhất 32 ký tự");
        }
        return new SecretKeySpec(jwtSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }
}
