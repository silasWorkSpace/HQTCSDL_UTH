package com.livingdocs.integration.dto;

public record PublishDocumentResponse(String commitSha, String htmlUrl, boolean changed,
                                      Integer pullRequestNumber, String pullRequestUrl,
                                      String branchName) {}
