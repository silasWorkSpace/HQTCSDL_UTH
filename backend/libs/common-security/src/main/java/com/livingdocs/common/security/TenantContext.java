package com.livingdocs.common.security;

public final class TenantContext {
    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

    private TenantContext() {}

    public static String getTenant() {
        String tenant = CURRENT_TENANT.get();
        return tenant != null ? tenant : "demo"; // Default to demo tenant if not explicitly provided
    }

    public static String getSchema() {
        return "ws_" + getTenant();
    }

    public static void setTenant(String tenant) {
        CURRENT_TENANT.set(tenant);
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }
}

