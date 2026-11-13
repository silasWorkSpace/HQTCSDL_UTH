package com.livingdocs.integration.config;

/**
 * Quản lý ngữ cảnh đa người thuê (Multi-tenant context).
 * Chuẩn hóa mã tenant ("demo" hoặc "ws_demo") thành tên schema chuẩn "ws_demo"
 * Ngăn chặn lỗi lặp tiền tố sinh ra schema không hợp lệ "ws_ws_demo".
 */
public final class TenantContext {

    private static final String DEFAULT_TENANT = "demo";
    private static final String PREFIX = "ws_";
    private static final ThreadLocal<String> CURRENT_TENANT = ThreadLocal.withInitial(() -> DEFAULT_TENANT);

    private TenantContext() {
    }

    /**
     * Chuẩn hóa mã tenant về dạng không có tiền tố ws_ (ví dụ: "ws_demo" -> "demo").
     */
    public static String normalizeTenant(String tenant) {
        if (tenant == null || tenant.isBlank()) {
            return DEFAULT_TENANT;
        }
        String clean = tenant.trim().toLowerCase().replaceAll("[^a-z0-9_]", "");
        if (clean.startsWith(PREFIX)) {
            clean = clean.substring(PREFIX.length());
        }
        return clean.isBlank() ? DEFAULT_TENANT : clean;
    }

    /**
     * Mã tenant chuẩn (ví dụ: "demo").
     */
    public static String getTenant() {
        return normalizeTenant(CURRENT_TENANT.get());
    }

    /**
     * Tên schema SQL Server chuẩn (ví dụ: "ws_demo").
     */
    public static String getSchemaName() {
        return PREFIX + getTenant();
    }

    public static void setTenant(String tenant) {
        CURRENT_TENANT.set(normalizeTenant(tenant));
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }
}
