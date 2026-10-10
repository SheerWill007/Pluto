"""
Fixed-window rate limiting, backed by Redis when available (shared across workers and
replicas) and by process memory otherwise.
"""

import logging
import threading
import time
from typing import Callable

from fastapi import Request

from config.settings import settings
from core.errors import RateLimitError
from memory.redis_client import get_redis, mark_redis_failed

logger = logging.getLogger(__name__)

WINDOW_SECONDS = 60

_local_counts: dict = {}
_local_lock = threading.Lock()


def client_identifier(request: Request) -> str:
    # Behind a reverse proxy (Render, nginx, ALB) the real client is the first X-Forwarded-For hop
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _hit_local(key: str, window: int) -> int:
    with _local_lock:
        count = _local_counts.get((key, window), 0) + 1
        _local_counts[(key, window)] = count
        # Opportunistic cleanup of expired windows
        if len(_local_counts) > 10_000:
            for k in [k for k in _local_counts if k[1] < window]:
                del _local_counts[k]
        return count


def hit(key: str) -> tuple[int, int]:
    """Registers a request for `key`; returns (count in current window, seconds until reset)."""
    now = time.time()
    window = int(now // WINDOW_SECONDS)
    reset_in = WINDOW_SECONDS - int(now % WINDOW_SECONDS)

    client = get_redis()
    if client is not None:
        try:
            redis_key = f"ratelimit:{key}:{window}"
            pipe = client.pipeline()
            pipe.incr(redis_key)
            pipe.expire(redis_key, WINDOW_SECONDS + 1)
            count, _ = pipe.execute()
            return int(count), reset_in
        except Exception as e:
            logger.warning("Redis rate limit failed, using local counter: %s", e)
            mark_redis_failed()
    return _hit_local(key, window), reset_in


def reset_local_counters() -> None:
    with _local_lock:
        _local_counts.clear()


def rate_limit(scope: str, limit: Callable[[], int]):
    """
    Dependency factory. `limit` is a callable so the value is read from settings at request
    time (allowing configuration changes and test overrides).
    """
    def dependency(request: Request) -> None:
        if not settings.RATE_LIMIT_ENABLED:
            return
        max_requests = limit()
        count, reset_in = hit(f"{scope}:{client_identifier(request)}")
        if count > max_requests:
            raise RateLimitError(
                f"Too many requests. Try again in {reset_in} seconds.",
                retry_after=reset_in,
            )

    return dependency


default_rate_limit = rate_limit("api", lambda: settings.RATE_LIMIT_PER_MINUTE)
auth_rate_limit = rate_limit("auth", lambda: settings.AUTH_RATE_LIMIT_PER_MINUTE)
