package com.livingdocs.common.security;

import java.util.UUID;

public class AuthenticatedUser {
    private final UUID userId;
    private final String email;
    private final String role;
    private final String tenant;

    public AuthenticatedUser(UUID userId, String email, String role, String tenant) {
        this.userId = userId;
        this.email = email;
        this.role = role;
        this.tenant = tenant;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getEmail() {
        return email;
    }

    public String getRole() {
        return role;
    }

    public String getTenant() {
        return tenant;
    }
}

