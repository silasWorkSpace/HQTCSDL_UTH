package com.livingdocs.integration.dto;

public record GitHubFileContent(String name, String path, long size, String htmlUrl, String content) {}
