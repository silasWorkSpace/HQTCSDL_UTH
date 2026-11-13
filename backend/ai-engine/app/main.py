"""
LivingDocs AI Engine - FastAPI Application & Event Worker
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.llm.factory import get_llm_provider
from app.llm.schemas import DocDraft
from app.consumers.kafka_bus import get_event_bus
from app.consumers.source_event_consumer import SourceEventConsumer
from app.consumers.ai_job_consumer import AiJobConsumer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ai-engine")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi động Kafka Consumers trong background
    bus = get_event_bus()
    source_consumer = SourceEventConsumer(bus)
    job_consumer = AiJobConsumer(bus)

    # Đăng ký handler cho 2 topic chính
    bus.register_consumer("ld.source-events", "ai-engine-source-events", source_consumer.handle_message)
    bus.register_consumer("ld.ai-jobs", "ai-engine-jobs", job_consumer.handle_message)

    # Kích hoạt worker threads
    bus.start()
    logger.info("LivingDocs AI Engine đã sẵn sàng. Kafka Bus và Consumers đã khởi động.")
    yield
    # Dọn dẹp khi tắt service
    bus.stop()
    logger.info("AI Engine đã dừng các Kafka Consumers.")


app = FastAPI(
    title="LivingDocs AI Engine",
    description="Phân hệ AI bóc tách cú pháp AST, phát hiện sai lệch tài liệu (Drift) và sinh tài liệu kỹ thuật tự động.",
    version="1.0.0",
    lifespan=lifespan,
)


# ===================== DTO Schemas =====================

class GenerateRequest(BaseModel):
    entities: List[Dict[str, Any]]
    template: Dict[str, Any]
    options: Optional[Dict[str, Any]] = None


class SourceEventSimulateRequest(BaseModel):
    tenant: Optional[str] = "demo"
    correlationId: Optional[str] = None
    repositoryId: Optional[str] = None
    eventType: Optional[str] = "push"
    githubRef: Optional[str] = "refs/heads/main"
    before: Optional[str] = "a1b2c3d4"
    after: Optional[str] = "e5f6g7h8"
    commits: Optional[List[Dict[str, Any]]] = None


class GenerateDocJobRequest(BaseModel):
    tenant: Optional[str] = "demo"
    correlationId: Optional[str] = None
    repositoryId: Optional[str] = None
    templateId: Optional[str] = None
    requestedBy: Optional[str] = None
    scopeType: Optional[str] = "FILE"
    scopeReference: Optional[str] = "OrderController.java"
    commitSha: Optional[str] = "HEAD"


# ===================== Endpoints =====================

@app.get("/health")
def health():
    bus = get_event_bus()
    return {
        "status": "UP",
        "service": "ai-engine",
        "kafkaEnabled": bus.enabled,
        "kafkaConnected": bus.producer is not None,
    }


@app.post("/api/v1/llm/generate", response_model=DocDraft)
def generate_document(req: GenerateRequest):
    """Sinh bản thảo tài liệu qua LLM Provider."""
    provider = get_llm_provider()
    return provider.generate_doc(req.entities, req.template, req.options)


@app.post("/api/v1/jobs/source-event")
def trigger_source_event(req: SourceEventSimulateRequest):
    """
    Tiếp nhận sự kiện mã nguồn (Push / PR), bóc tách AST, kiểm tra Drift
    và bắn sự kiện DRIFT_FOUND sang Kafka topic ld.ai-results.
    """
    consumer = SourceEventConsumer()
    message = {
        "type": "SOURCE_EVENT_RECEIVED",
        "tenant": req.tenant,
        "correlationId": req.correlationId,
        "payload": {
            "id": None,
            "repositoryId": req.repositoryId,
            "eventType": req.eventType,
            "githubRef": req.githubRef,
            "payload": {
                "before": req.before,
                "after": req.after,
                "commits": req.commits or [
                    {
                        "id": req.after,
                        "modified": ["OrderController.java"],
                        "added": [],
                        "removed": [],
                    }
                ],
            },
        },
    }
    return consumer.handle_message(message)


@app.post("/api/v1/jobs/generate-doc")
def trigger_generate_doc(req: GenerateDocJobRequest):
    """
    Tiếp nhận tác vụ GENERATE_DOC, gọi LLM sinh DocDraft
    và bắn sự kiện DOC_DRAFT sang Kafka topic ld.ai-results.
    """
    consumer = AiJobConsumer()
    message = {
        "type": "GENERATE_DOC",
        "tenant": req.tenant,
        "correlationId": req.correlationId,
        "payload": {
            "scopeType": req.scopeType,
            "scopeReference": req.scopeReference,
            "repositoryId": req.repositoryId,
            "templateId": req.templateId,
            "requestedBy": req.requestedBy,
            "commitSha": req.commitSha,
        },
    }
    return consumer.handle_message(message)


@app.get("/api/v1/kafka/status")
def kafka_status():
    """Xem trạng thái kết nối Kafka và các sự kiện đã gửi."""
    bus = get_event_bus()
    return {
        "bootstrapServers": bus.bootstrap_servers,
        "enabled": bus.enabled,
        "producerConnected": bus.producer is not None,
        "activeConsumersCount": len(bus.consumers),
        "totalSentMessages": len(bus.sent_events),
    }


@app.get("/api/v1/kafka/history")
def kafka_history(limit: int = 10):
    """Xem danh sách các sự kiện Kafka đã phát gần đây."""
    bus = get_event_bus()
    return bus.sent_events[-limit:]
