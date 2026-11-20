import pytest
import uuid

from app.consumers.kafka_bus import KafkaEventBus
from app.consumers.source_event_consumer import SourceEventConsumer
from app.consumers.ai_job_consumer import AiJobConsumer
from app.llm.mock_provider import MockProvider


class FakeCursor:
    def __init__(self, connection):
        self.connection = connection
        self.row = None

    def execute(self, sql, params):
        self.connection.calls.append((sql, params))
        if "SELECT retry_count" in sql:
            self.row = (self.connection.retry_count,)
        elif "SET retry_count=" in sql or "SET retry_count=?" in sql:
            self.connection.retry_count = params[0]

    def fetchone(self):
        return self.row

    def close(self):
        pass


class FakeConnection:
    def __init__(self):
        self.retry_count = 0
        self.calls = []
        self.commits = 0
        self.closed = False

    def cursor(self):
        return FakeCursor(self)

    def commit(self):
        self.commits += 1

    def close(self):
        self.closed = True


def test_kafka_bus_in_memory_fallback():
    bus = KafkaEventBus()
    envelope = {"eventId": str(uuid.uuid4()), "type": "TEST_EVENT", "tenant": "demo",
                "payload": {"hello": "world"}}
    assert bus.publish("test-topic", "key-1", envelope) is True
    assert bus.sent_events[-1]["topic"] == "test-topic"
    assert bus.sent_events[-1]["envelope"]["type"] == "TEST_EVENT"


def test_ai_job_requires_persisted_job_uuid():
    consumer = AiJobConsumer(event_bus=KafkaEventBus())
    message = {"type": "GENERATE_DOC", "tenant": "demo", "payload": {
        "scopeType": "FILE", "scopeReference": "OrderService.java",
        "commitSha": "a" * 40,
    }}
    with pytest.raises(ValueError, match="UUID correlationId"):
        consumer.handle_message(message)


def test_ai_job_publishes_grounded_draft_and_persists_retryable_state():
    bus = KafkaEventBus()
    connection = FakeConnection()
    consumer = AiJobConsumer(event_bus=bus, connection_factory=lambda: connection, sleep_fn=lambda _: None)
    consumer.llm_provider = MockProvider()
    job_id = str(uuid.uuid4())
    message = {"type": "GENERATE_DOC", "tenant": "demo", "correlationId": job_id, "payload": {
        "repositoryId": str(uuid.uuid4()), "commitSha": "a" * 40,
        "requestedBy": str(uuid.uuid4()), "title": "API guide", "pathInRepo": "docs/api.md",
        "codeEntityIds": ["entity-1"],
        "entities": [{"id": "entity-1", "name": "Orders", "kind": "class", "file_path": "Orders.java"}],
    }}
    result = consumer.handle_message(message)
    draft = bus.sent_events[-1]["envelope"]
    assert result["status"] == "SENT_TO_KAFKA"
    assert draft["type"] == "DOC_DRAFT"
    assert draft["payload"]["title"] == "API guide"
    assert draft["payload"]["pathInRepo"] == "docs/api.md"
    assert draft["payload"]["codeEntityIds"] == ["entity-1"]
    assert any("SET status='running'" in sql for sql, _ in connection.calls)
    assert connection.closed


def test_ai_job_retries_then_moves_to_dlq_after_backoff_schedule():
    connection = FakeConnection()
    delays = []
    consumer = AiJobConsumer(event_bus=KafkaEventBus(), connection_factory=lambda: connection,
                             sleep_fn=delays.append)
    class BrokenProvider:
        def generate_doc(self, *_args):
            raise TimeoutError("sensitive provider URL")
    consumer.llm_provider = BrokenProvider()
    job_id = str(uuid.uuid4())
    message = {"type": "GENERATE_DOC", "tenant": "demo", "correlationId": job_id, "payload": {
        "commitSha": "a" * 40, "title": "API guide", "pathInRepo": "docs/api.md",
        "codeEntityIds": ["e1"], "entities": [{"id": "e1", "name": "Api", "kind": "class", "file_path": "Api.java"}],
    }}
    result = consumer.handle_message(message)
    assert result == {"jobId": job_id, "status": "FAILED", "retryCount": 3}
    assert delays == [10, 30, 90]
    assert connection.retry_count == 3
    assert any("status='failed'" in sql and "in_dlq=1" in sql for sql, _ in connection.calls)
    assert all("sensitive provider URL" not in str(params) for _, params in connection.calls)


