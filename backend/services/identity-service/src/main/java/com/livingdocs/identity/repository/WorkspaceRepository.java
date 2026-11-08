package com.livingdocs.identity.repository;

import com.livingdocs.common.db.TenantJdbc;
import org.springframework.stereotype.Repository;

@Repository
public class WorkspaceRepository {

    private final TenantJdbc db;

    public WorkspaceRepository(TenantJdbc db) {
        this.db = db;
    }

    public boolean isActive(String code) {
        Integer n = db.platform("SELECT COUNT(*) FROM platform.workspace WHERE code = :code AND status = 'active'")
                .param("code", code)
                .query(Integer.class)
                .single();
        return n != null && n > 0;
    }
}
