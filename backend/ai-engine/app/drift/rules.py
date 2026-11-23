"""Quy tắc mức nghiêm trọng (DR-05, 06) và độ tin cậy gợi ý (DR-08).

Quy tắc đơn giản, dễ giải thích:
  - Xóa endpoint công khai            -> Critical
  - Đổi đường dẫn / HTTP method của endpoint -> Critical
  - Xóa class hoặc method             -> High
  - Đổi chữ ký (tham số, kiểu trả về) -> High
  - Đổi tên (code vẫn còn)            -> Medium
  - Nghi lệch ngữ nghĩa               -> Low (Medium nếu là endpoint)
  - Thực thể không công khai          -> hạ một bậc so với quy tắc trên
"""
from __future__ import annotations

from .models import CodeEntity, EntityKind, Severity

CONF_DELETED = 0.70
CONF_RENAMED = 0.90
CONF_SIGNATURE = 0.90
CONF_SEMANTIC = 0.40


def _adjust(sev: Severity, entity: CodeEntity) -> Severity:
    return sev if entity.is_public else sev.lowered()


def severity_deleted(old: CodeEntity) -> Severity:
    base = Severity.CRITICAL if old.kind is EntityKind.ENDPOINT else Severity.HIGH
    return _adjust(base, old)


def severity_renamed(old: CodeEntity) -> Severity:
    return _adjust(Severity.MEDIUM, old)


def severity_signature(old: CodeEntity, new: CodeEntity) -> Severity:
    contract_changed = old.kind is EntityKind.ENDPOINT and (
        (old.http_method, old.route) != (new.http_method, new.route)
    )
    base = Severity.CRITICAL if contract_changed else Severity.HIGH
    return _adjust(base, old)


def severity_semantic(old: CodeEntity) -> Severity:
    base = Severity.MEDIUM if old.kind is EntityKind.ENDPOINT else Severity.LOW
    return _adjust(base, old)
