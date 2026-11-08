package com.livingdocs.common.db;

import com.livingdocs.common.security.TenantContext;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Truy cap SQL Server theo tenant. Viet SQL voi placeholder {schema}, no duoc thay bang [ws_tenant].
 * Ma tenant da duoc kiem tra chat trong TenantContext nen ghep chuoi o day an toan.
 * Vi du: db.sql("SELECT id FROM {schema}.app_user WHERE email = :email").param("email", e).query(...).
 * Gia tri nguoi dung gui len LUON di qua .param(...), khong bao gio ghep vao chuoi SQL.
 */
@Component
public class TenantJdbc {

    private final JdbcClient jdbc;

    public TenantJdbc(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** SQL tren schema cua tenant hien tai. */
    public JdbcClient.StatementSpec sql(String template) {
        return jdbc.sql(template.replace("{schema}", "[" + TenantContext.schema() + "]"));
    }

    /** SQL tren schema dung chung platform (khong can tenant). */
    public JdbcClient.StatementSpec platform(String template) {
        return jdbc.sql(template);
    }
}
