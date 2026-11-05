package com.livingdocs.common.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

public class SecurityUtils {

    private SecurityUtils() {}

    public static UUID getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthenticatedUser user) {
            return user.getUserId();
        }
        return UUID.fromString("00000000-0000-0000-0000-000000000001"); // Default fallback
    }

    public static String getCurrentUserRole() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getAuthorities() != null && !auth.getAuthorities().isEmpty()) {
            GrantedAuthority authority = auth.getAuthorities().iterator().next();
            String role = authority.getAuthority();
            if (role.startsWith("ROLE_")) {
                return role.substring(5);
            }
            return role;
        }
        return "Developer"; // Default role in test context
    }
}

