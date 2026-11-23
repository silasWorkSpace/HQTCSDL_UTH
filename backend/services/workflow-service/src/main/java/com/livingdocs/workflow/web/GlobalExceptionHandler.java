package com.livingdocs.workflow.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

/**
 * Định dạng lỗi chung theo Problem Details (RFC 7807) — quy ước nhóm.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ProblemDetail handleStatus(ResponseStatusException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(ex.getStatusCode(),
                ex.getReason() != null ? ex.getReason() : "Lỗi nghiệp vụ");
        pd.setTitle(reasonTitle(ex.getStatusCode().value()));
        return pd;
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ProblemDetail handleIllegal(IllegalArgumentException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        pd.setTitle("Yêu cầu không hợp lệ");
        return pd;
    }

    private static String reasonTitle(int status) {
        return switch (status) {
            case 404 -> "Không tìm thấy";
            case 409 -> "Xung đột nghiệp vụ";
            case 403 -> "Không đủ quyền";
            default -> "Lỗi";
        };
    }
}
