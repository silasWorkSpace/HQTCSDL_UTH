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
