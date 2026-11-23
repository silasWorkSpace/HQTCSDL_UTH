package com.livingdocs.common.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/** Cookie access-token extraction and double-submit CSRF protection for same-origin browser clients. */
public final class BrowserCookieSecurity {
    public static final String ACCESS_COOKIE = "ld_access";
    public static final String REFRESH_COOKIE = "ld_refresh";
    public static final String CSRF_COOKIE = "ld_csrf";
    public static final String CSRF_HEADER = "X-CSRF-Token";
    private static final SecureRandom RANDOM = new SecureRandom();

    private BrowserCookieSecurity() {}

    public static String token(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) return authorization.substring(7).trim();
        return cookie(request, ACCESS_COOKIE);
    }

    public static String cookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie cookie : cookies) if (name.equals(cookie.getName())) return cookie.getValue();
        return null;
    }

    public static boolean validateCsrf(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) return true;
        if (cookie(request, ACCESS_COOKIE) == null || isSafeMethod(request.getMethod())) return true;
        String cookie = cookie(request, CSRF_COOKIE);
        String header = request.getHeader(CSRF_HEADER);
        if (cookie == null || header == null) return false;
        return MessageDigest.isEqual(cookie.getBytes(StandardCharsets.UTF_8), header.getBytes(StandardCharsets.UTF_8));
    }

    public static void ensureCsrfCookie(HttpServletRequest request, HttpServletResponse response, boolean secure) {
        if (cookie(request, CSRF_COOKIE) != null) return;
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String value = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        response.addHeader("Set-Cookie", CSRF_COOKIE + "=" + value + "; Path=/; SameSite=Strict" + (secure ? "; Secure" : ""));
    }

    public static void rejectCsrf(HttpServletRequest request, HttpServletResponse response) throws java.io.IOException {
        if (!validateCsrf(request)) response.sendError(HttpServletResponse.SC_FORBIDDEN, "CSRF token is missing or invalid");
    }

    private static boolean isSafeMethod(String method) {
        return "GET".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method)
                || "OPTIONS".equalsIgnoreCase(method) || "TRACE".equalsIgnoreCase(method);
    }
}
