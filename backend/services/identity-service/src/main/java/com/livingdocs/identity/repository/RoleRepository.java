package com.livingdocs.identity.repository;

import com.livingdocs.common.db.TenantJdbc;
import java.sql.Types;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Repository;

/** Truy cap bang role_assignment (chi vai tro ap dung cho ca workspace o giai doan nay). */
@Repository
public class RoleRepository {

    private final TenantJdbc db;

    public RoleRepository(TenantJdbc db) {
        this.db = db;
    }

    /** Moi vai tro cua nguoi dung (moi pham vi), khong trung. */
    public List<String> rolesOf(UUID userId) {
        return db.sql("SELECT DISTINCT [role] FROM {schema}.role_assignment WHERE user_id = :id ORDER BY [role]")
                .param("id", userId.toString())
                .query((rs, i) -> rs.getString(1))
                .list();
    }

    public void deleteWorkspaceRoles(UUID userId) {
        db.sql("DELETE FROM {schema}.role_assignment WHERE user_id = :id AND scope_type = 'workspace'")
                .param("id", userId.toString())
                .update();
    }

    public void addWorkspaceRole(UUID userId, String role, UUID grantedBy) {
        db.sql("INSERT INTO {schema}.role_assignment (user_id, [role], scope_type, scope_id, granted_by) "
                        + "VALUES (:uid, :role, 'workspace', NULL, :by)")
                .param("uid", userId.toString())
                .param("role", role)
                .param("by", grantedBy == null ? null : grantedBy.toString(), Types.VARCHAR)
                .update();
    }
}
