package com.livingdocs.integration.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record ConnectionRequest(
        @NotBlank String installationId,
        String accountLogin,
        UUID connectedBy
) {}
