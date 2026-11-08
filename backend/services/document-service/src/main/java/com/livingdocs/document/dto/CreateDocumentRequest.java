package com.livingdocs.document.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record CreateDocumentRequest(
        UUID repositoryId,
        @NotBlank String docType,
        @NotBlank String title,
        String pathInRepo,
        @NotBlank String content,
        UUID templateId,
        UUID collectionId
) {
}
