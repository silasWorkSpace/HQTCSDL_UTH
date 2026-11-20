package com.livingdocs.notification.security;

import com.livingdocs.notification.config.TenantSchema;
import com.livingdocs.common.security.BrowserCookieSecurity;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

/**
 * Lọc JWT HS256 chung cho môi trường dev (JWT_SECRET) — claims sub, tenant, roles
 * (mục "JWT" trong quy ước kỹ thuật). Khóa HS256 của identity-service có thể thay
 * bằng RSA sau; khi libs/common-security của cụm Người 1 hoàn thiện sẽ chuyển sang
 * dùng thư viện chung để cả nhóm một cơ chế.
 */
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthFilter.class);

    private final SecretKey key;
    private final boolean secureCookies;

    public JwtAuthFilter(String secret, boolean secureCookies) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET phải có ít nhất 32 byte");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.secureCookies = secureCookies;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        BrowserCookieSecurity.ensureCsrfCookie(request, response, secureCookies);
        if (!BrowserCookieSecurity.validateCsrf(request)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "CSRF token is missing or invalid");
            return;
        }
        String token = BrowserCookieSecurity.token(request);
        if (request.getRequestURI().startsWith("/api/") && (token == null || token.isBlank())) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Authenticated session required");
            return;
        }
        if (token != null && !token.isBlank()) {
            try {
                Claims claims = Jwts.parser().verifyWith(key).build()
                        .parseSignedClaims(token).getPayload();
                if (!"livingdocs".equals(claims.getIssuer())) throw new IllegalArgumentException("JWT issuer không hợp lệ");
                UUID userId = UUID.fromString(claims.getSubject());
                String rawTenant = claims.get("tenant", String.class);
                if (rawTenant == null || !rawTenant.matches("[a-z0-9_]{2,30}")) throw new IllegalArgumentException("JWT tenant không hợp lệ");
                String tenant = TenantSchema.normalizeTenant(rawTenant);
                List<String> roles = extractRoles(claims);
                if (roles.isEmpty()) throw new IllegalArgumentException("JWT không có role");
                AuthContext.set(new AuthContext.CurrentUser(userId, tenant, roles));
                // Correlation ID theo dõi xuyên service (NFR-REL-02)
                String correlationId = request.getHeader("X-Correlation-Id");
                MDC.put("correlationId",
                        correlationId != null ? correlationId : UUID.randomUUID().toString());
                MDC.put("tenant", tenant);
            } catch (Exception e) {
                log.warn("JWT không hợp lệ trên {}: {}", request.getRequestURI(), e.getMessage());
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Token không hợp lệ");
                return;
            }
        }
        try {
            chain.doFilter(request, response);
        } finally {
            AuthContext.clear();
            MDC.clear();
        }
    }

    @SuppressWarnings("unchecked")
    private static List<String> extractRoles(Claims claims) {
        Object roles = claims.get("roles");
        if (roles instanceof List<?> list) {
            return list.stream().map(String::valueOf).toList();
        }
        Object role = claims.get("role"); // nếu identity-service dùng claim số ít
        return role != null ? List.of(String.valueOf(role)) : List.of();
    }
}
