package com.livingdocs.identity.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record GitHubCallbackRequest(
        @NotBlank(message = "Code không được để trống") String code,
        @NotBlank(message = "OAuth state không được để trống") String state,
        String redirectUri) {
}
