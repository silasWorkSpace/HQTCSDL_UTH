package com.livingdocs.common.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.livingdocs.common.error.ApiException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class TenantContextTest {

    @AfterEach
    void cleanUp() {
        TenantContext.clear();
    }

    @Test
    void chapNhanMaHopLeVaTaoTenSchema() {
        TenantContext.set("demo");
        assertThat(TenantContext.schema()).isEqualTo("ws_demo");
    }

    @Test
    void tuChoiMaCoChuHoaKyTuLaHoacChenSql() {
        assertThatThrownBy(() -> TenantContext.set("Demo")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> TenantContext.set("demo-1")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> TenantContext.set("x]; DROP TABLE a;--")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> TenantContext.set("a")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void thieuTenantThiBaoLoi403() {
        assertThatThrownBy(TenantContext::require).isInstanceOf(ApiException.class);
    }

    @Test
    void runWithKhoiPhucTenantTruocDo() {
        TenantContext.set("demo");
        String inner = TenantContext.runWith("acme", TenantContext::schema);
        assertThat(inner).isEqualTo("ws_acme");
        assertThat(TenantContext.schema()).isEqualTo("ws_demo");
    }
}
