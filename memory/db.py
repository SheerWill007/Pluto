"""
PostgreSQL connection pooling and schema migrations.

- A thread-safe connection pool replaces per-call connects.
- Availability is re-checked periodically instead of being cached forever, so the API
  recovers when the database comes back.
- Schema changes are applied as ordered, versioned migrations recorded in
  `schema_migrations`, guarded by an advisory lock so concurrent workers don't race.
"""

import logging
import threading
import time
from contextlib import contextmanager
from typing import Iterator, Optional

import psycopg2
from psycopg2 import pool as pg_pool

from config.settings import settings

logger = logging.getLogger(__name__)

AVAILABILITY_TTL_SECONDS = 15
_MIGRATION_LOCK_ID = 0x504C55544F  # "PLUTO"

_lock = threading.Lock()
_pool: Optional[pg_pool.ThreadedConnectionPool] = None
_last_check: float = 0.0
_last_result: bool = False


class DatabaseUnavailable(RuntimeError):
    pass


def _connect_kwargs() -> dict:
    url = (settings.POSTGRES_URL or "").strip()
    if url:
        return {"dsn": url, "connect_timeout": 3}
    return {
        "host": settings.POSTGRES_HOST,
        "port": settings.POSTGRES_PORT,
        "dbname": settings.POSTGRES_DB,
        "user": settings.POSTGRES_USER,
        "password": settings.POSTGRES_PASSWORD,
        "connect_timeout": 3,
    }


def _get_pool() -> pg_pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        with _lock:
            if _pool is None:
                _pool = pg_pool.ThreadedConnectionPool(minconn=1, maxconn=10, **_connect_kwargs())
    return _pool


def is_available(force: bool = False) -> bool:
    """Cheap availability probe, cached for AVAILABILITY_TTL_SECONDS."""
    global _last_check, _last_result
    now = time.monotonic()
    if not force and _last_check and now - _last_check < AVAILABILITY_TTL_SECONDS:
        return _last_result
    try:
        with connection() as conn, conn.cursor() as cur:
            cur.execute("SELECT 1")
        result = True
    except Exception as e:
        if _last_result or not _last_check:
            logger.warning("PostgreSQL not available: %s", e)
        result = False
    _last_check, _last_result = now, result
    return result


@contextmanager
def connection() -> Iterator[psycopg2.extensions.connection]:
    """Borrow a pooled connection; commits on success, rolls back on error."""
    try:
        p = _get_pool()
        conn = p.getconn()
    except Exception as e:
        raise DatabaseUnavailable(f"PostgreSQL is not available: {e}") from e

    broken = False
    try:
        yield conn
        conn.commit()
    except (psycopg2.OperationalError, psycopg2.InterfaceError):
        broken = True
        raise
    except Exception:
        try:
            conn.rollback()
        except Exception:
            broken = True
        raise
    finally:
        p.putconn(conn, close=broken or conn.closed != 0)


def close_pool() -> None:
    global _pool
    with _lock:
        if _pool is not None:
            _pool.closeall()
            _pool = None


# ---------------------------------------------------------------------------
# Migrations -- append only. Never edit a migration that has shipped.
# ---------------------------------------------------------------------------

MIGRATIONS: list[tuple[int, str, str]] = [
    (1, "initial schema", """
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255),
            name VARCHAR(255),
            picture TEXT,
            auth_provider VARCHAR(50) DEFAULT 'local',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS facts (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            session_id VARCHAR(255) NOT NULL,
            fact TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS gmail_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            access_token TEXT NOT NULL,
            refresh_token TEXT,
            token_expiry TIMESTAMP,
            connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """),
    (2, "indexes, login tracking, audit log", """
        CREATE INDEX IF NOT EXISTS idx_facts_user_id ON facts (user_id);
        CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        CREATE TABLE IF NOT EXISTS audit_log (
            id BIGSERIAL PRIMARY KEY,
            occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            actor VARCHAR(255),
            action VARCHAR(100) NOT NULL,
            ip VARCHAR(64),
            request_id VARCHAR(64),
            details JSONB
        );
        CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log (actor, occurred_at DESC);
    """),
]


def run_migrations() -> int:
    """Applies pending migrations. Returns the number applied."""
    applied = 0
    with connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT pg_advisory_lock(%s)", (_MIGRATION_LOCK_ID,))
        try:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INTEGER PRIMARY KEY,
                    description TEXT NOT NULL,
                    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
            cur.execute("SELECT version FROM schema_migrations")
            done = {row[0] for row in cur.fetchall()}
            for version, description, sql in MIGRATIONS:
                if version in done:
                    continue
                logger.info("Applying migration %s: %s", version, description)
                cur.execute(sql)
                cur.execute(
                    "INSERT INTO schema_migrations (version, description) VALUES (%s, %s)",
                    (version, description),
                )
                conn.commit()
                applied += 1
        finally:
            # A failed migration leaves the transaction aborted; clear it so the unlock can run
            conn.rollback()
            cur.execute("SELECT pg_advisory_unlock(%s)", (_MIGRATION_LOCK_ID,))
    return applied
