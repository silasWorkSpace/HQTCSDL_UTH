package com.livingdocs.identity;

import com.livingdocs.common.audit.AuditService;
import com.livingdocs.identity.config.GitHubOAuthProperties;
import com.livingdocs.identity.config.IdentityProperties;
import com.livingdocs.identity.domain.UserRecord;
import com.livingdocs.identity.dto.GitHubAuthUrlResponse;
import com.livingdocs.identity.repository.RoleRepository;
import com.livingdocs.identity.repository.UserRepository;
import com.livingdocs.identity.repository.UserRepository.GithubUserProvisionResult;
import com.livingdocs.identity.repository.WorkspaceRepository;
import com.livingdocs.identity.service.AuthService;
import com.livingdocs.identity.service.GitHubLoginProvisioner;
import com.livingdocs.identity.service.TokenService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GitHubOAuthTest {

    @Test
    void githubOAuthUrlFailsClosedWithoutRedisBackedState() {
        GitHubOAuthProperties props = new GitHubOAuthProperties(
                "real-client-id-12345",
                "test-secret",
                "http://localhost:5173/auth/callback"
        );
        AuthService authService = new AuthService(
                mock(WorkspaceRepository.class),
                mock(UserRepository.class),
                mock(RoleRepository.class),
                mock(PasswordEncoder.class),
                mock(TokenService.class),
                mock(AuditService.class),
                mock(IdentityProperties.class),
                props,
                mock(GitHubLoginProvisioner.class)
        );

        assertThrows(RuntimeException.class,
                () -> authService.getGitHubAuthUrl("demo", "http://localhost:5173/auth/callback"));
    }

    @Test
    void githubOAuthDoesNotReturnMockCallbackWhenConfigurationIsMissing() {
        GitHubOAuthProperties props = new GitHubOAuthProperties(
                "your-github-client-id",
                "test-secret",
                "http://localhost:5173/auth/callback"
        );
        AuthService authService = new AuthService(
                mock(WorkspaceRepository.class),
                mock(UserRepository.class),
                mock(RoleRepository.class),
                mock(PasswordEncoder.class),
                mock(TokenService.class),
                mock(AuditService.class),
                mock(IdentityProperties.class),
                props,
                mock(GitHubLoginProvisioner.class)
        );

        assertThrows(RuntimeException.class,
                () -> authService.getGitHubAuthUrl("demo", "http://localhost:5173/auth/callback"));
    }

    @Test
    void testFindOrProvision_ExistingGithubId() {
        UserRepository repo = mock(UserRepository.class);
        UUID userId = UUID.randomUUID();
        UserRecord existing = new UserRecord(userId, "dev@test.local", "Dev Minh", null, "active", "vi");

        when(repo.findByGithubUserId(12345L)).thenReturn(Optional.of(existing));
        when(repo.findOrProvisionGithubUser("dev@test.local", "Dev Minh", "12345", 12345L)).thenCallRealMethod();

        GithubUserProvisionResult result = repo.findOrProvisionGithubUser("dev@test.local", "Dev Minh", "12345", 12345L);
        assertNotNull(result);
        assertEquals(userId, result.user().id());
        assertFalse(result.isNew());
        verify(repo, never()).insertGithubUser(anyString(), anyString(), anyString(), anyLong());
    }

    @Test
    void testFindOrProvision_ExistingEmailLinking() {
        UserRepository repo = mock(UserRepository.class);
        UUID userId = UUID.randomUUID();
        UserRecord existing = new UserRecord(userId, "dev@test.local", "Dev Minh", "hashed_pwd", "active", "vi");

        when(repo.findByGithubUserId(12345L)).thenReturn(Optional.empty());
        when(repo.findByEmail("dev@test.local")).thenReturn(Optional.of(existing));
        when(repo.findById(userId)).thenReturn(Optional.of(existing));
        when(repo.findOrProvisionGithubUser("dev@test.local", "Dev Minh", "12345", 12345L)).thenCallRealMethod();

        GithubUserProvisionResult result = repo.findOrProvisionGithubUser("dev@test.local", "Dev Minh", "12345", 12345L);
        assertNotNull(result);
        assertEquals(userId, result.user().id());
        assertFalse(result.isNew());
        verify(repo).linkGithubAccount(userId, "12345", 12345L);
        verify(repo, never()).insertGithubUser(anyString(), anyString(), anyString(), anyLong());
    }

    @Test
    void testFindOrProvision_JitNewUser() {
        UserRepository repo = mock(UserRepository.class);
        UUID newUserId = UUID.randomUUID();
        UserRecord newUser = new UserRecord(newUserId, "new@test.local", "New User", null, "active", "vi");

        when(repo.findByGithubUserId(99999L)).thenReturn(Optional.empty());
        when(repo.findByEmail("new@test.local")).thenReturn(Optional.empty());
        when(repo.insertGithubUser("new@test.local", "New User", "99999", 99999L)).thenReturn(newUserId);
        when(repo.findById(newUserId)).thenReturn(Optional.of(newUser));
        when(repo.findOrProvisionGithubUser("new@test.local", "New User", "99999", 99999L)).thenCallRealMethod();

        GithubUserProvisionResult result = repo.findOrProvisionGithubUser("new@test.local", "New User", "99999", 99999L);
        assertNotNull(result);
        assertEquals(newUserId, result.user().id());
        assertTrue(result.isNew());
        verify(repo).insertGithubUser("new@test.local", "New User", "99999", 99999L);
    }

    @Test
    void githubRepositoryLookupRejectsMissingToken() {
        GitHubOAuthProperties props = new GitHubOAuthProperties(
                "your-github-client-id",
                "test-secret",
                "http://localhost:5173/auth/callback"
        );
        AuthService authService = new AuthService(
                mock(WorkspaceRepository.class),
                mock(UserRepository.class),
                mock(RoleRepository.class),
                mock(PasswordEncoder.class),
                mock(TokenService.class),
                mock(AuditService.class),
                mock(IdentityProperties.class),
                props,
                mock(GitHubLoginProvisioner.class)
        );

        assertThrows(RuntimeException.class, () -> authService.getGitHubRepositories(null));
    }
}
