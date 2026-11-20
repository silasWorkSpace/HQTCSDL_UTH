"""Keep unit tests deterministic and independent of external LLM credentials."""
from __future__ import annotations

import os


def pytest_configure() -> None:
    os.environ.setdefault("LLM_PROVIDER", "mock")
