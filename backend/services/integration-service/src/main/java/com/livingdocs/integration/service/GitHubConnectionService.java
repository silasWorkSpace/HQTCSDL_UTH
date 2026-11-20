package com.livingdocs.integration.service;

import com.livingdocs.integration.client.GitHubTokenService;
import com.livingdocs.integration.crypto.AesGcmEncryptionService;
import com.livingdocs.integration.dto.ConnectionRequest;
import com.livingdocs.integration.repository.IntegrationJdbcRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Base64;
import java.nio.charset.StandardCharsets;
import java.net.URI;
import java.util.stream.Collectors;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import com.livingdocs.integration.dto.ConnectionResponse;
import com.livingdocs.integration.dto.GitHubContentEntry;
import com.livingdocs.integration.dto.GitHubFileContent;
import com.livingdocs.integration.dto.SourceFileSnapshot;
import org.springframework.web.util.UriUtils;

@Service
public class GitHubConnectionService {

    public record PublishResult(String commitSha, String htmlUrl, boolean changed,
                                Integer pullRequestNumber, String pullRequestUrl, String branchName) {}

    private final GitHubTokenService tokenService;
    private final AesGcmEncryptionService encryptionService;
    private final IntegrationJdbcRepository repository;
    private final RestTemplate github = createGitHubRestTemplate();

