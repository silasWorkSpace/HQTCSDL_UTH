package com.livingdocs.identity.repository;

import com.livingdocs.common.db.TenantJdbc;
import com.livingdocs.identity.domain.UserRecord;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** Truy cap bang app_user cua tenant hien tai (TenantContext phai da duoc dat). */
@Repository
public class UserRepository {

    private static final String COLUMNS = "id, email, display_name, password_hash, status, [language]";

    private static final RowMapper<UserRecord> MAPPER = (rs, i) -> new UserRecord(
            UUID.fromString(rs.getString("id")),
            rs.getString("email"),
            rs.getString("display_name"),
            rs.getString("password_hash"),
            rs.getString("status"),
            rs.getString("language"));

    private final TenantJdbc db;

    public UserRepository(TenantJdbc db) {
        this.db = db;
    }

    public Optional<UserRecord> findByEmail(String email) {
        return db.sql("SELECT " + COLUMNS + " FROM {schema}.app_user WHERE email = :email")
                .param("email", email)
                .query(MAPPER)
                .optional();
    }

    public Optional<UserRecord> findById(UUID id) {
        return db.sql("SELECT " + COLUMNS + " FROM {schema}.app_user WHERE id = :id")
                .param("id", id.toString())
                .query(MAPPER)
                .optional();
    }

    public List<UserRecord> list(int offset, int size) {
        return db.sql("SELECT " + COLUMNS + " FROM {schema}.app_user ORDER BY email "
                        + "OFFSET :offset ROWS FETCH NEXT :size ROWS ONLY")
                .param("offset", offset)
                .param("size", size)
                .query(MAPPER)
                .list();
    }

    public Optional<UserRecord> findByGithubUserId(long githubUserId) {
        return db.sql("SELECT " + COLUMNS + " FROM {schema}.app_user WHERE github_user_id = :githubUserId")
                .param("githubUserId", githubUserId)
                .query(MAPPER)
                .optional();
    }

    public UUID insert(String email, String displayName, String passwordHash) {
        String id = db.sql("INSERT INTO {schema}.app_user (email, display_name, password_hash) "
                        + "OUTPUT inserted.id VALUES (:email, :name, :hash)")
                .param("email", email)
                .param("name", displayName)
                .param("hash", passwordHash)
                .query((rs, i) -> rs.getString(1))
                .single();
        return UUID.fromString(id);
    }

    public UUID insertGithubUser(String email, String displayName, String oidcSubject, long githubUserId) {
        String id = db.sql("INSERT INTO {schema}.app_user (email, display_name, password_hash, oidc_provider, oidc_subject, github_user_id) "
                        + "OUTPUT inserted.id VALUES (:email, :name, NULL, 'github', :subject, :githubUserId)")
                .param("email", email)
                .param("name", displayName)
                .param("subject", oidcSubject)
                .param("githubUserId", githubUserId)
                .query((rs, i) -> rs.getString(1))
                .single();
        return UUID.fromString(id);
    }

    public void linkGithubAccount(UUID id, String oidcSubject, long githubUserId) {
        db.sql("UPDATE {schema}.app_user SET oidc_provider = 'github', oidc_subject = :subject, github_user_id = :githubUserId, updated_at = SYSUTCDATETIME() "
                        + "WHERE id = :id")
                .param("id", id.toString())
                .param("subject", oidcSubject)
                .param("githubUserId", githubUserId)
                .update();
    }

    public record GithubUserProvisionResult(UserRecord user, boolean isNew) {}

    /**
     * Tra cứu và điều phối người dùng GitHub (FR-AUTH-02):
     * 1. Nếu github_user_id đã tồn tại -> Trả về user hiện có.
     * 2. Nếu email đã tồn tại -> Liên kết tài khoản hiện có với GitHub (linkGithubAccount).
     * 3. Nếu chưa có -> Tạo mới user qua JIT Provisioning và đánh dấu isNew = true.
     */
    public GithubUserProvisionResult findOrProvisionGithubUser(String email, String displayName, String oidcSubject, long githubUserId) {
        // 1. Kiểm tra theo github_user_id
        Optional<UserRecord> byGithubId = findByGithubUserId(githubUserId);
        if (byGithubId.isPresent()) {
            return new GithubUserProvisionResult(byGithubId.get(), false);
        }

        // 2. Kiểm tra theo email: nếu đã có tài khoản -> liên kết tài khoản
        Optional<UserRecord> byEmail = findByEmail(email);
        if (byEmail.isPresent()) {
            UserRecord existing = byEmail.get();
            linkGithubAccount(existing.id(), oidcSubject, githubUserId);
            UserRecord linked = findById(existing.id()).orElse(existing);
            return new GithubUserProvisionResult(linked, false);
        }

        // 3. Nếu chưa có -> Tự động tạo user mới (JIT Provisioning)
        UUID newId = insertGithubUser(email, displayName, oidcSubject, githubUserId);
        UserRecord newUser = findById(newId).orElseGet(() -> new UserRecord(newId, email, displayName, null, "active", "vi"));
        return new GithubUserProvisionResult(newUser, true);
    }

    public void touchLastLogin(UUID id) {
        db.sql("UPDATE {schema}.app_user SET last_login_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME() "
                        + "WHERE id = :id")
                .param("id", id.toString())
                .update();
    }

    public int updateStatus(UUID id, String status) {
        return db.sql("UPDATE {schema}.app_user SET status = :status, updated_at = SYSUTCDATETIME() WHERE id = :id")
                .param("status", status)
                .param("id", id.toString())
                .update();
    }
}
