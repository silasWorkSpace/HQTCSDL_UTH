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

    private final String jwtSecret;

    public JwtAuthenticationFilter(String jwtSecret) {
        this.jwtSecret = jwtSecret != null ? jwtSecret : "LivingDocsSuperSecretKeyForJWTAuthentication2026LivingDocs!";
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        String tenantHeader = request.getHeader("X-Tenant-Id");

        if (tenantHeader != null && !tenantHeader.isBlank()) {
            TenantContext.setTenant(tenantHeader.trim());
        }

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                Claims claims = Jwts.parser()
                        .verifyWith(Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8)))
                        .build()
                        .parseSignedClaims(token)
                        .getPayload();

                String userIdStr = claims.getSubject();
                UUID userId = userIdStr != null ? UUID.fromString(userIdStr) : UUID.fromString("00000000-0000-0000-0000-000000000001");
                String role = claims.get("role", String.class);
                if (role == null) role = "Developer";
                String tenant = claims.get("tenant", String.class);
                if (tenant != null && !tenant.isBlank()) {
                    TenantContext.setTenant(tenant);
                }

                AuthenticatedUser authUser = new AuthenticatedUser(userId, claims.get("email", String.class), role, TenantContext.getTenant());
                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        authUser,
                        null,
                        Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + role))
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

