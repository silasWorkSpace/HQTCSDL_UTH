package com.livingdocs.identity.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TokenResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresIn,
        String githubAccessToken
) {
    public TokenResponse(String accessToken, String refreshToken, String tokenType, long expiresIn) {
        this(accessToken, refreshToken, tokenType, expiresIn, null);
    }
}
