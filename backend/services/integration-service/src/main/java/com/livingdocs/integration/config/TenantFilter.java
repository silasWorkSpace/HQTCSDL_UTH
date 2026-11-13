package com.livingdocs.integration.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Filter thiết lập TenantContext cho mỗi HTTP Request.
 * Hỗ trợ linh hoạt cả hai header chuẩn: X-Tenant (dùng chung trong toàn bộ hệ thống)
 * và X-Tenant-Id (tương thích các webhook/script kiểm thử).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TenantFilter extends OncePerRequestFilter {

    public static final String TENANT_HEADER = "X-Tenant";
    public static final String ALT_TENANT_HEADER = "X-Tenant-Id";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String tenantHeader = request.getHeader(TENANT_HEADER);
        if (tenantHeader == null || tenantHeader.isBlank()) {
            tenantHeader = request.getHeader(ALT_TENANT_HEADER);
        }

        if (tenantHeader != null && !tenantHeader.isBlank()) {
            TenantContext.setTenant(tenantHeader);
        } else {
            TenantContext.setTenant("demo");
        }

        try {
            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}
