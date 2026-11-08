package com.livingdocs.notification.security;

import com.livingdocs.notification.config.TenantSchema;
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

    public JwtAuthFilter(String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                Claims claims = Jwts.parser().verifyWith(key).build()
                        .parseSignedClaims(header.substring(7)).getPayload();
                UUID userId = UUID.fromString(claims.getSubject());
                String tenant = TenantSchema.normalizeTenant(claims.get("tenant", String.class));
                List<String> roles = extractRoles(claims);
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
