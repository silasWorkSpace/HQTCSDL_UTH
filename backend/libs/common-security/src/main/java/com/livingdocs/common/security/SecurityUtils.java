package com.livingdocs.common.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;
import org.springframework.security.authentication.AnonymousAuthenticationToken;

public class SecurityUtils {

    private SecurityUtils() {}

    public static UUID getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)
                && auth.getPrincipal() instanceof AuthenticatedUser user) {
            return user.getUserId();
        }
        throw new IllegalStateException("Không tìm thấy user đã xác thực trong request hiện tại");
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
        throw new IllegalStateException("Không tìm thấy role đã xác thực trong request hiện tại");
    }
}

