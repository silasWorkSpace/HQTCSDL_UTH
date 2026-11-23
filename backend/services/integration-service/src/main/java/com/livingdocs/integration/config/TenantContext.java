package com.livingdocs.integration.config;

/**
 * Quản lý ngữ cảnh đa người thuê (Multi-tenant context).
 * Chuẩn hóa mã tenant ("demo" hoặc "ws_demo") thành tên schema chuẩn "ws_demo"
 * Ngăn chặn lỗi lặp tiền tố sinh ra schema không hợp lệ "ws_ws_demo".
 */
public final class TenantContext {

    private TenantContext() {
    }

    /**
     * Chuẩn hóa mã tenant về dạng không có tiền tố ws_ (ví dụ: "ws_demo" -> "demo").
     */
    public static String normalizeTenant(String tenant) {
        String code = tenant == null ? "" : tenant.trim();
        if (code.startsWith("ws_")) code = code.substring(3);
        if (!code.matches("[a-z0-9_]{2,30}")) throw new IllegalArgumentException("Mã tenant không hợp lệ");
        return code;
    }

    /**
     * Mã tenant chuẩn (ví dụ: "demo").
     */
    public static String getTenant() {
        return com.livingdocs.common.security.TenantContext.getTenant();
    }

    /**
     * Tên schema SQL Server chuẩn (ví dụ: "ws_demo").
     */
    public static String getSchemaName() {
        return com.livingdocs.common.security.TenantContext.schema();
    }

    public static void setTenant(String tenant) {
        com.livingdocs.common.security.TenantContext.setTenant(tenant);
    }

    public static void clear() {
        com.livingdocs.common.security.TenantContext.clear();
    }

    public static <T> T runWith(String tenant, java.util.function.Supplier<T> action) {
        return com.livingdocs.common.security.TenantContext.runWith(tenant, action);
    }
}
