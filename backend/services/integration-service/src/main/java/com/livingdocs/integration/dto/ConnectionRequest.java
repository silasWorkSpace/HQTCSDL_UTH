package com.livingdocs.integration.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record ConnectionRequest(
        @NotBlank(message = "installation_id không được để trống")
        String installationId,

        @NotBlank(message = "account_login không được để trống")
        String accountLogin,

        UUID connectedBy
) {}
