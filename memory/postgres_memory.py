"""
PostgreSQL repositories: users, long-term facts, Gmail OAuth tokens, and the audit log.
"""

import json
import logging
from typing import Optional

from psycopg2.extras import RealDictCursor

from core.crypto import decrypt_secret, encrypt_secret
from memory.db import DatabaseUnavailable, connection, is_available

logger = logging.getLogger(__name__)

# Interpolated into queries below (S608 suppressed): a constant, never user input.
_USER_COLUMNS = "id, email, name, picture, auth_provider"


def check_postgres_availability() -> bool:
    return is_available()


def _require_db() -> None:
    if not is_available():
        raise DatabaseUnavailable("PostgreSQL is not available")


# ---------------------------------------------------------------------------
# Facts (long-term memory)
# ---------------------------------------------------------------------------

def save_fact(session_id: str, fact: str, user_id: str = None):
    if not is_available():
        logger.warning("PostgreSQL not available, skipping save_fact")
        return
    try:
        with connection() as conn, conn.cursor() as cur:
            cur.execute(
                "INSERT INTO facts (user_id, session_id, fact) VALUES (%s, %s, %s)",
                (user_id or session_id, session_id, fact),
            )
    except Exception as e:
        logger.error("Error saving fact: %s", e)


def get_facts(session_id: str, user_id: str = None, limit: int = 50) -> list:
    if not is_available():
        return []
    try:
        with connection() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT fact FROM facts WHERE user_id = %s ORDER BY created_at DESC LIMIT %s",
                (user_id or session_id, limit),
            )
            return [row[0] for row in reversed(cur.fetchall())]
    except Exception as e:
        logger.error("Error getting facts: %s", e)
        return []


def clear_facts(session_id: str, user_id: str = None):
    if not is_available():
        return
    try:
        with connection() as conn, conn.cursor() as cur:
            cur.execute("DELETE FROM facts WHERE user_id = %s", (user_id or session_id,))
    except Exception as e:
        logger.error("Error clearing facts: %s", e)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

def create_local_user(email: str, password_hash: str, name: str) -> dict:
    _require_db()
    with connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            f"INSERT INTO users (email, password_hash, name, auth_provider, last_login_at) "  # noqa: S608
            f"VALUES (%s, %s, %s, 'local', CURRENT_TIMESTAMP) RETURNING {_USER_COLUMNS}",
            (email.lower(), password_hash, name),
        )
        return dict(cur.fetchone())


def get_user_by_email(email: str) -> Optional[dict]:
    if not is_available():
        return None
    with connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            f"SELECT {_USER_COLUMNS}, password_hash FROM users WHERE LOWER(email) = LOWER(%s) "  # noqa: S608
            f"ORDER BY id LIMIT 1",
            (email,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int) -> Optional[dict]:
    if not is_available():
        return None
    with connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"SELECT {_USER_COLUMNS} FROM users WHERE id = %s", (user_id,))  # noqa: S608
        row = cur.fetchone()
        return dict(row) if row else None


def get_or_create_google_user(email: str, name: str, picture: Optional[str]) -> dict:
    _require_db()
    with connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            f"UPDATE users SET name = %s, picture = %s, last_login_at = CURRENT_TIMESTAMP, "  # noqa: S608
            f"updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) = LOWER(%s) RETURNING {_USER_COLUMNS}",
            (name, picture, email),
        )
        row = cur.fetchone()
        if row:
            return dict(row)
        cur.execute(
            f"INSERT INTO users (email, name, picture, auth_provider, last_login_at) "  # noqa: S608
            f"VALUES (%s, %s, %s, 'google', CURRENT_TIMESTAMP) RETURNING {_USER_COLUMNS}",
            (email.lower(), name, picture),
        )
        return dict(cur.fetchone())


def update_password_hash(user_id: int, password_hash: str) -> None:
    with connection() as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE users SET password_hash = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
            (password_hash, user_id),
        )


def touch_last_login(user_id: int) -> None:
    try:
        with connection() as conn, conn.cursor() as cur:
            cur.execute("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = %s", (user_id,))
    except Exception as e:
        logger.warning("Could not update last_login_at: %s", e)


# ---------------------------------------------------------------------------
# Gmail tokens (encrypted at rest when TOKEN_ENCRYPTION_KEY is configured)
# ---------------------------------------------------------------------------

def save_gmail_token(user_id, access_token, refresh_token, token_expiry):
    _require_db()
    with connection() as conn, conn.cursor() as cur:
        cur.execute("""
            INSERT INTO gmail_tokens (user_id, access_token, refresh_token, token_expiry, connected_at)
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET
                access_token = EXCLUDED.access_token,
                refresh_token = COALESCE(EXCLUDED.refresh_token, gmail_tokens.refresh_token),
                token_expiry = EXCLUDED.token_expiry,
                connected_at = CURRENT_TIMESTAMP
        """, (user_id, encrypt_secret(access_token), encrypt_secret(refresh_token), token_expiry))


def get_gmail_token(user_id) -> Optional[dict]:
    if not is_available():
        return None
    try:
        with connection() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT access_token, refresh_token, token_expiry FROM gmail_tokens WHERE user_id = %s",
                (user_id,),
            )
            row = cur.fetchone()
        if not row:
            return None
        return {
            "access_token": decrypt_secret(row[0]),
            "refresh_token": decrypt_secret(row[1]),
            "token_expiry": row[2],
        }
    except Exception as e:
        logger.error("Error getting Gmail token for user %s: %s", user_id, e)
        return None


def delete_gmail_token(user_id) -> bool:
    if not is_available():
        return False
    try:
        with connection() as conn, conn.cursor() as cur:
            cur.execute("DELETE FROM gmail_tokens WHERE user_id = %s", (user_id,))
        return True
    except Exception as e:
        logger.error("Error deleting Gmail token for user %s: %s", user_id, e)
        return False


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

def record_audit_event(action: str, actor: Optional[str], ip: Optional[str],
                       request_id: Optional[str], details: Optional[dict] = None) -> None:
    """Best effort: an audit write failure must never break the user-facing request."""
    if not is_available():
        logger.info("audit: %s actor=%s ip=%s", action, actor, ip, extra={"audit": True})
        return
    try:
        with connection() as conn, conn.cursor() as cur:
            cur.execute(
                "INSERT INTO audit_log (actor, action, ip, request_id, details) VALUES (%s, %s, %s, %s, %s)",
                (actor, action, ip, request_id, json.dumps(details or {})),
            )
    except Exception as e:
        logger.warning("Could not write audit event %s: %s", action, e)
