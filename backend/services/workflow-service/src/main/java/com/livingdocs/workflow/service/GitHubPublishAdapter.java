package com.livingdocs.workflow.service;

import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Component
public class GitHubPublishAdapter implements PublishPort {

    private final String integrationBaseUrl;
    private final RestTemplate restTemplate = new RestTemplate();

    public GitHubPublishAdapter(@Value("${livingdocs.integration.base-url}") String integrationBaseUrl) {
        this.integrationBaseUrl = integrationBaseUrl;
    }

    @Override
    public PublicationResult publish(UUID repositoryId, UUID documentId, String pathInRepo, String title,
                                     String content, String bearerToken) {
        if (bearerToken == null || bearerToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing authenticated Manager token");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(bearerToken);
        headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
        Map<String, Object> body = Map.of("pathInRepo", pathInRepo, "title", title,
                "content", content, "documentId", documentId);
        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(
                    integrationBaseUrl + "/api/v1/repositories/" + repositoryId + "/publish",
                    new HttpEntity<>(body, headers), Map.class);
            Map<?, ?> result = response.getBody();
            if (result == null || !(result.get("pullRequestNumber") instanceof Number number)
                    || !(result.get("pullRequestUrl") instanceof String url)
                    || !(result.get("branchName") instanceof String branch)) {
                throw new IllegalStateException("Integration service did not return documentation PR details");
            }
            return new PublicationResult(result.get("commitSha") == null ? null : result.get("commitSha").toString(),
                    number.intValue(), url, branch);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "GitHub publish failed; document was not marked as published", e);
        }
    }
}
