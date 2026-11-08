"""Kiểm tra Semantic (DR-04, nếu có). Tuần này dùng bản mock, không gọi LLM thật.

Tuần sau thay MockSemanticProvider bằng lớp bọc `LlmProvider` của Linh,
giữ nguyên giao diện `assess`.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .models import CodeEntity


@dataclass(frozen=True)
class SemanticVerdict:
    reason: str
    confidence: float


class SemanticProvider(Protocol):
    def assess(self, old: CodeEntity, new: CodeEntity) -> SemanticVerdict | None: ...


class MockSemanticProvider:
    """Cờ nghi ngờ khi phần thân đổi (body_hash khác) mà chữ ký giữ nguyên."""

    def assess(self, old: CodeEntity, new: CodeEntity) -> SemanticVerdict | None:
        if old.body_hash and new.body_hash and old.body_hash != new.body_hash:
            return SemanticVerdict(
                reason=(
                    f"Phần thân `{new.short_name}` đã thay đổi trong khi chữ ký giữ nguyên, "
                    "mô tả trong tài liệu có thể không còn đúng."
                ),
                confidence=0.40,
            )
        return None
