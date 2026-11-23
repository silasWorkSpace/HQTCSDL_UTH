package com.livingdocs.common.error;

import org.springframework.http.HttpStatus;

/** Loi nghiep vu co ma HTTP ro rang. GlobalExceptionHandler doi no thanh Problem Details (RFC 7807). */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String title;

    public ApiException(HttpStatus status, String title, String detail) {
        super(detail);
        this.status = status;
        this.title = title;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getTitle() {
        return title;
    }
}
