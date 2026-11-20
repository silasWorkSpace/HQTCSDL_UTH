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

        # Sắp xếp phân cấp đảm bảo cha luôn được insert trước con (tránh vi phạm fk_code_entity_parent)
        classes = [e for e in entities if e.kind == "class"]
        top_classes = [c for c in classes if not c.parent_id]
        nested_classes = [c for c in classes if c.parent_id]
        methods = [e for e in entities if e.kind == "method"]
        others = [e for e in entities if e.kind in ("endpoint", "parameter")]

        ordered = top_classes + nested_classes + methods + others
        count = 0

        # Tập hợp các ID trong batch hiện tại
        persisted_ids = {e.id for e in ordered}

        insert_sql = f"""
        MERGE [{tenant_schema}].[code_entity] AS target
        USING (SELECT %s AS id, %s AS repository_id, %s AS parent_id, %s AS kind,
                      %s AS name, %s AS signature, %s AS file_path, %s AS commit_hash) AS source
        ON (target.id = source.id)
        WHEN MATCHED THEN
            UPDATE SET target.signature = source.signature,
                       target.parent_id = source.parent_id,
                       target.name = source.name,
                       target.kind = source.kind,
                       target.updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
            INSERT (id, repository_id, parent_id, kind, name, signature, file_path, commit_hash)
            VALUES (source.id, source.repository_id, source.parent_id, source.kind,
                    source.name, source.signature, source.file_path, source.commit_hash);
        """

        if cursor is not None:
            for item in ordered:
                parent_id = item.parent_id
                if parent_id and parent_id not in persisted_ids:
                    try:
                        cursor.execute(
                            f"SELECT 1 FROM [{tenant_schema}].[code_entity] WHERE id = %s",
                            [parent_id],
                        )
                        if not cursor.fetchone():
                            logger.warning(
                                "Parent entity %s không tồn tại cho %s (%s). Gán parent_id = None để tránh lỗi FK.",
                                parent_id,
                                item.name,
                                item.kind,
                            )
                            parent_id = None
                        else:
                            persisted_ids.add(parent_id)
                    except Exception:
                        parent_id = None

                cursor.execute(
                    insert_sql,
                    [
                        item.id,
                        item.repository_id,
                        parent_id,
                        item.kind,
                        item.name,
                        item.signature,
                        item.file_path,
                        item.commit_hash,
                    ],
                )
                count += 1
            logger.info("Đã lưu %d code_entity vào schema %s", count, tenant_schema)

        return count
