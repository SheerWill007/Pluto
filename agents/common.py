"""Shared helpers for agents: response normalization and instrumentation."""

import logging
import time
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Optional

from core.metrics import LLM_CALLS, LLM_LATENCY

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class LLMSelection:
    """The model a request asked for. Unset fields fall back to server configuration."""
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None


def message_text(content: Any) -> str:
    """
    Normalizes LangChain message content to plain text. Anthropic and Gemini can return a
    list of content parts (text, thinking, tool_use...) instead of a string.
    """
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict) and part.get("type") in (None, "text"):
                parts.append(part.get("text", ""))
        return "".join(parts)
    return str(content)


@contextmanager
def track_llm_call(agent: str, provider: Optional[str]):
    """Records latency and outcome of an agent invocation in Prometheus and the logs."""
    provider_label = provider or "default"
    start = time.perf_counter()
    outcome = "error"
    try:
        yield
        outcome = "success"
    finally:
        elapsed = time.perf_counter() - start
        LLM_CALLS.labels(agent, provider_label, outcome).inc()
        LLM_LATENCY.labels(agent, provider_label).observe(elapsed)
        logger.info("agent=%s provider=%s outcome=%s duration_ms=%.0f", agent, provider_label, outcome,
                    elapsed * 1000, extra={"agent": agent, "provider": provider_label, "outcome": outcome,
                                           "duration_ms": round(elapsed * 1000, 1)})
