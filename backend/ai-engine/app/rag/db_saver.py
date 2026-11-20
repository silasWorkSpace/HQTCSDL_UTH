"""Persistence for knowledge chunks in SQL Server."""
from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class KnowledgeChunkDbSaver:
    def save_chunks(self, chunks: List[Dict[str, Any]], tenant_schema: str, cursor: Any) -> int:
        if not chunks:
            return 0

        inserted = 0
        for chunk in chunks:
            chunk_id = str(uuid.uuid4())
            repo_id = chunk.get("repository_id")
            doc_id = chunk.get("document_id")
            doc_ver_id = chunk.get("document_version_id")
            commit_sha = chunk.get("commit_sha")
            file_path = chunk.get("file_path")
            chunk_type = chunk.get("chunk_type", "CODE")
            content = chunk.get("content", "")
            checksum = chunk.get("checksum", "")
            entity_links = chunk.get("entity_links", "[]")
            embedding_model = chunk.get("embedding_model")
            embedding_vector = chunk.get("embedding_vector")

            sql = (
                f"INSERT INTO [{tenant_schema}].[knowledge_chunk] "
                "(id, repository_id, document_id, document_version_id, commit_sha, file_path, "
                " chunk_type, content, checksum, entity_links, embedding_model, embedding_vector, "
                " created_at, updated_at) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, SYSUTCDATETIME(), SYSUTCDATETIME())"
            )
            params = [
                chunk_id, repo_id, doc_id, doc_ver_id, commit_sha, file_path,
                chunk_type, content, checksum, entity_links, embedding_model, embedding_vector
            ]
            try:
                cursor.execute(sql, params)
                inserted += 1
            except Exception as e:
                # Fallback for ? parameter styles (sqlite/pyodbc in unit tests)
                try:
                    alt_sql = sql.replace("%s", "?")
                    cursor.execute(alt_sql, params)
                    inserted += 1
                except Exception as ex:
                    logger.warning("Could not persist chunk %s: %s", chunk_id, ex)

        return inserted

    def delete_repository_chunks(self, repository_id: str, tenant_schema: str, cursor: Any) -> int:
        sql = f"DELETE FROM [{tenant_schema}].[knowledge_chunk] WHERE repository_id = %s"
        try:
            cursor.execute(sql, [repository_id])
            return cursor.rowcount if hasattr(cursor, "rowcount") else 0
        except Exception:
            cursor.execute(sql.replace("%s", "?"), [repository_id])
            return cursor.rowcount if hasattr(cursor, "rowcount") else 0
