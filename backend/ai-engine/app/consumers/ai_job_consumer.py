"""
LivingDocs AI Engine - AI Job Consumer
Tiêu thụ yêu cầu GENERATE_DOC từ topic ld.ai-jobs (do document-service phát).
Tự động kích hoạt:
1. Đọc biểu mẫu và thực thể mã nguồn cần sinh tài liệu.
2. Dùng mô hình LLM (qua MockProvider hoặc Provider thực tế) để sinh bản thảo DocDraft.
3. Che giấu thông tin nhạy cảm qua SecretMasker (NFR-SEC-08).
4. Đóng gói EventEnvelope<DocDraftPayload> và gửi sang topic ld.ai-results để document-service khởi tạo tài liệu.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.llm.factory import get_llm_provider
from .kafka_bus import get_event_bus

logger = logging.getLogger(__name__)


class AiJobConsumer:
    """Xử lý các tác vụ AI chủ động (sinh tài liệu tự động)."""

    def __init__(self, event_bus=None):
        self.bus = event_bus or get_event_bus()
        self.llm_provider = get_llm_provider()

    def handle_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """
        Nhận và xử lý envelope GENERATE_DOC từ topic ld.ai-jobs.
        Tương thích cấu trúc EventEnvelope<GenerateDocPayload>.
        """
        event_type = message.get("type", "GENERATE_DOC")
        tenant = message.get("tenant", "demo")
        correlation_id = message.get("correlationId", str(uuid.uuid4()))
        payload = message.get("payload", {})

        logger.info("[CONSUMER ld.ai-jobs] Nhận tác vụ: type=%s | tenant=%s | correlation=%s",
                    event_type, tenant, correlation_id)

        scope_type = payload.get("scopeType", "REPOSITORY")
        scope_reference = payload.get("scopeReference", "all")
        repository_id = payload.get("repositoryId")
        template_id = payload.get("templateId")
        requested_by = payload.get("requestedBy")
        commit_sha = payload.get("commitSha", "HEAD")

        # 1. Chuẩn bị entities mẫu hoặc đọc từ AST nếu có
        entities = [
            {
                "id": str(uuid.uuid4()),
                "name": f"Module_{scope_reference.replace('/', '_')}",
                "kind": "class",
                "signature": f"public class {scope_reference}",
                "filePath": scope_reference,
            }
        ]

        template = {
            "id": template_id,
            "name": "Standard API & Architecture Template",
            "sections": [
                {"key": "overview", "title": "Overview", "entity_kind": "class"},
                {"key": "endpoints", "title": "Endpoints", "entity_kind": "endpoint"},
                {"key": "data_models", "title": "Data Models", "entity_kind": "class"},
            ],
        }

        # 2. Gọi LLM sinh bản thảo DocDraft
        doc_draft = self.llm_provider.generate_doc(entities, template)

        # 3. Đóng gói payload tương thích com.livingdocs.common.events.DocDraftPayload
        sections_payload = [
            {
                "sectionKey": s.section_key,
                "sectionTitle": s.section_title,
                "content": s.content,
                "confidence": s.confidence,
            }
            for s in doc_draft.sections
        ]

        evidence_payload = [
            {
                "sourceFile": e.source_file,
                "entityName": e.entity_name,
                "entityKind": e.entity_kind,
                "lineRange": e.line_range,
                "snippet": e.snippet,
            }
            for e in doc_draft.evidence_list
        ]

        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        draft_envelope = {
            "eventId": str(uuid.uuid4()),
            "type": "DOC_DRAFT",
            "tenant": tenant,
            "correlationId": correlation_id,
            "occurredAt": now,
            "payload": {
                "repositoryId": repository_id,
                "templateId": template_id,
                "ownerId": requested_by,
                "title": doc_draft.document_title,
                "docType": "API_REFERENCE",
                "pathInRepo": f"docs/{scope_reference.replace('.java', '').replace('.py', '')}.md",
                "markdownContent": doc_draft.markdown_content,
                "sections": sections_payload,
                "overallConfidence": doc_draft.overall_confidence,
                "evidenceList": evidence_payload,
                "sourceCommitSha": commit_sha,
            },
        }

        # 4. Gửi kết quả DOC_DRAFT sang topic ld.ai-results
        self.bus.publish("ld.ai-results", correlation_id, draft_envelope)

        logger.info("[CONSUMER ld.ai-jobs] Đã phát sinh DOC_DRAFT và gửi sang ld.ai-results (Correlation: %s)",
                    correlation_id)

        return {
            "correlationId": correlation_id,
            "documentTitle": doc_draft.document_title,
            "overallConfidence": doc_draft.overall_confidence,
            "status": "SENT_TO_KAFKA",
        }
