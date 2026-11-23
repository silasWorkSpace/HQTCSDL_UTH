package com.livingdocs.integration.service;

import com.livingdocs.integration.dto.AddRepositoryRequest;
import com.livingdocs.integration.dto.RepositoryDto;
import com.livingdocs.integration.dto.SourceEventDto;
import com.livingdocs.integration.dto.CodeEntityDto;
import com.livingdocs.integration.dto.PublishDocumentRequest;
import com.livingdocs.integration.dto.PublishDocumentResponse;
import com.livingdocs.integration.dto.GitHubContentEntry;
import com.livingdocs.integration.dto.GitHubFileContent;
import com.livingdocs.integration.dto.SourceFileSnapshot;
import com.livingdocs.integration.repository.IntegrationJdbcRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;

@Service
public class RepositoryManagementService {

    private final IntegrationJdbcRepository repository;
    private final GitHubConnectionService connections;
    private final AnalysisRunService analysisRuns;

    public RepositoryManagementService(IntegrationJdbcRepository repository, GitHubConnectionService connections,
                                       AnalysisRunService analysisRuns) {
        this.repository = repository;
        this.connections = connections;
        this.analysisRuns = analysisRuns;
    }

    public RepositoryDto addRepository(AddRepositoryRequest request, UUID userId) {
        connections.requireRepositoryAppConnection(request.connectionId(), userId);
        boolean allowed = connections.getAvailableRepositories(request.connectionId(), userId).stream().anyMatch(repo ->
                request.githubRepoId().equals(((Number) repo.get("id")).longValue())
                        && request.fullName().equals(repo.get("full_name")));
        if (!allowed) throw new AccessDeniedException("Repository is not accessible to the authenticated GitHub user");
        UUID id = repository.saveRepository(
                request.connectionId(),
                request.githubRepoId(),
                request.fullName(),
                request.defaultBranch()
        );
        RepositoryDto saved = repository.findRepositoryById(id).orElseThrow();
        analysisRuns.startBaseline(saved);
        return saved;
    }

    public List<RepositoryDto> listRepositories() {
        return repository.findRepositories();
    }

    public RepositoryDto getRepository(UUID id) {
        return repository.findRepositoryById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy repository với ID: " + id));
    }

    public UUID startAnalysisRun(UUID repositoryId) {
        return analysisRuns.startBaseline(getConnectedRepository(repositoryId));
    }

    public List<GitHubContentEntry> getRepositoryContents(UUID id, String path) {
        RepositoryDto repo = getConnectedRepository(id);
        return connections.getRepositoryContents(repo.connectionId(), repo.fullName(), repo.defaultBranch(), path);
    }

    public GitHubFileContent getRepositoryFile(UUID id, String path) {
        RepositoryDto repo = getConnectedRepository(id);
        return connections.getRepositoryFile(repo.connectionId(), repo.fullName(), repo.defaultBranch(), path);
    }

    public List<SourceFileSnapshot> getCodeSnapshot(UUID id, String commitSha) {
        RepositoryDto repo = getConnectedRepository(id);
        return connections.getCodeSnapshot(repo.connectionId(), repo.fullName(), commitSha);
    }

    private RepositoryDto getConnectedRepository(UUID id) {
        RepositoryDto repo = getRepository(id);
        if (!"connected".equalsIgnoreCase(repo.connectionStatus())) {
            throw new IllegalStateException("Repository is not connected");
        }
        return repo;
    }

    public PublishDocumentResponse publishDocument(UUID id, PublishDocumentRequest request) {
        RepositoryDto repo = getRepository(id);
        if (!"connected".equalsIgnoreCase(repo.connectionStatus())) {
            throw new IllegalStateException("Repository is not connected");
        }
        GitHubConnectionService.PublishResult result = connections.publishDocument(
                repo.connectionId(), repo.fullName(), repo.defaultBranch(), request.pathInRepo(),
                request.title(), request.content(), request.documentId());
        return new PublishDocumentResponse(result.commitSha(), result.htmlUrl(), result.changed(),
                result.pullRequestNumber(), result.pullRequestUrl(), result.branchName());
    }

    public void disconnectRepository(UUID id) {
        // Gọi Stored Procedure sp_disconnect_repository đã có ở CSDL (GH-04)
        repository.disconnectRepository(id);
    }

    public List<SourceEventDto> listEvents(UUID repositoryId) {
        return repository.findEventsByRepository(repositoryId);
    }

    public List<CodeEntityDto> listCodeEntities(UUID repositoryId, String commitSha,
            String pathPrefix, String kind, String query) {
        getConnectedRepository(repositoryId);
        return repository.findCodeEntities(repositoryId, commitSha, pathPrefix, kind, query);
    }
}
