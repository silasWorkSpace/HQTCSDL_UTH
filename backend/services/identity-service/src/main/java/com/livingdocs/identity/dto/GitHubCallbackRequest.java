package com.livingdocs.identity.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record GitHubCallbackRequest(
        @NotBlank(message = "Code không được để trống") String code,
        @Pattern(regexp = "^[a-z0-9_]{2,30}$", message = "Mã workspace không hợp lệ") String tenant,
        String redirectUri) {
}
