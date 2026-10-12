"""
Shared, lazily-connected Redis client.

Connection failures are not cached forever: after a failure we retry at most every
RETRY_SECONDS, so the app recovers automatically when Redis comes back.
"""

import logging
import threading
import time
from typing import Optional

import redis

from config.settings import settings

logger = logging.getLogger(__name__)

RETRY_SECONDS = 30

_lock = threading.Lock()
_client: Optional[redis.Redis] = None
_last_failure: float = 0.0


def _connect() -> redis.Redis:
    common = dict(decode_responses=True, socket_connect_timeout=0.5, socket_timeout=2, health_check_interval=30)
    url = (settings.REDIS_URL or "").strip()
    if url:
        return redis.Redis.from_url(url, **common)
    return redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        username=settings.REDIS_USERNAME or None,
        password=settings.REDIS_PASSWORD or None,
        **common,
    )


def get_redis() -> Optional[redis.Redis]:
    """Returns a connected client, or None if Redis is unavailable (callers fall back to memory)."""
    global _client, _last_failure
    if _client is not None:
        return _client
    if time.monotonic() - _last_failure < RETRY_SECONDS and _last_failure:
        return None
    with _lock:
        if _client is not None:
            return _client
        try:
            client = _connect()
            client.ping()
            _client = client
            logger.info("Redis connection established")
        except Exception as e:
            _last_failure = time.monotonic()
            logger.warning("Redis unavailable, using in-memory fallback: %s", e)
    return _client


def mark_redis_failed() -> None:
    """Drop the cached client after a runtime failure so the next call reconnects."""
    global _client, _last_failure
    with _lock:
        _client = None
        _last_failure = time.monotonic()