def test_ai_job_sends_permanent_provider_error_to_dlq_without_retry():
    from app.llm.base import LlmProviderError

    connection = FakeConnection()
    delays = []
    consumer = AiJobConsumer(event_bus=KafkaEventBus(), connection_factory=lambda: connection,
                             sleep_fn=delays.append)
    class InvalidRequestProvider:
        def generate_doc(self, *_args):
            raise LlmProviderError("Gemini request rejected with HTTP 400 (INVALID_ARGUMENT)",
                                   upstream_status=400, provider_code="INVALID_ARGUMENT", retryable=False)
    consumer.llm_provider = InvalidRequestProvider()
    job_id = str(uuid.uuid4())
    message = {"type": "GENERATE_DOC", "tenant": "demo", "correlationId": job_id, "payload": {
        "commitSha": "a" * 40, "title": "API guide", "pathInRepo": "docs/api.md",
        "codeEntityIds": ["e1"], "entities": [{"id": "e1", "name": "Api", "kind": "class", "file_path": "Api.java"}],
    }}

    result = consumer.handle_message(message)

    assert result == {"jobId": job_id, "status": "FAILED", "retryCount": 0}
    assert delays == []
    assert connection.retry_count == 0
    assert any("status='failed'" in sql and "in_dlq=1" in sql for sql, _ in connection.calls)


def test_source_event_rejects_abbreviated_commit_shas_without_fabricating_drift():
    bus = KafkaEventBus()
    consumer = SourceEventConsumer(event_bus=bus)
    message = {"type": "SOURCE_EVENT_RECEIVED", "tenant": "demo", "correlationId": str(uuid.uuid4()),
               "payload": {"id": str(uuid.uuid4()), "repositoryId": str(uuid.uuid4()),
                           "eventType": "commit", "payload": {"before": "11112222", "after": "33334444"}}}
    result = consumer.handle_message(message)
    assert result["status"] == "skipped"
    assert "full head commit SHA" in result["reason"]
    assert not [e for e in bus.sent_events if e["topic"] == "ld.ai-results"]


def test_documentation_pull_request_is_skipped_by_source_analyzer():
    bus = KafkaEventBus()
    consumer = SourceEventConsumer(event_bus=bus)
    message = {"type": "SOURCE_EVENT_RECEIVED", "tenant": "demo", "payload": {
        "id": str(uuid.uuid4()), "repositoryId": str(uuid.uuid4()), "createdByLivingDocs": True,
        "payload": {"pull_request": {"body": "LivingDocs-Document-ID: " + str(uuid.uuid4())}}
    }}
    result = consumer.handle_message(message)
    assert result["status"] == "skipped"
    assert "documentation PR" in result["reason"]


def test_source_analysis_run_updates_use_python_tds_parameter_style():
    class Cursor:
        def __init__(self):
            self.calls = []

        def execute(self, sql, params):
            self.calls.append((sql, params))

        def close(self):
            pass

    class Connection:
        def __init__(self):
            self.db_cursor = Cursor()
            self.commits = 0

        def cursor(self):
            return self.db_cursor

        def commit(self):
            self.commits += 1

    connection = Connection()
    run_id = str(uuid.uuid4())

    SourceEventConsumer._update_run(connection, "demo", run_id, "running")
    SourceEventConsumer._update_run(connection, "demo", run_id, "failed", 3, 7, "snapshot failed")

    assert connection.commits == 2
    assert connection.db_cursor.calls[0][0].endswith("WHERE id=%s AND status='queued'")
    assert connection.db_cursor.calls[0][1] == [run_id]
    assert connection.db_cursor.calls[1][0].count("%s") == 5
    assert connection.db_cursor.calls[1][1] == ["failed", 3, 7, "snapshot failed", run_id]
