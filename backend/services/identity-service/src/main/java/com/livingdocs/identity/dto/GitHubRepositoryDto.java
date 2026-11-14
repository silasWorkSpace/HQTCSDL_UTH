package com.livingdocs.identity.dto;

/**
 * Thong tin Repository tu GitHub API phuc vu tich hop ma nguon.
 */
public record GitHubRepositoryDto(
        long id,
        String name,
        String fullName,
        String defaultBranch,
        boolean isPrivate,
        String htmlUrl,
        String description
) {
}
