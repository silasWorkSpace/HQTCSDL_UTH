package com.livingdocs.integration.service;

import com.livingdocs.integration.client.GitHubTokenService;
import com.livingdocs.integration.crypto.AesGcmEncryptionService;
import com.livingdocs.integration.dto.ConnectionRequest;
import com.livingdocs.integration.dto.ConnectionResponse;
import com.livingdocs.integration.repository.IntegrationJdbcRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class GitHubConnectionService {

    private final GitHubTokenService tokenService;
    private final AesGcmEncryptionService encryptionService;
    private final IntegrationJdbcRepository repository;

    public GitHubConnectionService(
            GitHubTokenService tokenService,
            AesGcmEncryptionService encryptionService,
            IntegrationJdbcRepository repository
    ) {
        this.tokenService = tokenService;
        this.encryptionService = encryptionService;
        this.repository = repository;
    }

    public ConnectionResponse createConnection(ConnectionRequest request) {
        // Lấy token và mã hóa AES-GCM trước khi lưu CSDL (NFR-SEC-04)
        String token = tokenService.getInstallationToken(request.installationId());
        byte[] encryptedToken = encryptionService.encrypt(token);

        UUID id = repository.saveConnection(
                request.installationId(),
                request.accountLogin(),
                encryptedToken,
                request.connectedBy()
        );

        return repository.findConnectionById(id)
                .orElseThrow(() -> new IllegalStateException("Không tìm thấy connection sau khi lưu."));
    }

    public ConnectionResponse getConnection(UUID id) {
        return repository.findConnectionById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kết nối với ID: " + id));
    }

    public List<Map<String, Object>> getAvailableRepositories(UUID connectionId) {
        ConnectionResponse connection = getConnection(connectionId);
        // Trả về danh sách repository mẫu hoặc từ GitHub API
        return List.of(
                Map.of(
                        "id", 12345678L,
                        "name", "livingdocs-core",
                        "full_name", connection.accountLogin() + "/livingdocs-core",
                        "default_branch", "main",
                        "private", false
                ),
                Map.of(
                        "id", 87654321L,
                        "name", "sample-ecommerce-api",
                        "full_name", connection.accountLogin() + "/sample-ecommerce-api",
                        "default_branch", "master",
                        "private", true
                )
        );
    }
}
