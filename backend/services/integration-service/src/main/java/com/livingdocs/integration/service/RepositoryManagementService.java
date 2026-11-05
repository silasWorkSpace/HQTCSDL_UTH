package com.livingdocs.integration.service;

import com.livingdocs.integration.dto.AddRepositoryRequest;
import com.livingdocs.integration.dto.RepositoryDto;
import com.livingdocs.integration.dto.SourceEventDto;
import com.livingdocs.integration.repository.IntegrationJdbcRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class RepositoryManagementService {

    private final IntegrationJdbcRepository repository;

    public RepositoryManagementService(IntegrationJdbcRepository repository) {
        this.repository = repository;
    }

    public RepositoryDto addRepository(AddRepositoryRequest request) {
        UUID id = repository.saveRepository(
                request.connectionId(),
                request.githubRepoId(),
                request.fullName(),
                request.defaultBranch()
        );
        return repository.findRepositoryById(id)
                .orElseThrow(() -> new IllegalStateException("Không tìm thấy repository sau khi thêm."));
    }

    public List<RepositoryDto> listRepositories() {
        return repository.findRepositories();
    }

    public RepositoryDto getRepository(UUID id) {
        return repository.findRepositoryById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy repository với ID: " + id));
    }

    public void disconnectRepository(UUID id) {
        // Gọi Stored Procedure sp_disconnect_repository đã có ở CSDL (GH-04)
        repository.disconnectRepository(id);
    }

    public List<SourceEventDto> listEvents(UUID repositoryId) {
        return repository.findEventsByRepository(repositoryId);
    }
}
