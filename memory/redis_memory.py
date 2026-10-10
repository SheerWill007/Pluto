"""
Short-term conversation memory (per-session chat history), stored in Redis with an
in-memory fallback for local development.
"""

import json
import logging
import threading
from collections import defaultdict

from memory.redis_client import get_redis, mark_redis_failed

logger = logging.getLogger(__name__)

TTL_SECONDS = 24 * 60 * 60
# Bound history so long conversations don't grow prompts (and cost) without limit
MAX_HISTORY_MESSAGES = 40

_memory_storage: dict = defaultdict(list)
_memory_lock = threading.Lock()


def _session_key(session_id: str) -> str:
    return f"session:{session_id}:history"


def save_message(session_id: str, role: str, content: str, user_id: str = None):
    key = _session_key(session_id)
    message = json.dumps({"role": role, "content": content, "user_id": user_id or session_id})

    client = get_redis()
    if client is not None:
        try:
            pipe = client.pipeline()
            pipe.rpush(key, message)
            pipe.ltrim(key, -MAX_HISTORY_MESSAGES, -1)
            pipe.expire(key, TTL_SECONDS)
            pipe.execute()
            return
        except Exception as e:
            logger.error("Redis save failed, falling back to memory: %s", e)
            mark_redis_failed()

    with _memory_lock:
        _memory_storage[key].append(message)
        del _memory_storage[key][:-MAX_HISTORY_MESSAGES]


def get_history(session_id: str) -> list:
    key = _session_key(session_id)
    client = get_redis()
    if client is not None:
        try:
            return [json.loads(m) for m in client.lrange(key, 0, -1)]
        except Exception as e:
            logger.error("Redis read failed, falling back to memory: %s", e)
            mark_redis_failed()
    with _memory_lock:
        return [json.loads(m) for m in _memory_storage.get(key, [])]


def clear_history(session_id: str):
    key = _session_key(session_id)
    client = get_redis()
    if client is not None:
        try:
            client.delete(key)
        except Exception as e:
            logger.error("Redis clear failed: %s", e)
            mark_redis_failed()
    with _memory_lock:
        _memory_storage.pop(key, None)
