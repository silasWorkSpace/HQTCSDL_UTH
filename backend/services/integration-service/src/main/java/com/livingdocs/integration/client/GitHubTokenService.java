package com.livingdocs.integration.client;

import io.jsonwebtoken.Jwts;
import org.bouncycastle.asn1.pkcs.PrivateKeyInfo;
import org.bouncycastle.openssl.PEMParser;
import org.bouncycastle.openssl.PEMKeyPair;
import org.bouncycastle.openssl.jcajce.JcaPEMKeyConverter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
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
        this.privateKeyPem = normalizePem(privateKeyPem);
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

        if (privateKeyPem == null || privateKeyPem.isBlank()) {
            throw new IllegalStateException("GitHub App private key chưa được cấu hình");
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

        throw new IllegalStateException("Không lấy được GitHub installation token");
    }

    /**
     * Tạo GitHub App JWT bằng Private Key RS256 (hạn 10 phút theo quy định của GitHub).
     */
    /** Fetch installation metadata using an app JWT (installation tokens cannot access this endpoint). */
    public Map<?, ?> getInstallation(String installationId) {
        if (installationId == null || !installationId.matches("[0-9]{1,20}")) {
            throw new IllegalArgumentException("A numeric GitHub App installation id is required");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(generateAppJwt());
        headers.set("Accept", "application/vnd.github+json");
        HttpEntity<Void> request = new HttpEntity<>(headers);
        String url = apiUrl + "/app/installations/" + installationId;
        return restTemplate.exchange(url, HttpMethod.GET, request, Map.class).getBody();
    }

    public String generateAppJwt() {
        if (privateKeyPem == null || privateKeyPem.isBlank()) throw new IllegalStateException("GitHub App private key chưa được cấu hình");
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

    static String normalizePem(String rawPem) {
        if (rawPem == null || rawPem.isBlank()) {
            return rawPem;
        }
        String pem = rawPem.trim();
        // Xóa dấu nháy bao quanh nếu cấu hình trong .env hoặc file cấu hình bị bọc ngoặc kép/đơn
        while ((pem.startsWith("\"") && pem.endsWith("\"")) || (pem.startsWith("'") && pem.endsWith("'"))) {
            pem = pem.substring(1, pem.length() - 1).trim();
        }
        // Trường hợp chuỗi PEM được mã hóa Base64 toàn bộ
        if (!pem.contains("-----BEGIN") && !pem.contains("-----END")) {
            try {
                byte[] decoded = Base64.getDecoder().decode(pem.replaceAll("\\s+", ""));
                String candidate = new String(decoded, StandardCharsets.UTF_8);
                if (candidate.contains("-----BEGIN")) {
                    pem = candidate.trim();
                }
            } catch (Exception ignored) {
                // Không phải base64, giữ nguyên
            }
        }
        // Chuyển ký tự xuống dòng thoát chuỗi (\n, \r\n, \r) thành ký tự xuống dòng thực tế
        pem = pem.replace("\\r\\n", "\n").replace("\\n", "\n").replace("\\r", "\n");
        return pem.trim();
    }

    private PrivateKey parsePrivateKey(String rawPem) throws Exception {
        String pem = normalizePem(rawPem);
        try (PEMParser pemParser = new PEMParser(new StringReader(pem))) {
            Object object = pemParser.readObject();
            JcaPEMKeyConverter converter = new JcaPEMKeyConverter();
            if (object instanceof PrivateKeyInfo pki) {
                return converter.getPrivateKey(pki);
            }
            if (object instanceof PEMKeyPair keyPair) {
                return converter.getKeyPair(keyPair).getPrivate();
            }
            if (object instanceof KeyPair kp) {
                return kp.getPrivate();
            }
            if (object instanceof PrivateKey pk) {
                return pk;
            }
            if (object == null) {
                PrivateKey fallbackKey = tryParsePkcs8(pem);
                if (fallbackKey != null) {
                    return fallbackKey;
                }
                throw new IllegalArgumentException("PEM parser returned null. Vui lòng kiểm tra định dạng GITHUB_APP_PRIVATE_KEY_PEM.");
            }
            throw new IllegalArgumentException("PEM private key must be unencrypted PKCS#1 or PKCS#8, found: " + object.getClass().getName());
        }
    }

    private PrivateKey tryParsePkcs8(String pem) {
        try {
            if (pem.contains("-----BEGIN PRIVATE KEY-----")) {
                String clean = pem.replace("-----BEGIN PRIVATE KEY-----", "")
                        .replace("-----END PRIVATE KEY-----", "")
                        .replaceAll("\\s+", "");
                byte[] der = Base64.getDecoder().decode(clean);
                KeyFactory kf = KeyFactory.getInstance("RSA");
                return kf.generatePrivate(new PKCS8EncodedKeySpec(der));
            }
        } catch (Exception ignored) {
        }
        return null;
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
