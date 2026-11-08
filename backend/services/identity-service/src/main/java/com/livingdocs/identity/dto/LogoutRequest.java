package com.livingdocs.identity.dto;

/** refreshToken khong bat buoc: neu co thi bi huy cung luc voi access token. */
public record LogoutRequest(String refreshToken) {
}
