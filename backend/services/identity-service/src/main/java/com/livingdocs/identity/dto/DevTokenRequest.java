package com.livingdocs.identity.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import java.util.List;

public record DevTokenRequest(
        @NotBlank @Pattern(regexp = "^[a-z0-9_]{2,30}$") String tenant,
        @NotBlank String email,
        @NotEmpty List<String> roles) {
}
