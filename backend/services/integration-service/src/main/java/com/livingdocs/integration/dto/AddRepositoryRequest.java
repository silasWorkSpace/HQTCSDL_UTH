package com.livingdocs.integration.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record AddRepositoryRequest(
        @NotNull(message = "connection_id không được để trống")
        UUID connectionId,

        @NotNull(message = "github_repo_id không được để trống")
        Long githubRepoId,

        @NotBlank(message = "full_name không được để trống (ví dụ: owner/repo)")
        String fullName,

        String defaultBranch
) {}
