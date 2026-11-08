package com.livingdocs.workflow.security;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Người dùng hiện tại lấy từ JWT (claims: sub, tenant, roles) — gắn theo luồng
 * request. Tách biệt nhiệm vụ (FR-WF-22) và mọi kiểm tra quyền đều dựa trên đây,
 * kiểm tra ở phía server chứ không chỉ ẩn nút trên giao diện (NFR-SEC-02).
 */
public final class AuthContext {

    public record CurrentUser(UUID userId, String tenant, List<String> roles) {

        public boolean hasAnyRole(String... allowed) {
            return roles != null && Set.of(allowed).stream().anyMatch(roles::contains);
        }
    }

    private static final ThreadLocal<CurrentUser> HOLDER = new ThreadLocal<>();

    public static void set(CurrentUser user) {
        HOLDER.set(user);
    }

    public static CurrentUser get() {
        CurrentUser user = HOLDER.get();
        if (user == null) {
            throw new IllegalStateException("Thiếu JWT hoặc request không đi qua JwtAuthFilter");
        }
        return user;
    }

    public static void clear() {
        HOLDER.remove();
    }

    private AuthContext() {
    }
}
