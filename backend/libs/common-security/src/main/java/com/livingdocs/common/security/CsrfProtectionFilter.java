package com.livingdocs.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.web.filter.OncePerRequestFilter;

public class CsrfProtectionFilter extends OncePerRequestFilter {
    private final boolean secureCookies;

    public CsrfProtectionFilter(boolean secureCookies) {
        this.secureCookies = secureCookies;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        BrowserCookieSecurity.ensureCsrfCookie(request, response, secureCookies);
        if (!BrowserCookieSecurity.validateCsrf(request)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "CSRF token is missing or invalid");
            return;
        }
        chain.doFilter(request, response);
    }
}
