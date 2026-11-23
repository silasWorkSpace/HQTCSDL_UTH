package com.livingdocs.identity.service;

import com.livingdocs.common.security.LdSecurityProperties;
import com.livingdocs.common.security.RedisDenylistValidator;
import com.livingdocs.identity.config.IdentityProperties;
import com.livingdocs.identity.domain.UserRecord;
import com.livingdocs.identity.dto.TokenResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/** Cap access token (JWT) va refresh token (chuoi ngau nhien luu Redis), thu hoi token khi dang xuat. */
@Service
public class TokenService {

    private static final String REFRESH_PREFIX = "rt:";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final JwtEncoder encoder;
    private final LdSecurityProperties security;
    private final IdentityProperties identity;
    private final StringRedisTemplate redis;

    public TokenService(JwtEncoder encoder, LdSecurityProperties security, IdentityProperties identity,
                        StringRedisTemplate redis) {
        this.encoder = encoder;
        this.security = security;
        this.identity = identity;
        this.redis = redis;
    }

    /** Phien lam moi da duoc dung (va bi xoa khoi Redis). */
    public record RefreshSession(String tenant, UUID userId) {
    }

    public TokenResponse issue(String tenant, UserRecord user, List<String> roles) {
        String access = issueAccessToken(user.id(), tenant, user.email(), roles);
        String refresh = createRefreshToken(tenant, user.id());
        return new TokenResponse(access, refresh, "Bearer", security.accessTokenTtl().toSeconds());
    }

    public String issueAccessToken(UUID userId, String tenant, String email, List<String> roles) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(security.issuer())
                .issuedAt(now)
                .expiresAt(now.plus(security.accessTokenTtl()))
                .subject(userId.toString())
                .id(UUID.randomUUID().toString())
                .claim("tenant", tenant)
                .claim("email", email)
                .claim("roles", roles)
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    private String createRefreshToken(String tenant, UUID userId) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        redis.opsForValue().set(REFRESH_PREFIX + hash(token), tenant + ":" + userId, identity.refreshTokenTtl());
        return token;
    }

    /** Dung mot lan: lay ra roi xoa (xoay vong refresh token). Tra null neu khong hop le hoac het han. */
    public RefreshSession consumeRefreshToken(String token) {
        String value = redis.opsForValue().getAndDelete(REFRESH_PREFIX + hash(token));
        if (value == null) {
            return null;
        }
        int sep = value.indexOf(':');
        if (sep < 0) {
            return null;
        }
        try {
            return new RefreshSession(value.substring(0, sep), UUID.fromString(value.substring(sep + 1)));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public void deleteRefreshToken(String token) {
        redis.delete(REFRESH_PREFIX + hash(token));
    }

    /** Dua jti cua access token vao danh sach chan cho den khi token het han. */
    public void revokeAccessToken(Jwt jwt) {
        if (jwt.getId() == null || jwt.getExpiresAt() == null) {
            return;
        }
        Duration remaining = Duration.between(Instant.now(), jwt.getExpiresAt());
        if (!remaining.isNegative() && !remaining.isZero()) {
            redis.opsForValue().set(RedisDenylistValidator.KEY_PREFIX + jwt.getId(), "1", remaining);
        }
    }

    private static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
