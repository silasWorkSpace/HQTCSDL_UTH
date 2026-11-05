package com.livingdocs.integration.config;

/**
 * Quản lý ngữ cảnh đa người thuê (Multi-tenant context).
 * Mặc định chuyển mã tenant thành tên schema: demo -> ws_demo.
 */
public final class TenantContext {

    private static final String DEFAULT_TENANT = "demo";
    private static final ThreadLocal<String> CURRENT_TENANT = ThreadLocal.withInitial(() -> DEFAULT_TENANT);

    private TenantContext() {
    }

    public static String getTenant() {
        return CURRENT_TENANT.get();
    }

    public static String getSchemaName() {
        String tenant = getTenant();
        if (tenant == null || tenant.isBlank()) {
            tenant = DEFAULT_TENANT;
        }
        // Chuẩn hóa tên schema an toàn
        String clean = tenant.trim().toLowerCase().replaceAll("[^a-z0-9_]", "");
        return "ws_" + clean;
    }

    public static void setTenant(String tenant) {
        if (tenant != null && !tenant.isBlank()) {
            CURRENT_TENANT.set(tenant.trim().toLowerCase());
        } else {
            CURRENT_TENANT.set(DEFAULT_TENANT);
        }
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }
}
