package com.livingdocs.integration.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class IntegrationExceptionHandler {

    private static final String APP_INSTALLATION_REQUIRED =
            "Repository indexing and writes require a GitHub App installation";

    @ExceptionHandler(IllegalStateException.class)
    public ProblemDetail handleIllegalState(IllegalStateException exception) {
        if (APP_INSTALLATION_REQUIRED.equals(exception.getMessage())) {
            ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                    HttpStatus.CONFLICT,
                    "This connection is for GitHub sign-in only. Complete the GitHub App installation callback, then retry linking the repository.");
            problem.setTitle("GitHub App installation required");
            return problem;
        }

        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "The GitHub integration request could not be completed.");
        problem.setTitle("GitHub integration error");
        return problem;
    }
}
