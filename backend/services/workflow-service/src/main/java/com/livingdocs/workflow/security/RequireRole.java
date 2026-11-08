package com.livingdocs.workflow.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Yêu cầu một trong các vai trò đã khai báo cho endpoint. Interceptor kiểm tra
 * phía server trước khi vào controller (NFR-SEC-02, NFR-SEC-12).
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RequireRole {

    /** Vai trò được phép; không khai báo = mọi người dùng đã đăng nhập. */
    String[] value() default {};
}
