package com.livingdocs.identity.dto;

public record TokenResponse(String accessToken, String refreshToken, String tokenType, long expiresIn) {
}
