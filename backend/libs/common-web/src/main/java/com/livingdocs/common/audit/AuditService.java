package com.livingdocs.common.audit;

import com.livingdocs.common.db.TenantJdbc;
import com.livingdocs.common.web.CorrelationIdFilter;
import java.sql.Types;
import java.util.Map;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

/** Ghi audit_log cua tenant hien tai (NFR-SEC-05). Khong bao gio dua token hay mat khau vao detail. */
@Service
public class AuditService {

    private final TenantJdbc db;

    public AuditService(TenantJdbc db) {
        this.db = db;
    }

    /**
     * @param actorType user | ai | system (neu la user thi actorId bat buoc)
     */
    public void record(String action, String actorType, UUID actorId, String actorRole,
                       String entityType, UUID entityId, Map<String, ?> detail) {
        db.sql("INSERT INTO {schema}.audit_log ([action], actor_type, actor_id, actor_role, entity_type, "
                        + "entity_id, correlation_id, detail) "
                        + "VALUES (:action, :actorType, :actorId, :actorRole, :entityType, :entityId, :corr, :detail)")
                .param("action", action, Types.VARCHAR)
                .param("actorType", actorType, Types.VARCHAR)
                .param("actorId", text(actorId), Types.VARCHAR)
                .param("actorRole", actorRole, Types.VARCHAR)
                .param("entityType", entityType, Types.VARCHAR)
                .param("entityId", text(entityId), Types.VARCHAR)
                .param("corr", text(correlationId()), Types.VARCHAR)
                .param("detail", detail == null ? null : toJson(detail), Types.NVARCHAR)
                .update();
    }

    private static String text(UUID id) {
        return id == null ? null : id.toString();
    }

    private static UUID correlationId() {
        String value = MDC.get(CorrelationIdFilter.MDC_KEY);
        if (value == null) {
            return null;
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            return null; // header khong phai UUID thi bo qua, cot correlation_id chi nhan UUID
        }
    }

    static String toJson(Map<String, ?> map) {
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, ?> e : map.entrySet()) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            sb.append('"').append(escape(e.getKey())).append("\":");
            Object v = e.getValue();
            if (v == null) {
                sb.append("null");
            } else if (v instanceof Number || v instanceof Boolean) {
                sb.append(v);
            } else {
                sb.append('"').append(escape(v.toString())).append('"');
            }
        }
        return sb.append('}').toString();
    }

    private static String escape(String s) {
        StringBuilder sb = new StringBuilder();
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        return sb.toString();
    }
}
