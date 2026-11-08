package com.livingdocs.common.security;

import com.livingdocs.common.error.ApiException;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;

/**
 * Giữ mã workspace (tenant) của request hiện tại. Giá trị lấy từ claim "tenant" trong JWT,
 * KHÔNG BAO GIỜ lấy từ dữ liệu người dùng gửi lên. Mã được kiểm tra chặt vì nó được ghép vào tên schema.
 */
public final class TenantContext {

    private static final Pattern CODE = Pattern.compile("^[a-z0-9_]{2,30}$");
    private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();

    private TenantContext() {
    }

    public static boolean isValid(String code) {
        return code != null && CODE.matcher(code).matches();
    }

    public static void set(String code) {
        if (!isValid(code)) {
            throw new IllegalArgumentException("Mã tenant không hợp lệ: " + code);
        }
        CURRENT.set(code);
    }

    public static void setTenant(String code) {
        if (code == null || code.isBlank()) {
            code = "demo";
        }
        if (isValid(code)) {
            CURRENT.set(code);
        } else {
            CURRENT.set("demo");
        }
    }

    public static Optional<String> get() {
        return Optional.ofNullable(CURRENT.get());
    }

    public static String getTenant() {
        return CURRENT.get() != null ? CURRENT.get() : "demo";
    }

    /** Mã tenant hiện tại; báo lỗi 403 nếu request không có tenant. */
    public static String require() {
        String code = CURRENT.get();
        if (code == null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Thiếu tenant",
                    "Token không có thông tin workspace (tenant).");
        }
        return code;
    }

    /** Tên schema của tenant hiện tại, ví dụ ws_demo. */
    public static String schema() {
        return "ws_" + require();
    }

    public static String getSchema() {
        return "ws_" + getTenant();
    }

    public static void clear() {
        CURRENT.remove();
    }

    /** Chạy một đoạn việc với tenant chỉ định (dùng khi chưa có JWT, ví dụ lúc đăng ký, đăng nhập). */
    public static <T> T runWith(String code, Supplier<T> action) {
        String previous = CURRENT.get();
        set(code);
        try {
            return action.get();
        } finally {
            if (previous == null) {
                CURRENT.remove();
            } else {
                CURRENT.set(previous);
            }
        }
    }
}
