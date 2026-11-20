package com.livingdocs.workflow.service;

import java.util.UUID;

/**
 * Writes the approved document to its connected GitHub repository.
 */
public interface PublishPort {

    record PublicationResult(String commitSha, int pullRequestNumber, String pullRequestUrl, String branchName) {}

    PublicationResult publish(UUID repositoryId, UUID documentId, String pathInRepo, String title,
                              String content, String bearerToken);
}
