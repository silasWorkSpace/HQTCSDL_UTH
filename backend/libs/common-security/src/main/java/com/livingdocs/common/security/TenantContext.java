package com.livingdocs.common.security;

import com.livingdocs.common.error.ApiException;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;

/**
 * Giu ma workspace (tenant) cua request hien tai. Gia tri lay tu claim "tenant" trong JWT,
 * KHONG BAO GIO lay tu du lieu nguoi dung gui len. Ma duoc kiem tra chat vi no duoc ghep vao ten schema.
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
            throw new IllegalArgumentException("Mã tenant không hợp lệ");
        }
        CURRENT.set(code);
    }

    public static Optional<String> get() {
        return Optional.ofNullable(CURRENT.get());
    }

    /** Ma tenant hien tai; bao loi 403 neu request khong co tenant. */
    public static String require() {
        String code = CURRENT.get();
        if (code == null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Thiếu tenant",
                    "Token không có thông tin workspace (tenant).");
        }
        return code;
    }

    /** Ten schema cua tenant hien tai, vi du ws_demo. */
    public static String schema() {
        return "ws_" + require();
    }

    public static void clear() {
        CURRENT.remove();
    }

    /** Chay mot doan viec voi tenant chi dinh (dung khi chua co JWT, vi du luc dang ky, dang nhap). */
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
