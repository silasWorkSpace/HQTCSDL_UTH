package com.livingdocs.identity.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record LoginRequest(
        @NotBlank @Pattern(regexp = "^[a-z0-9_]{2,30}$", message = "Mã workspace không hợp lệ") String tenant,
        @NotBlank String email,
        @NotBlank String password) {
}
