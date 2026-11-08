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
import java.util.Collections;
import java.util.UUID;

public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String DEFAULT_SECRET = "dev-only-secret-change-me-dev-only-secret-change-me";
    private final String jwtSecret;

    public JwtAuthenticationFilter(String jwtSecret) {
        this.jwtSecret = (jwtSecret != null && !jwtSecret.isBlank()) ? jwtSecret : DEFAULT_SECRET;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        String tenantHeader = request.getHeader("X-Tenant-Id");
        if (tenantHeader == null || tenantHeader.isBlank()) {
            tenantHeader = request.getHeader("X-Tenant");
        }

        if (tenantHeader != null && !tenantHeader.isBlank()) {
            TenantContext.setTenant(tenantHeader.trim());
        }

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7).trim();
            try {
                Claims claims = Jwts.parser()
                        .verifyWith(Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8)))
                        .build()
                        .parseSignedClaims(token)
                        .getPayload();

                String userIdStr = claims.getSubject();
                UUID userId = userIdStr != null ? UUID.fromString(userIdStr) : UUID.fromString("00000000-0000-0000-0000-000000000001");

                String tenant = claims.get("tenant", String.class);
                if (tenant != null && !tenant.isBlank()) {
                    TenantContext.setTenant(tenant);
                }

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
                    primaryRole = "Developer";
                    authorities.add(new SimpleGrantedAuthority("ROLE_Developer"));
                    authorities.add(new SimpleGrantedAuthority("Developer"));
                }

                AuthenticatedUser authUser = new AuthenticatedUser(userId, claims.get("email", String.class), primaryRole, TenantContext.getTenant());
                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        authUser,
                        null,
                        authorities
                );
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (Exception ex) {
                // Invalid token - clear context
                SecurityContextHolder.clearContext();
            }
        }

        try {
            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}

