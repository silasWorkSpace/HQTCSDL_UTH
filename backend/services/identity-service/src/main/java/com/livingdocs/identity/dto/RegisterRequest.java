package com.livingdocs.identity.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Pattern(regexp = "^[a-z0-9_]{2,30}$", message = "Mã workspace chỉ gồm a-z, 0-9, dấu gạch dưới") String tenant,
        @NotBlank @Email @Size(max = 256) String email,
        @NotBlank @Size(min = 8, max = 72, message = "Mật khẩu dài từ 8 đến 72 ký tự") String password,
        @NotBlank @Size(max = 200) String displayName) {
}
