"""Generate grounded document drafts with persisted job state and bounded retries."""
from __future__ import annotations

import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict

from app.drift.service import schema_of
from app.llm.factory import get_llm_provider
from .kafka_bus import get_event_bus

logger = logging.getLogger(__name__)
RETRY_DELAYS = (10, 30, 90)


class AiJobConsumer:
    def __init__(self, event_bus=None, connection_factory=None, sleep_fn: Callable[[float], None] = time.sleep):
        self.bus = event_bus or get_event_bus()
        self.connection_factory = connection_factory or self._connect
        self.sleep_fn = sleep_fn
        self.llm_provider = None

    @staticmethod
    def _connect():
        host = os.getenv("AI_ENGINE_SQLSERVER_HOST", "").strip()
        user = os.getenv("AI_ENGINE_SQLSERVER_USER", "").strip()
        password = os.getenv("AI_ENGINE_SQLSERVER_PASSWORD", "")
        if not host or not user or not password:
            raise RuntimeError("AI Engine SQL Server host/user/password configuration is required")
        import pytds
        return pytds.connect(server=host, port=int(os.getenv("AI_ENGINE_SQLSERVER_PORT", "1433")),
                             database=os.getenv("AI_ENGINE_SQLSERVER_DATABASE", "livingdocs"),
                             user=user, password=password, timeout=8)

    @staticmethod
    def _execute(connection, sql: str, params: list[Any] = ()):
        is_sqlite = "sqlite" in type(connection).__module__.lower()
        query = sql.replace("%s", "?") if is_sqlite else sql.replace("?", "%s")
        cursor = connection.cursor()
        try:
            cursor.execute(query, list(params))
        finally:
            cursor.close()

    def _mark_running(self, connection, schema: str, job_id: str):
        self._execute(connection,
                      f"UPDATE [{schema}].ai_job SET status='running', updated_at=SYSUTCDATETIME() "
                      "WHERE id=%s AND job_type='doc_generation' AND in_dlq=0", [job_id])
        connection.commit()

    def _record_failure(self, connection, schema: str, job_id: str, error: Exception) -> tuple[int | None, int]:
        is_sqlite = "sqlite" in type(connection).__module__.lower()

        def _adapt(sql: str) -> str:
            return sql.replace("%s", "?") if is_sqlite else sql.replace("?", "%s")

        cursor = connection.cursor()
        try:
            cursor.execute(_adapt(f"SELECT retry_count FROM [{schema}].ai_job WITH (UPDLOCK, ROWLOCK) WHERE id=%s"), [job_id])
            row = cursor.fetchone()
            if row is None:
                raise ValueError("AI job was not persisted")
            retries = int(row[0])
            safe_error = f"Document generation failed ({type(error).__name__})"
            retryable = getattr(error, "retryable", True)
            if retryable and retries < len(RETRY_DELAYS):
                delay = RETRY_DELAYS[retries]
                cursor.execute(
                    _adapt(f"UPDATE [{schema}].ai_job SET retry_count=%s, status='retrying', in_dlq=0, "
                           "next_retry_at=DATEADD(SECOND, %s, SYSUTCDATETIME()), error_message=%s, "
                           "updated_at=SYSUTCDATETIME() WHERE id=%s"),
                    [retries + 1, delay, safe_error, job_id])
                connection.commit()
                return delay, retries + 1
            cursor.execute(
                _adapt(f"UPDATE [{schema}].ai_job SET status='failed', in_dlq=1, next_retry_at=NULL, "
                       "error_message=%s, updated_at=SYSUTCDATETIME() WHERE id=%s"),
                [safe_error, job_id])
            connection.commit()
            # Permanent provider errors must retain the persisted retry count.  Returning
            # the retry budget here made callers report three retries even when no retry
            # was attempted.
            return None, retries
        finally:
            cursor.close()

    def handle_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        if message.get("type", "GENERATE_DOC") != "GENERATE_DOC":
            raise ValueError("Unsupported AI job type")
        tenant = message.get("tenant") or "demo"
        job_id = str(message.get("correlationId") or "")
        try:
            job_id = str(uuid.UUID(job_id))
        except ValueError as exc:
            raise ValueError("Generation job must have a UUID correlationId") from exc
        schema = schema_of(tenant)
        connection = self.connection_factory()
        try:
            for attempt in range(len(RETRY_DELAYS) + 1):
                self._mark_running(connection, schema, job_id)
                try:
                    return self._generate(message)
                except Exception as exc:
                    delay, retry_count = self._record_failure(connection, schema, job_id, exc)
                    if delay is None:
                        logger.exception("Document generation reached DLQ job=%s", job_id)
                        return {"jobId": job_id, "status": "FAILED", "retryCount": retry_count}
                    logger.warning("Document generation retry %d/%d job=%s after %ss (%s)",
                                   attempt + 1, len(RETRY_DELAYS), job_id, delay, type(exc).__name__)
                    self.sleep_fn(delay)
            raise RuntimeError("Unreachable generation retry state")
        finally:
            connection.close()

    def _generate(self, message: Dict[str, Any]) -> Dict[str, Any]:
        tenant = message.get("tenant") or "demo"
        correlation_id = message["correlationId"]
        payload = message.get("payload") or {}
        commit_sha = payload.get("commitSha")
        entities = payload.get("entities")
        if not isinstance(entities, list) or not entities:
            raise ValueError("Document generation requires non-empty parser-indexed code entities")
        if not isinstance(commit_sha, str) or len(commit_sha) != 40:
            raise ValueError("Document generation requires a full source commit SHA")
        title = (payload.get("title") or "").strip()
        path_in_repo = (payload.get("pathInRepo") or "").strip()
        selected_ids = payload.get("codeEntityIds") or []
        if not title or not path_in_repo or not selected_ids:
            raise ValueError("Document generation requires a title, target path and selected entity IDs")
        entity_ids = {str(row.get("id")).lower() for row in entities if isinstance(row, dict)}
        if not {str(sid).lower() for sid in selected_ids}.issubset(entity_ids):
            raise ValueError("Selected code entity IDs do not match supplied indexed entities")

        template = {"id": payload.get("templateId"), "name": title, "sections": [
            {"key": "overview", "title": "Overview", "entity_kind": "class"},
            {"key": "endpoints", "title": "Endpoints", "entity_kind": "endpoint"},
            {"key": "data_models", "title": "Data Models", "entity_kind": "class"},
        ]}
        provider = self.llm_provider or get_llm_provider()
        draft = provider.generate_doc(entities, template, {"commit_sha": commit_sha})
        sections = [{"sectionKey": s.section_key, "sectionTitle": s.section_title,
                     "content": s.content, "confidence": s.confidence} for s in draft.sections]
        evidence = [{"sourceFile": e.source_file, "entityName": e.entity_name,
                     "entityKind": e.entity_kind, "lineRange": e.line_range, "snippet": e.snippet}
                    for e in draft.evidence_list]
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        result = {"eventId": str(uuid.uuid4()), "type": "DOC_DRAFT", "tenant": tenant,
                  "correlationId": correlation_id, "occurredAt": now, "payload": {
                      "repositoryId": payload.get("repositoryId"), "templateId": payload.get("templateId"),
                      "ownerId": payload.get("requestedBy"), "title": title, "docType": "API_REFERENCE",
                      "pathInRepo": path_in_repo, "markdownContent": draft.markdown_content,
                      "sections": sections, "overallConfidence": draft.overall_confidence,
                      "evidenceList": evidence, "sourceCommitSha": commit_sha,
                      "codeEntityIds": selected_ids}}
        if not self.bus.publish("ld.ai-results", correlation_id, result):
            raise RuntimeError("AI result event could not be published")
        return {"jobId": correlation_id, "correlationId": correlation_id,
                "documentTitle": draft.document_title, "overallConfidence": draft.overall_confidence,
                "status": "SENT_TO_KAFKA"}
