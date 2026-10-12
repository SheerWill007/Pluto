"""
Facade over short-term (Redis) and long-term (PostgreSQL) memory.

All keys are namespaced by user, so one user can never read another user's history or
facts by guessing a session ID.
"""

from memory.postgres_memory import get_facts, save_fact
from memory.redis_memory import clear_history, get_history, save_message

TRIGGER_PHRASES = ["remember that", "remember this", "don't forget", "please remember"]


def _scoped(session_id: str, user_id: str) -> str:
    return f"{user_id}:{session_id}"


def handle_message(session_id: str, role: str, content: str, user_id: str):
    save_message(_scoped(session_id, user_id), role, content, user_id)


def check_and_save_fact(session_id: str, content: str, user_id: str) -> bool:
    """Saves the message as a long-term fact if it contains a trigger phrase."""
    lowered = content.lower()
    if any(phrase in lowered for phrase in TRIGGER_PHRASES):
        save_fact(session_id, content, user_id)
        return True
    return False


def get_context(session_id: str, user_id: str) -> dict:
    """Short- and long-term memory used by the orchestrator to build the prompt."""
    return {
        "recent_history": get_history(_scoped(session_id, user_id)),
        "remembered_facts": get_facts(session_id, user_id),
    }


def clear_session(session_id: str, user_id: str):
    clear_history(_scoped(session_id, user_id))
