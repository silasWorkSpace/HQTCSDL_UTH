package com.livingdocs.integration.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record PublishDocumentRequest(
        @NotBlank @Size(max = 500) String title,
        @NotBlank @Size(max = 500) String pathInRepo,
        @NotNull @Size(max = 900000) String content,
        UUID documentId
) {}
