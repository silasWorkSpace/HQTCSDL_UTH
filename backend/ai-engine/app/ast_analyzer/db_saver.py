from __future__ import annotations

import logging
from typing import Optional, Sequence
from .models import CodeEntity

logger = logging.getLogger(__name__)


class CodeEntityDbSaver:
    """
    Hỗ trợ lưu trữ danh sách CodeEntity vào CSDL SQL Server theo schema tenant.
    Đảm bảo tính Idempotent và đúng thứ tự phân cấp parent_id (class -> method -> parameter/endpoint).
    """

    def __init__(self, connection_string: Optional[str] = None) -> None:
        self.connection_string = connection_string

    def save_entities(
        self,
        entities: Sequence[CodeEntity],
        tenant_schema: str = "ws_demo",
        cursor = None,
    ) -> int:
        if not entities:
            return 0

        # Phân nhóm theo thứ tự phân cấp để tránh vi phạm khóa ngoại fk_code_entity_parent
        classes = [e for e in entities if e.kind == "class"]
        methods = [e for e in entities if e.kind == "method"]
        others = [e for e in entities if e.kind in ("endpoint", "parameter")]

        ordered = classes + methods + others
        count = 0

        insert_sql = f"""
        MERGE [{tenant_schema}].[code_entity] AS target
        USING (SELECT ? AS id, ? AS repository_id, ? AS parent_id, ? AS kind,
                      ? AS name, ? AS signature, ? AS file_path, ? AS commit_hash) AS source
        ON (target.repository_id = source.repository_id 
            AND target.file_path = source.file_path 
            AND target.commit_hash = source.commit_hash 
            AND target.name = source.name 
            AND target.kind = source.kind)
        WHEN MATCHED THEN
            UPDATE SET target.signature = source.signature,
                       target.parent_id = source.parent_id,
                       target.updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
            INSERT (id, repository_id, parent_id, kind, name, signature, file_path, commit_hash)
            VALUES (source.id, source.repository_id, source.parent_id, source.kind,
                    source.name, source.signature, source.file_path, source.commit_hash);
        """

        if cursor is not None:
            for item in ordered:
                cursor.execute(
                    insert_sql,
                    item.id,
                    item.repository_id,
                    item.parent_id,
                    item.kind,
                    item.name,
                    item.signature,
                    item.file_path,
                    item.commit_hash,
                )
                count += 1
            logger.info("Đã lưu %d code_entity vào schema %s", count, tenant_schema)

        return count