    private static RestTemplate createGitHubRestTemplate() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(java.time.Duration.ofSeconds(5));
        requestFactory.setReadTimeout(java.time.Duration.ofSeconds(10));
        return new RestTemplate(requestFactory);
    }

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
        if (request.installationId() == null || !request.installationId().matches("[0-9]{1,20}")) {
            throw new IllegalArgumentException("A numeric GitHub App installation id is required");
        }
        String token = tokenService.getInstallationToken(request.installationId());
        Map<?, ?> installation = tokenService.getInstallation(request.installationId());
        Object accountValue = installation == null ? null : installation.get("account");
        String accountLogin = accountValue instanceof Map<?, ?> account && account.get("login") instanceof String login
                ? login : request.accountLogin();
        if (accountLogin == null || accountLogin.isBlank()) {
            throw new IllegalStateException("GitHub did not provide the installed account login");
        }
        byte[] encryptedToken = encryptionService.encrypt(token);
        var existing = repository.findConnectionByInstallationId(request.installationId());
        if (existing.isPresent()) {
            if (!request.connectedBy().equals(existing.get().connectedBy())) {
                throw new AccessDeniedException("GitHub App installation is already connected to another workspace user");
            }
            repository.updateConnectionToken(existing.get().id(), encryptedToken);
            return repository.findConnectionById(existing.get().id()).orElseThrow();
        }

        UUID id = repository.saveConnection(
                request.installationId(),
                accountLogin,
                encryptedToken,
                request.connectedBy()
        );

        return repository.findConnectionById(id)
                .orElseThrow(() -> new IllegalStateException("Không tìm thấy connection sau khi lưu."));
    }

    public ConnectionResponse getConnection(UUID id, UUID userId) {
        ConnectionResponse connection = repository.findConnectionById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kết nối với ID: " + id));
        if (!userId.equals(connection.connectedBy())) throw new AccessDeniedException("GitHub connection access denied");
        return connection;
    }

    public ConnectionResponse createOAuthConnection(String oauthToken, UUID userId) {
        Map<?, ?> profile = githubGet("https://api.github.com/user", oauthToken, Map.class).getBody();
        if (profile == null || !(profile.get("id") instanceof Number githubId) || !(profile.get("login") instanceof String login)) {
            throw new IllegalArgumentException("GitHub OAuth token không trả về profile hợp lệ");
        }
        String installationId = "oauth-user-" + githubId.longValue();
        byte[] encrypted = encryptionService.encrypt(oauthToken);
        var existing = repository.findConnectionByInstallationId(installationId);
        if (existing.isPresent()) {
            if (!userId.equals(existing.get().connectedBy())) throw new AccessDeniedException("GitHub connection access denied");
            repository.updateConnectionToken(existing.get().id(), encrypted);
            return repository.findConnectionById(existing.get().id()).orElseThrow();
        }
        UUID id = repository.saveConnection(installationId, login, encrypted, userId);
        return repository.findConnectionById(id).orElseThrow();
    }

    public List<Map<String, Object>> getAvailableRepositories(UUID connectionId, UUID userId) {
        ConnectionResponse connection = getConnection(connectionId, userId);
        String token = getAccessToken(connection);
        List<?> repos;
        if (connection.installationId() != null && !connection.installationId().startsWith("oauth-user-")) {
            Map<?, ?> response = githubGet("https://api.github.com/installation/repositories?per_page=100", token, Map.class).getBody();
            repos = response != null && response.get("repositories") instanceof List<?> items ? items : List.of();
        } else {
            repos = githubGet("https://api.github.com/user/repos?sort=updated&per_page=100&type=all", token, List.class).getBody();
        }
        if (repos == null) return List.of();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : repos) {
            if (item instanceof Map<?, ?> repo) {
                Map<String, Object> value = new HashMap<>();
                value.put("id", repo.get("id")); value.put("name", repo.get("name"));
                value.put("full_name", repo.get("full_name")); value.put("default_branch", repo.get("default_branch"));
                value.put("private", repo.get("private")); result.add(value);
            }
        }
        return result;
    }

    public List<GitHubContentEntry> getRepositoryContents(UUID connectionId, String fullName,
                                                           String branch, String path) {
        String token = getAccessToken(repository.findConnectionById(connectionId)
                .orElseThrow(() -> new IllegalArgumentException("GitHub connection does not exist")));
        Object body = githubGet(contentsUrl(fullName, branch, path), token, Object.class).getBody();
        if (!(body instanceof List<?> items)) {
            throw new IllegalArgumentException("GitHub path is not a directory");
        }
        return items.stream()
                .filter(Map.class::isInstance)
                .map(Map.class::cast)
                .filter(item -> "file".equals(item.get("type")) || "dir".equals(item.get("type")))
                .map(item -> new GitHubContentEntry(
                        String.valueOf(item.get("name")),
                        String.valueOf(item.get("path")),
                        String.valueOf(item.get("type")),
                        item.get("size") instanceof Number size ? size.longValue() : 0L,
                        item.get("html_url") instanceof String htmlUrl ? htmlUrl : null))
                .sorted(java.util.Comparator.comparing((GitHubContentEntry item) -> !"dir".equals(item.type()))
                        .thenComparing(GitHubContentEntry::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    public GitHubFileContent getRepositoryFile(UUID connectionId, String fullName, String branch, String path) {
        String token = getAccessToken(repository.findConnectionById(connectionId)
                .orElseThrow(() -> new IllegalArgumentException("GitHub connection does not exist")));
        Map<?, ?> body = githubGet(contentsUrl(fullName, branch, path), token, Map.class).getBody();
        if (body == null || !"file".equals(body.get("type"))) {
            throw new IllegalArgumentException("GitHub path is not a file");
        }
        long size = body.get("size") instanceof Number value ? value.longValue() : 0L;
        if (size > 1_000_000L) {
            throw new IllegalArgumentException("File is larger than the 1 MB preview limit");
        }
        if (!(body.get("content") instanceof String encoded) || !"base64".equals(body.get("encoding"))) {
            throw new IllegalArgumentException("GitHub did not return previewable text content");
        }
        byte[] decoded = Base64.getMimeDecoder().decode(encoded);
        if (decoded.length > 0 && new String(decoded, StandardCharsets.UTF_8).indexOf('\0') >= 0) {
            throw new IllegalArgumentException("Binary files cannot be previewed");
        }
        String content;
        try {
            content = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
                    .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT)
                    .decode(java.nio.ByteBuffer.wrap(decoded)).toString();
        } catch (java.nio.charset.CharacterCodingException e) {
            throw new IllegalArgumentException("GitHub file is not valid UTF-8 text");
        }
        return new GitHubFileContent(
                String.valueOf(body.get("name")),
                String.valueOf(body.get("path")),
                size,
                body.get("html_url") instanceof String htmlUrl ? htmlUrl : null,
                content);
    }

    public List<SourceFileSnapshot> getCodeSnapshot(UUID connectionId, String fullName, String commitSha) {
        if (commitSha == null || !commitSha.matches("[0-9a-fA-F]{40}")) {
            throw new IllegalArgumentException("A full 40-character commit SHA is required");
        }
        String[] ownerRepo = fullName.split("/", -1);
        if (ownerRepo.length != 2 || ownerRepo[0].isBlank() || ownerRepo[1].isBlank()) {
            throw new IllegalArgumentException("Repository full name is invalid");
        }
        ConnectionResponse connection = repository.findConnectionById(connectionId)
                .orElseThrow(() -> new IllegalArgumentException("GitHub connection does not exist"));
        requireAppInstallation(connection);
        String token = getAccessToken(connection);
        String api = "https://api.github.com/repos/" + UriUtils.encodePathSegment(ownerRepo[0], StandardCharsets.UTF_8)
                + "/" + UriUtils.encodePathSegment(ownerRepo[1], StandardCharsets.UTF_8);
        Map<?, ?> treeResponse = githubGet(api + "/git/trees/" + commitSha + "?recursive=1", token, Map.class).getBody();
        if (treeResponse == null || Boolean.TRUE.equals(treeResponse.get("truncated"))) {
            throw new IllegalStateException("GitHub returned an incomplete repository tree");
        }
        Object rawTree = treeResponse.get("tree");
        if (!(rawTree instanceof List<?> entries)) throw new IllegalStateException("GitHub repository tree is missing");
        List<Map> sourceBlobs = entries.stream().filter(Map.class::isInstance).map(Map.class::cast)
                .filter(item -> "blob".equals(item.get("type")) && item.get("path") instanceof String path
                        && (path.endsWith(".java") || path.endsWith(".py")))
                .toList();
        if (sourceBlobs.size() > 300) throw new IllegalStateException("Repository has over 300 Java/Python files; narrow the indexed repository");
        List<SourceFileSnapshot> result = new ArrayList<>();
        long totalBytes = 0;
        for (Map<?, ?> blobRef : sourceBlobs) {
            long size = blobRef.get("size") instanceof Number n ? n.longValue() : 0;
            if (size > 1_000_000L) throw new IllegalStateException("Source file exceeds the 1 MB indexing limit: " + blobRef.get("path"));
            String blobSha = String.valueOf(blobRef.get("sha"));
            Map<?, ?> blob = githubGet(api + "/git/blobs/" + UriUtils.encodePathSegment(blobSha, StandardCharsets.UTF_8), token, Map.class).getBody();
            if (blob == null || !(blob.get("content") instanceof String encoded)
                    || !"base64".equals(blob.get("encoding"))) {
                throw new IllegalStateException("GitHub did not return source content for " + blobRef.get("path"));
            }
            byte[] bytes = Base64.getMimeDecoder().decode(encoded);
            totalBytes += bytes.length;
            if (totalBytes > 15_000_000L) throw new IllegalStateException("Indexed source snapshot exceeds the 15 MB limit");
            String content;
            try {
                content = StandardCharsets.UTF_8.newDecoder()
                        .onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
                        .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT)
                        .decode(java.nio.ByteBuffer.wrap(bytes)).toString();
            } catch (java.nio.charset.CharacterCodingException ex) {
                throw new IllegalStateException("Source file is not valid UTF-8: " + blobRef.get("path"), ex);
            }
            if (content.indexOf('\0') >= 0) throw new IllegalStateException("Binary content found in source file " + blobRef.get("path"));
            result.add(new SourceFileSnapshot(String.valueOf(blobRef.get("path")), content));
        }
        return result;
    }

    public String getBranchHeadSha(UUID connectionId, String fullName, String branch) {
        String[] ownerRepo = fullName.split("/", -1);
        if (ownerRepo.length != 2 || ownerRepo[0].isBlank() || ownerRepo[1].isBlank()) {
            throw new IllegalArgumentException("Repository full name is invalid");
        }
        ConnectionResponse connection = repository.findConnectionById(connectionId)
                .orElseThrow(() -> new IllegalArgumentException("GitHub connection does not exist"));
        requireAppInstallation(connection);
        String url = "https://api.github.com/repos/" + UriUtils.encodePathSegment(ownerRepo[0], StandardCharsets.UTF_8)
                + "/" + UriUtils.encodePathSegment(ownerRepo[1], StandardCharsets.UTF_8)
                + "/branches/" + UriUtils.encodePathSegment(branch, StandardCharsets.UTF_8);
        Map<?, ?> response = githubGet(url, getAccessToken(connection), Map.class).getBody();
        Object commit = response == null ? null : response.get("commit");
        String sha = commit instanceof Map<?, ?> map && map.get("sha") instanceof String value ? value : null;
        if (sha == null || !sha.matches("[0-9a-fA-F]{40}")) {
            throw new IllegalStateException("GitHub default branch did not return a full commit SHA");
        }
        return sha;
    }

    public void requireRepositoryAppConnection(UUID connectionId, UUID userId) {
        requireAppInstallation(getConnection(connectionId, userId));
    }

    private void requireAppInstallation(ConnectionResponse connection) {
        if (connection.installationId() == null || connection.installationId().startsWith("oauth-user-")) {
            throw new IllegalStateException("Repository indexing and writes require a GitHub App installation");
        }
    }

    private String getAccessToken(ConnectionResponse connection) {
        String installationId = connection.installationId();
        if (installationId != null && !installationId.startsWith("oauth-user-")) {
            // App installation tokens expire; mint/refresh through the server-side App key.
            return tokenService.getInstallationToken(installationId);
        }
        return encryptionService.decrypt(repository.findEncryptedToken(connection.id()));
    }

    private String contentsUrl(String fullName, String branch, String path) {
        String[] ownerRepo = fullName.split("/", -1);
        if (ownerRepo.length != 2 || ownerRepo[0].isBlank() || ownerRepo[1].isBlank()) {
            throw new IllegalArgumentException("Repository full name is invalid");
        }
        if (path != null && !path.isBlank() && (path.startsWith("/") || path.contains("\\")
                || java.util.Arrays.stream(path.split("/", -1)).anyMatch(segment -> segment.isBlank()
                || ".".equals(segment) || "..".equals(segment)))) {
            throw new IllegalArgumentException("Repository path is invalid");
        }
        String encodedPath = path == null || path.isBlank() ? "" : "/" + java.util.Arrays.stream(path.split("/"))
                .map(segment -> UriUtils.encodePathSegment(segment, StandardCharsets.UTF_8))
                .collect(Collectors.joining("/"));
        String safeBranch = (branch == null || branch.isBlank()) ? "main" : branch;
        return "https://api.github.com/repos/"
                + UriUtils.encodePathSegment(ownerRepo[0], StandardCharsets.UTF_8) + "/"
                + UriUtils.encodePathSegment(ownerRepo[1], StandardCharsets.UTF_8)
                + "/contents" + encodedPath + "?ref="
                + UriUtils.encodeQueryParam(safeBranch, StandardCharsets.UTF_8);
    }

    public PublishResult publishDocument(UUID connectionId, String fullName, String branch,
                                         String path, String title, String content, UUID documentId) {
        String[] ownerRepo = fullName.split("/", -1);
        if (ownerRepo.length != 2 || ownerRepo[0].isBlank() || ownerRepo[1].isBlank()) {
            throw new IllegalArgumentException("Repository full name is invalid");
        }
        if (path == null || path.isBlank() || path.startsWith("/") || path.contains("\\")
                || java.util.Arrays.stream(path.split("/")).anyMatch(segment -> segment.isBlank()
                || ".".equals(segment) || "..".equals(segment))) {
            throw new IllegalArgumentException("Document path is invalid");
        }
        if (documentId == null) throw new IllegalArgumentException("documentId is required for a documentation PR");
        var connection = repository.findConnectionById(connectionId)
                .orElseThrow(() -> new IllegalArgumentException("GitHub connection does not exist"));
        if (connection.installationId() == null || connection.installationId().startsWith("oauth-user-")) {
            throw new IllegalStateException("Creating documentation pull requests requires a GitHub App installation; OAuth login is identity-only");
        }
        String token = getAccessToken(connection);
        String branchName = "livingdocs/docs-" + documentId.toString().toLowerCase();
        String repositoryApi = "https://api.github.com/repos/" + UriUtils.encodePathSegment(ownerRepo[0], StandardCharsets.UTF_8)
                + "/" + UriUtils.encodePathSegment(ownerRepo[1], StandardCharsets.UTF_8);
        List<?> existingPulls = githubGet(repositoryApi + "/pulls?state=open&head="
                + UriUtils.encodeQueryParam(ownerRepo[0] + ":" + branchName, StandardCharsets.UTF_8), token, List.class).getBody();
        if (existingPulls != null && !existingPulls.isEmpty() && existingPulls.get(0) instanceof Map<?, ?> existing) {
            Number number = existing.get("number") instanceof Number value ? value : null;
            String url = existing.get("html_url") instanceof String value ? value : null;
            if (number != null && url != null) {
                return new PublishResult(null, null, false, number.intValue(), url, branchName);
            }
        }
        String refsUrl = "https://api.github.com/repos/" + UriUtils.encodePathSegment(ownerRepo[0], StandardCharsets.UTF_8)
                + "/" + UriUtils.encodePathSegment(ownerRepo[1], StandardCharsets.UTF_8) + "/git/ref/heads/"
                + UriUtils.encodePathSegment(branch, StandardCharsets.UTF_8);
        Map<?, ?> refResponse = githubGet(refsUrl, token, Map.class).getBody();
        Map<?, ?> refObject = refResponse != null && refResponse.get("object") instanceof Map<?, ?> value ? value : Map.of();
        String baseSha = refObject.get("sha") instanceof String value ? value : null;
        if (baseSha == null) throw new IllegalStateException("GitHub default branch did not return a commit SHA");
        HttpHeaders headers = githubHeaders(token);
        Map<String, Object> refBody = Map.of("ref", "refs/heads/" + branchName, "sha", baseSha);
        github.postForEntity("https://api.github.com/repos/" + UriUtils.encodePathSegment(ownerRepo[0], StandardCharsets.UTF_8)
                + "/" + UriUtils.encodePathSegment(ownerRepo[1], StandardCharsets.UTF_8) + "/git/refs",
                new HttpEntity<>(refBody, headers), Map.class);
        String encodedPath = java.util.Arrays.stream(path.split("/"))
                .map(segment -> UriUtils.encodePathSegment(segment, StandardCharsets.UTF_8))
                .collect(Collectors.joining("/"));
        String apiUrl = "https://api.github.com/repos/" + UriUtils.encodePathSegment(ownerRepo[0], StandardCharsets.UTF_8)
                + "/" + UriUtils.encodePathSegment(ownerRepo[1], StandardCharsets.UTF_8) + "/contents/" + encodedPath;
        Map<?, ?> current = null;
        try {
            current = githubGet(apiUrl + "?ref=" + UriUtils.encodeQueryParam(branch, StandardCharsets.UTF_8), token, Map.class).getBody();
        } catch (HttpClientErrorException.NotFound ignored) {
            // Create a new document when the path does not exist on the repository branch.
        }
        String sha = current != null && current.get("sha") instanceof String currentSha ? currentSha : null;
        if (current != null && current.get("content") instanceof String currentContent) {
            try {
                String existing = new String(Base64.getMimeDecoder().decode(currentContent), StandardCharsets.UTF_8);
                if (content.equals(existing)) {
                    // An identical target file still needs a PR only if the branch has changes;
                    // the branch was just created from default, so there is nothing to propose.
                    throw new IllegalStateException("Approved document content already matches the repository default branch");
                }
            } catch (IllegalArgumentException ignored) {
                // GitHub may omit content for files over its contents API read limit.
            }
        }

        Map<String, Object> body = new HashMap<>();
        body.put("message", "[LivingDocs] docs: publish " + title.replaceAll("[\\r\\n]+", " ").trim());
        body.put("content", Base64.getEncoder().encodeToString(content.getBytes(StandardCharsets.UTF_8)));
        body.put("branch", branchName);
        if (sha != null) body.put("sha", sha);
        ResponseEntity<Map> response = github.exchange(apiUrl, HttpMethod.PUT,
                new HttpEntity<>(body, headers), Map.class);
        Map<?, ?> payload = response.getBody();
        Map<?, ?> commit = payload != null && payload.get("commit") instanceof Map<?, ?> value ? value : Map.of();
        Map<?, ?> file = payload != null && payload.get("content") instanceof Map<?, ?> value ? value : Map.of();
        Map<String, Object> prBody = Map.of(
                "title", "[LivingDocs] " + title,
                "head", branchName,
                "base", branch,
                "body", "Automated documentation proposal.\n\nLivingDocs-Document-ID: " + documentId);
        Map<?, ?> pr = github.postForEntity(repositoryApi + "/pulls",
                new HttpEntity<>(prBody, headers), Map.class).getBody();
        if (pr == null || !(pr.get("number") instanceof Number number)) {
            throw new IllegalStateException("GitHub did not return a documentation pull request number");
        }
        return new PublishResult(commit.get("sha") instanceof String commitSha ? commitSha : null,
                file.get("html_url") instanceof String htmlUrl ? htmlUrl : null, true,
                number.intValue(), pr.get("html_url") instanceof String prUrl ? prUrl : null, branchName);
    }

    private <T> ResponseEntity<T> githubGet(String url, String token, Class<T> responseType) {
        return github.exchange(url, HttpMethod.GET, new HttpEntity<>(githubHeaders(token)), responseType);
    }

    private HttpHeaders githubHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.set("User-Agent", "LivingDocs");
        headers.set("Accept", "application/vnd.github+json");
        headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
        return headers;
    }
}
