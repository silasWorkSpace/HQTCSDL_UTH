"""Dựng message DRIFT_FOUND cho topic ld.ai-results.

Khớp với phía nhận (workflow-service: AiResultsConsumer + DriftService.onDriftFound):

  envelope : { eventId(UUID), type, tenant, correlationId(UUID), occurredAt, payload }
  payload  : { documentId, sourceEventId,
               findings: [ { driftType, severity, evidence, suggestion:{content, confidence} } ] }

Ràng buộc của phía nhận mà module này phải tôn trọng:
  * Một message chỉ nói về MỘT tài liệu  -> phát mỗi tài liệu một message.
  * drift_alert là duy nhất theo (source_event, document, drift_type) -> gộp các
    finding cùng loại của một tài liệu thành một finding (severity cao nhất).
  * update_suggestion cũ của cùng tài liệu bị Superseded khi có bản mới
    (sp_supersede_stale_suggestions) -> mỗi tài liệu chỉ gửi MỘT gợi ý, gộp nội
    dung của mọi finding, để không mất gợi ý nào.
"""
from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Sequence

from .detector import _NS
from .models import DriftFinding, Severity

DRIFT_FOUND = "DRIFT_FOUND"


def _as_uuid(value: str, seed: str) -> str:
    """Giữ nguyên nếu đã là UUID, nếu không thì sinh UUID ổn định từ giá trị đó."""
    try:
        return str(uuid.UUID(str(value)))
    except ValueError:
        return str(uuid.uuid5(_NS, f"{seed}|{value}"))


def _entity_evidence(f: DriftFinding) -> dict:
    return {
        "entity": f.entity,
        "kind": f.kind.value,
        "severity": f.severity.value,
        "sections": list(f.sections),
        "message": f.message,
        "old": f.evidence.get("old"),
        "new": f.evidence.get("new"),
    }


def _document_payload(doc_id: str, findings: Sequence[DriftFinding], source_event_id: str) -> dict:
    # findings đã được detect() sắp theo mức nghiêm trọng giảm dần; giữ thứ tự đó.
    by_type: dict[str, list[DriftFinding]] = defaultdict(list)
    for f in findings:
        by_type[f.drift_type.value].append(f)

    groups = []
    for dtype, items in by_type.items():
        top = max(items, key=lambda x: x.severity.rank)
        groups.append(
            {
                "driftType": dtype.capitalize(),  # Referential | Signature | Semantic
                "severity": top.severity.value,
                "evidence": {"entities": [_entity_evidence(x) for x in items]},
            }
        )
    groups.sort(key=lambda g: (-Severity(g["severity"]).rank, g["driftType"]))

    with_suggestion = [f for f in findings if f.suggestion is not None]
    if with_suggestion and groups:
        lines = [f"{i}. {f.suggestion.text}" for i, f in enumerate(with_suggestion, 1)]
        groups[0]["suggestion"] = {
            "content": "\n".join(lines),
            # Gợi ý gộp chỉ đáng tin bằng phần kém chắc chắn nhất trong số đó.
            "confidence": round(min(f.suggestion.confidence for f in with_suggestion), 2),
        }

    return {"documentId": doc_id, "sourceEventId": source_event_id, "findings": groups}


def build_drift_found_events(
    findings: Sequence[DriftFinding],
    *,
    tenant: str,
    correlation_id: str,
    source_event_id: str,
    occurred_at: str | None = None,
) -> list[dict]:
    """Trả về danh sách envelope DRIFT_FOUND, mỗi tài liệu một message.

    `source_event_id` là id của bản ghi source_event đã sinh ra lần phân tích này
    (phải là UUID, phía nhận lưu vào drift_alert.source_event_id).
    """
    if not findings:
        return []
    source_event_id = str(uuid.UUID(str(source_event_id)))
    corr = _as_uuid(correlation_id, "correlation")
    now = occurred_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    per_doc: dict[str, list[DriftFinding]] = defaultdict(list)
    for f in findings:
        per_doc[f.doc_id].append(f)

    events = []
    for doc_id in sorted(per_doc):
        items = per_doc[doc_id]
        ids = ",".join(sorted(f.finding_id for f in items))
        events.append(
            {
                "eventId": str(uuid.uuid5(_NS, f"{tenant}|{corr}|{doc_id}|{ids}")),
                "type": DRIFT_FOUND,
                "tenant": tenant,
                "correlationId": corr,
                "occurredAt": now,
                "payload": _document_payload(doc_id, items, source_event_id),
            }
        )
    return events
