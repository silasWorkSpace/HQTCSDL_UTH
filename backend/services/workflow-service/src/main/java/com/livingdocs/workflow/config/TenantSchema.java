package com.livingdocs.workflow.config;

/**
 * Chuyển mã tenant trong JWT thành tên schema SQL Server {@code ws_<code>}
 * và kiểm tra an toàn trước khi ghép vào câu lệnh (chống SQL injection —
 * tên schema không thể tham số hóa). Theo phương án dự phòng JdbcTemplate
 * đã chốt trong spike đa tenant.
 */
public final class TenantSchema {

    private static final String PREFIX = "ws_";

    /** Nhận cả "acme" lẫn "ws_acme" và chuẩn hóa về "ws_acme". */
    public static String normalizeTenant(String tenant) {
        String code = tenant == null ? "" : tenant.trim();
        if (code.regionMatches(true, 0, PREFIX, 0, PREFIX.length())) {
            code = code.substring(PREFIX.length());
        }
        if (!code.matches("[A-Za-z0-9_]{1,50}")) {
            throw new IllegalArgumentException("Mã tenant không hợp lệ");
        }
        return code;
    }

    public static String of(String tenant) {
        return PREFIX + normalizeTenant(tenant);
    }

    /** Ghép tên đối tượng [{schema}].[{name}] sau khi kiểm tra cả hai phần. */
    public static String qualify(String tenant, String objectName) {
        if (!objectName.matches("[A-Za-z0-9_]{1,100}")) {
            throw new IllegalArgumentException("Tên đối tượng CSDL không hợp lệ");
        }
        return "[" + of(tenant) + "].[" + objectName + "]";
    }

    private TenantSchema() {
    }
}
