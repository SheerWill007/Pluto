import redis
import json
import logging
from config.settings import settings

logger = logging.getLogger(__name__)

# In-memory fallback storage
_memory_storage = {}

# Try to connect to Redis, but don't crash if it fails
try:
    client = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        username=settings.REDIS_USERNAME,
        password=settings.REDIS_PASSWORD,
        decode_responses=True,
        socket_connect_timeout=2
    )
    # Test connection
    client.ping()
    _redis_available = True
    logger.info("Redis connection successful")
except Exception as e:
    client = None
    _redis_available = False
    logger.warning(f"Redis not available, using in-memory storage: {e}")

TTL_seconds = 24 * 60 * 60

def _session_key(session_id: str) -> str:
    return f"session:{session_id}:history"

def save_message(session_id: str, role: str, content: str, user_id: str = None):
    user_id = user_id or session_id
    key = _session_key(session_id)
    message = json.dumps({"role": role, "content": content, "user_id": user_id})
    
    if _redis_available and client:
        try:
            client.rpush(key, message)
            client.expire(key, TTL_seconds)
        except Exception as e:
            logger.error(f"Redis save failed, using memory: {e}")
            if key not in _memory_storage:
                _memory_storage[key] = []
            _memory_storage[key].append(message)
    else:
        # Use in-memory storage
        if key not in _memory_storage:
            _memory_storage[key] = []
        _memory_storage[key].append(message)

def get_history(session_id: str) -> list:
    key = _session_key(session_id)
    
    if _redis_available and client:
        try:
            raw_message = client.lrange(key, 0, -1)
            formatted = [json.loads(msg) for msg in raw_message]
            return formatted
        except Exception as e:
            logger.error(f"Redis get failed, using memory: {e}")
            # Fall back to memory
            raw_message = _memory_storage.get(key, [])
            return [json.loads(msg) for msg in raw_message]
    else:
        # Use in-memory storage
        raw_message = _memory_storage.get(key, [])
        return [json.loads(msg) for msg in raw_message]

def clear_history(session_id: str):
    key = _session_key(session_id)
    
    if _redis_available and client:
        try:
            client.delete(key)
        except Exception as e:
            logger.error(f"Redis clear failed: {e}")
    
    # Also clear from memory
    if key in _memory_storage:
        del _memory_storage[key]