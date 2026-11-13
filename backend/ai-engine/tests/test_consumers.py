import pytest
import uuid
from app.consumers.kafka_bus import KafkaEventBus
from app.consumers.source_event_consumer import SourceEventConsumer
from app.consumers.ai_job_consumer import AiJobConsumer


def test_kafka_bus_in_memory_fallback():
    bus = KafkaEventBus()
    envelope = {
        "eventId": str(uuid.uuid4()),
        "type": "TEST_EVENT",
        "tenant": "demo",
        "payload": {"hello": "world"},
    }
    success = bus.publish("test-topic", "key-1", envelope)
    assert success is True
    assert len(bus.sent_events) >= 1
    assert bus.sent_events[-1]["topic"] == "test-topic"
    assert bus.sent_events[-1]["envelope"]["type"] == "TEST_EVENT"


def test_ai_job_consumer_publishes_doc_draft():
    bus = KafkaEventBus()
    consumer = AiJobConsumer(event_bus=bus)

    job_message = {
        "type": "GENERATE_DOC",
        "tenant": "demo",
        "correlationId": str(uuid.uuid4()),
        "payload": {
            "scopeType": "FILE",
            "scopeReference": "OrderService.java",
            "repositoryId": str(uuid.uuid4()),
            "templateId": str(uuid.uuid4()),
            "requestedBy": str(uuid.uuid4()),
            "commitSha": "abc12345",
        },
    }

    result = consumer.handle_message(job_message)
    assert result["status"] == "SENT_TO_KAFKA"
    assert "documentTitle" in result

    # Kiểm tra event đã gửi lên ld.ai-results
    ai_results = [e for e in bus.sent_events if e["topic"] == "ld.ai-results"]
    assert len(ai_results) >= 1

    last_event = ai_results[-1]["envelope"]
    assert last_event["type"] == "DOC_DRAFT"
    assert last_event["tenant"] == "demo"
    assert "markdownContent" in last_event["payload"]
    assert last_event["payload"]["sourceCommitSha"] == "abc12345"
    assert len(last_event["payload"]["sections"]) > 0


def test_source_event_consumer_publishes_drift_found():
    bus = KafkaEventBus()
    consumer = SourceEventConsumer(event_bus=bus)

    source_message = {
        "type": "SOURCE_EVENT_RECEIVED",
        "tenant": "demo",
        "correlationId": str(uuid.uuid4()),
        "payload": {
            "id": str(uuid.uuid4()),
            "repositoryId": str(uuid.uuid4()),
            "eventType": "push",
            "githubRef": "refs/heads/main",
            "payload": {
                "before": "11112222",
                "after": "33334444",
                "commits": [
                    {
                        "id": "33334444",
                        "modified": ["OrderController.java", "UserService.py"],
                        "added": [],
                        "removed": [],
                    }
                ],
            },
        },
    }

    summary = consumer.handle_message(source_message)
    assert summary["sourceFilesCount"] == 2
    assert summary["driftEventsPublished"] >= 1

    # Kiểm tra event DRIFT_FOUND đã gửi sang ld.ai-results
    drift_events = [e for e in bus.sent_events if e["topic"] == "ld.ai-results" and e["envelope"]["type"] == "DRIFT_FOUND"]
    assert len(drift_events) >= 1

    envelope = drift_events[-1]["envelope"]
    assert envelope["type"] == "DRIFT_FOUND"
    assert envelope["tenant"] == "demo"
    payload = envelope["payload"]
    assert "documentId" in payload
    assert "findings" in payload
    assert len(payload["findings"]) >= 1
    finding = payload["findings"][0]
    assert "driftType" in finding
    assert "severity" in finding
    assert "evidence" in finding
