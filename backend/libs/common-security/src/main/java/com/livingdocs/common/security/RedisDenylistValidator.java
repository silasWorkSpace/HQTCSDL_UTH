package com.livingdocs.common.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

/** Tu choi access token da bi thu hoi (dang xuat). Khoa Redis: deny:jti. */
public class RedisDenylistValidator implements OAuth2TokenValidator<Jwt> {

    public static final String KEY_PREFIX = "deny:";
    private static final Logger LOG = LoggerFactory.getLogger(RedisDenylistValidator.class);

    private final StringRedisTemplate redis;

    public RedisDenylistValidator(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        String jti = jwt.getId();
        if (jti == null) {
            return OAuth2TokenValidatorResult.success();
        }
        try {
            if (Boolean.TRUE.equals(redis.hasKey(KEY_PREFIX + jti))) {
                return OAuth2TokenValidatorResult.failure(
                        new OAuth2Error("invalid_token", "Token đã bị thu hồi", null));
            }
        } catch (RuntimeException e) {
            // Redis tam thoi loi: cho qua de he thong khong dung han. Chap nhan rui ro nay o giai doan dev.
            LOG.warn("Khong kiem tra duoc denylist: {}", e.getMessage());
        }
        return OAuth2TokenValidatorResult.success();
    }
}
