"""Index source snapshots and detect drift only against explicit document links."""
from __future__ import annotations

import json
import logging
import os
import urllib.parse
import urllib.request
import uuid
from typing import Any, Dict

from app.ast_analyzer.db_saver import CodeEntityDbSaver
from app.ast_analyzer.parsers.java_parser import JavaAstParser
from app.ast_analyzer.parsers.python_parser import PythonAstParser
from app.drift import SqlDriftRepository, analyze_change
from app.drift.semantic import get_semantic_provider
from app.drift.service import schema_of
from app.rag.chunker import chunk_source_file
from app.rag.db_saver import KnowledgeChunkDbSaver
from .kafka_bus import get_event_bus

logger = logging.getLogger(__name__)


class SourceEventConsumer:
    def __init__(self, event_bus=None, connection_factory=None, snapshot_fetcher=None, semantic_provider=None):
        self.bus = event_bus or get_event_bus()
        self.connection_factory = connection_factory or self._connect
        self.snapshot_fetcher = snapshot_fetcher or self._fetch_snapshot
        self.semantic_provider = semantic_provider or get_semantic_provider()

    @staticmethod
    def _connect():
        host = os.getenv("AI_ENGINE_SQLSERVER_HOST", "").strip()
        user = os.getenv("AI_ENGINE_SQLSERVER_USER", "").strip()
        password = os.getenv("AI_ENGINE_SQLSERVER_PASSWORD", "")
        if not host or not user or not password:
            raise RuntimeError("AI Engine SQL Server host/user/password configuration is required")
        try:
            import pytds
        except ImportError as exc:
            raise RuntimeError("python-tds is required for source analysis") from exc
        return pytds.connect(server=host, port=int(os.getenv("AI_ENGINE_SQLSERVER_PORT", "1433")),
                             database=os.getenv("AI_ENGINE_SQLSERVER_DATABASE", "livingdocs"),
                             user=user, password=password, timeout=8)

    @staticmethod
    def _fetch_snapshot(repository_id: str, commit_sha: str, tenant: str = "demo") -> list[dict[str, str]]:
        base = os.getenv("INTEGRATION_INTERNAL_URL", "").rstrip("/")
        token = os.getenv("INTERNAL_SERVICE_TOKEN", "")
        if not base or not token:
            raise RuntimeError("Integration snapshot URL and internal service token are required")
        url = (f"{base}/internal/v1/repositories/{repository_id}/snapshot?commitSha="
               f"{urllib.parse.quote(commit_sha, safe='')}")
        request = urllib.request.Request(url, headers={
            "X-LivingDocs-Internal-Token": token,
            "X-Tenant": tenant,
        })
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                result = json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            raise RuntimeError(f"Could not retrieve snapshot at {commit_sha}: {exc}") from exc
        if not isinstance(result, list) or any(
                not isinstance(row, dict) or not isinstance(row.get("path"), str)
                or not isinstance(row.get("content"), str) for row in result):
            raise ValueError("Integration returned an invalid source snapshot")
        return result

    @staticmethod
    def _index_snapshot(connection, tenant: str, repository_id: str, commit_sha: str,
                        files: list[dict[str, str]]) -> int:
        java, python = JavaAstParser(), PythonAstParser()
        entities = []
        for item in sorted(files, key=lambda row: row["path"]):
            path = item["path"]
            parser = java if path.endswith(".java") else python if path.endswith(".py") else None
            if parser is not None:
                entities.extend(parser.parse(item["content"], path, commit_sha, repository_id))
        cursor = connection.cursor()
        try:
            saved_entities = CodeEntityDbSaver().save_entities(
                entities, tenant_schema=schema_of(tenant), cursor=cursor)
            try:
                chunks = []
                for item in files:
                    chunks.extend(chunk_source_file(
                        item["path"], item["content"], commit_sha, repository_id, entities
                    ))
                KnowledgeChunkDbSaver().save_chunks(chunks, tenant_schema=schema_of(tenant), cursor=cursor)
            except Exception as e:
                logger.warning("Knowledge chunk persistence skipped: %s", e)
            return saved_entities
        finally:
            cursor.close()

    @staticmethod
    def _update_run(connection, tenant: str, run_id: str, status: str,
                    files_indexed: int = 0, entities_indexed: int = 0,
                    error_message: str | None = None) -> None:
        try:
            run_uuid = str(uuid.UUID(run_id))
        except (ValueError, TypeError) as exc:
            raise ValueError("analysisRunId must be a UUID") from exc
        schema = schema_of(tenant)
        cursor = connection.cursor()
        try:
            if status == "running":
                cursor.execute(
                    f"UPDATE [{schema}].analysis_run SET status='running', started_at=SYSUTCDATETIME() "
                    "WHERE id=%s AND status='queued'", [run_uuid])
            else:
                cursor.execute(
                    f"UPDATE [{schema}].analysis_run SET status=%s, files_indexed=%s, entities_indexed=%s, "
                    "error_message=%s, completed_at=SYSUTCDATETIME() WHERE id=%s",
                    [status, files_indexed, entities_indexed, (error_message or "")[:2000] or None, run_uuid])
            connection.commit()
        finally:
            cursor.close()

    def handle_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        payload = message.get("payload") or {}
        tenant = message.get("tenant") or "demo"
        source_event_id = payload.get("id")
        repository_id = payload.get("repositoryId")
        raw = payload.get("payload")
        try:
            webhook = json.loads(raw) if isinstance(raw, str) else (raw or {})
        except (TypeError, json.JSONDecodeError):
            webhook = {}

        if payload.get("createdByLivingDocs") or "LivingDocs-Document-ID:" in str(
                (webhook.get("pull_request") or {}).get("body", "")):
            return {"sourceEventId": source_event_id, "status": "skipped",
                    "reason": "LivingDocs documentation PR is excluded from source analysis"}
        if webhook.get("pull_request") and webhook.get("action") == "closed":
            return {"sourceEventId": source_event_id, "status": "skipped",
                    "reason": "Closed source pull request was analyzed on open/update"}

        pr = webhook.get("pull_request") or {}
        old_commit = (pr.get("base") or {}).get("sha") or webhook.get("before")
        new_commit = (pr.get("head") or {}).get("sha") or webhook.get("after")
        if old_commit == "0" * 40:
            old_commit = None
        run_id = payload.get("analysisRunId") or webhook.get("analysisRunId")
        result: Dict[str, Any] = {
            "sourceEventId": source_event_id, "repositoryId": repository_id,
            "beforeCommit": old_commit, "afterCommit": new_commit,
            "driftEventsPublished": 0, "status": "skipped",
        }
        if not source_event_id or not repository_id or not self._is_sha(new_commit):
            result["reason"] = "Source event is missing repository id or full head commit SHA"
            return result

        conn = self.connection_factory()
        files_indexed = entities_indexed = 0
        try:
            if run_id:
                self._update_run(conn, tenant, run_id, "running")
            base_files: list[dict[str, str]] = []
            if self._is_sha(old_commit) and old_commit != new_commit:
                base_files = self.snapshot_fetcher(str(repository_id), old_commit, tenant)
                entities_indexed += self._index_snapshot(conn, tenant, str(repository_id), old_commit, base_files)
                files_indexed += len(base_files)
            head_files = self.snapshot_fetcher(str(repository_id), new_commit, tenant)
            entities_indexed += self._index_snapshot(conn, tenant, str(repository_id), new_commit, head_files)
            files_indexed += len(head_files)
            conn.commit()
            result["filesIndexed"] = files_indexed
            result["entitiesIndexed"] = entities_indexed

            if not self._is_sha(old_commit) or old_commit == new_commit:
                result["status"] = "completed"
                result["reason"] = "Repository baseline indexed"
            else:
                events = analyze_change(
                    SqlDriftRepository(conn, tenant), tenant=tenant,
                    repository_id=str(repository_id), old_commit=old_commit, new_commit=new_commit,
                    source_event_id=str(source_event_id),
                    correlation_id=str(message.get("correlationId") or source_event_id),
                    semantic=self.semantic_provider,
                )
                for event in events:
                    if self.bus.publish("ld.ai-results", event.get("payload", {}).get("documentId"), event):
                        result["driftEventsPublished"] += 1
                result["status"] = "completed"
                result["reason"] = "No linked AST drift found" if not events else "Linked AST drift analyzed"

            if run_id:
                self._update_run(conn, tenant, run_id, "completed", files_indexed, entities_indexed)
            return result
        except Exception as exc:
            conn.rollback()
            if run_id:
                try:
                    self._update_run(conn, tenant, run_id, "failed", files_indexed, entities_indexed, str(exc))
                except Exception:
                    logger.exception("Could not persist analysis run failure status run=%s", run_id)
            raise
        finally:
            conn.close()

    @staticmethod
    def _is_sha(value: Any) -> bool:
        if not isinstance(value, str) or len(value) != 40 or value == "0" * 40:
            return False
        try:
            int(value, 16)
            return True
        except ValueError:
            return False
