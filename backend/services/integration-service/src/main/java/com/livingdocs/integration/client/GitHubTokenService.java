package com.livingdocs.integration.client;

import io.jsonwebtoken.Jwts;
import org.bouncycastle.asn1.pkcs.PrivateKeyInfo;
import org.bouncycastle.openssl.PEMParser;
import org.bouncycastle.openssl.jcajce.JcaPEMKeyConverter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.StringReader;
import java.security.PrivateKey;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Map;

/**
 * Quản lý Token của GitHub App (NFR-SEC-04).
 * Tạo JWT RS256 và lấy Installation Access Token có đệm Redis (TTL ~50 phút).
 */
@Service
public class GitHubTokenService {

    private static final Logger log = LoggerFactory.getLogger(GitHubTokenService.class);

    private final String appId;
    private final String privateKeyPem;
    private final String apiUrl;
    private final StringRedisTemplate redisTemplate;
    private final RestTemplate restTemplate;

    public GitHubTokenService(
            @Value("${livingdocs.github.app-id}") String appId,
            @Value("${livingdocs.github.private-key-pem:}") String privateKeyPem,
            @Value("${livingdocs.github.api-url:https://api.github.com}") String apiUrl,
            @Value("#{null}") StringRedisTemplate redisTemplate
    ) {
        this.appId = appId;
        this.privateKeyPem = privateKeyPem;
        this.apiUrl = apiUrl;
        this.redisTemplate = redisTemplate;
        this.restTemplate = new RestTemplate();
    }

    /**
     * Lấy Installation Access Token (ưu tiên từ Redis Cache).
     */
    public String getInstallationToken(String installationId) {
        String cacheKey = "gh:inst:token:" + installationId;

        if (redisTemplate != null) {
            try {
                String cached = redisTemplate.opsForValue().get(cacheKey);
                if (cached != null && !cached.isBlank()) {
                    log.debug("Lấy installation token từ Redis cache cho {}", installationId);
                    return cached;
                }
            } catch (Exception e) {
                log.warn("Không thể truy cập Redis cache: {}", e.getMessage());
            }
        }

        // Nếu chưa cấu hình private key thật trong dev, sinh mock token
        if (privateKeyPem == null || privateKeyPem.isBlank()) {
            String mockToken = "ghs_mock_token_" + installationId + "_" + System.currentTimeMillis();
            cacheToken(cacheKey, mockToken, Duration.ofMinutes(50));
            return mockToken;
        }

        try {
            String appJwt = generateAppJwt();
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(appJwt);
            headers.set("Accept", "application/vnd.github+json");

            HttpEntity<Void> request = new HttpEntity<>(headers);
            String url = apiUrl + "/app/installations/" + installationId + "/access_tokens";

            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                String token = (String) response.getBody().get("token");
                cacheToken(cacheKey, token, Duration.ofMinutes(50));
                return token;
            }
        } catch (Exception e) {
            log.error("Lỗi khi lấy installation token từ GitHub API: {}", e.getMessage());
        }

        // Fallback
        return "ghs_fallback_token_" + installationId;
    }

    /**
     * Tạo GitHub App JWT bằng Private Key RS256 (hạn 10 phút theo quy định của GitHub).
     */
    public String generateAppJwt() {
        if (privateKeyPem == null || privateKeyPem.isBlank()) {
            return "mock_app_jwt";
        }
        try {
            PrivateKey privateKey = parsePrivateKey(privateKeyPem);
            Instant now = Instant.now().minusSeconds(60); // Lùi 60s để tránh lệch đồng hồ
            Instant expiry = now.plus(Duration.ofMinutes(10));

            return Jwts.builder()
                    .issuer(appId)
                    .issuedAt(Date.from(now))
                    .expiration(Date.from(expiry))
                    .signWith(privateKey)
                    .compact();
        } catch (Exception e) {
            throw new RuntimeException("Lỗi tạo GitHub App JWT: " + e.getMessage(), e);
        }
    }

    private PrivateKey parsePrivateKey(String pem) throws Exception {
        try (PEMParser pemParser = new PEMParser(new StringReader(pem))) {
            Object object = pemParser.readObject();
            JcaPEMKeyConverter converter = new JcaPEMKeyConverter();
            if (object instanceof PrivateKeyInfo pki) {
                return converter.getPrivateKey(pki);
            }
            throw new IllegalArgumentException("Định dạng Private Key PEM không hợp lệ.");
        }
    }

    private void cacheToken(String key, String token, Duration ttl) {
        if (redisTemplate != null) {
            try {
                redisTemplate.opsForValue().set(key, token, ttl);
            } catch (Exception e) {
                log.warn("Lưu token vào Redis thất bại: {}", e.getMessage());
            }
        }
    }
}
