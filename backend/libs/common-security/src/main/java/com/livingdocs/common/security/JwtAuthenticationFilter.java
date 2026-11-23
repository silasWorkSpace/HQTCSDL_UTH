package com.livingdocs.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final String jwtSecret;
    private final boolean secureCookies;

    public JwtAuthenticationFilter(String jwtSecret) {
        this(jwtSecret, true);
    }

    public JwtAuthenticationFilter(String jwtSecret, boolean secureCookies) {
        if (jwtSecret == null || jwtSecret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET phải có ít nhất 32 byte");
        }
        this.jwtSecret = jwtSecret;
        this.secureCookies = secureCookies;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        BrowserCookieSecurity.ensureCsrfCookie(request, response, secureCookies);
        if (!BrowserCookieSecurity.validateCsrf(request)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "CSRF token is missing or invalid");
            return;
        }
        String token = BrowserCookieSecurity.token(request);
        TenantContext.clear();

        if (token != null && !token.isBlank()) {
            try {
                Claims claims = Jwts.parser()
                        .verifyWith(Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8)))
                        .build()
                        .parseSignedClaims(token)
                        .getPayload();

                if (!"livingdocs".equals(claims.getIssuer())) {
                    throw new IllegalArgumentException("JWT issuer không hợp lệ");
                }

                String userIdStr = claims.getSubject();
                UUID userId = userIdStr != null ? UUID.fromString(userIdStr) : UUID.fromString("00000000-0000-0000-0000-000000000001");

                String tenant = claims.get("tenant", String.class);
                if (!TenantContext.isValid(tenant)) {
                    throw new IllegalArgumentException("JWT tenant không hợp lệ");
                }
                TenantContext.set(tenant);

                java.util.List<SimpleGrantedAuthority> authorities = new java.util.ArrayList<>();
                Object rolesObj = claims.get("roles");
                String primaryRole = null;
                if (rolesObj instanceof java.util.List<?> list) {
                    for (Object r : list) {
                        if (r != null) {
                            String roleStr = r.toString().trim();
                            if (primaryRole == null) primaryRole = roleStr;
                            authorities.add(new SimpleGrantedAuthority("ROLE_" + roleStr));
                            authorities.add(new SimpleGrantedAuthority(roleStr));
                        }
                    }
                }
                Object singleRole = claims.get("role");
                if (singleRole != null) {
                    String roleStr = singleRole.toString().trim();
                    if (primaryRole == null) primaryRole = roleStr;
                    authorities.add(new SimpleGrantedAuthority("ROLE_" + roleStr));
                    authorities.add(new SimpleGrantedAuthority(roleStr));
                }

                if (authorities.isEmpty()) {
                    throw new IllegalArgumentException("JWT không có role");
                }

                AuthenticatedUser authUser = new AuthenticatedUser(userId, claims.get("email", String.class), primaryRole, tenant);
                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        authUser,
                        null,
                        authorities
                );
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (Exception ex) {
                // Invalid token - clear context
                SecurityContextHolder.clearContext();
                TenantContext.clear();
            }
        } else {
            SecurityContextHolder.clearContext();
            TenantContext.clear();
        }

        try {
            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}

