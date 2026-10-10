"""Shared helpers for API routers."""

import logging
from typing import Callable, Optional, TypeVar

from fastapi import Request

from agents.common import LLMSelection
from core.errors import AppError, UpstreamError, friendly_llm_error
from core.logging import request_id_var
from core.rate_limit import client_identifier
from memory.postgres_memory import record_audit_event
from schemas.request_models import LLMOptions

logger = logging.getLogger(__name__)

T = TypeVar("T")


def llm_selection(options: LLMOptions) -> LLMSelection:
    def clean(value: Optional[str]) -> Optional[str]:
        return value.strip() if value and value.strip() else None
    return LLMSelection(provider=clean(options.provider), model=clean(options.model), api_key=clean(options.api_key))


def call_llm(fn: Callable[..., T], *args, **kwargs) -> T:
    """Runs an agent, translating provider failures into a 502 with an actionable message."""
    try:
        return fn(*args, **kwargs)
    except AppError:
        raise
    except Exception as e:
        logger.warning("LLM call failed: %s", e, exc_info=True)
        raise UpstreamError(friendly_llm_error(e)) from e


def audit(request: Request, action: str, actor: Optional[str], **details) -> None:
    record_audit_event(action, actor, client_identifier(request), request_id_var.get(), details or None)
