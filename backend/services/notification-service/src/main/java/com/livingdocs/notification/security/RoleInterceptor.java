package com.livingdocs.notification.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Áp dụng {@link RequireRole} trên controller. 401 khi chưa đăng nhập, 403 khi
 * thiếu vai trò — quyết định ở server, không phụ thuộc giao diện (NFR-SEC-02).
 */
public class RoleInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response,
                             Object handler) throws Exception {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }
        RequireRole required = handlerMethod.getMethodAnnotation(RequireRole.class);
        if (required == null) {
            return true;
        }
        AuthContext.CurrentUser user = AuthContext.get();
        if (!user.hasAnyRole(required.value())) {
            response.sendError(HttpStatus.FORBIDDEN.value(),
                    "Yêu cầu một trong các vai trò: " + String.join(", ", required.value()));
            return false;
        }
        return true;
    }
}
