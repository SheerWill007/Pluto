"""
Authentication primitives: password hashing, JWT access tokens, signed OAuth state,
and the FastAPI dependencies that resolve the calling user.
"""

import hashlib
import hmac
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config.settings import settings
from core.errors import AuthError
from core.logging import user_id_var

# OWASP 2023 recommendation for PBKDF2-HMAC-SHA256
PBKDF2_ITERATIONS = 600_000
_LEGACY_ITERATIONS = 100_000
_HASH_PREFIX = "pbkdf2_sha256"


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------

def hash_password(password: str, iterations: int = PBKDF2_ITERATIONS) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"{_HASH_PREFIX}${iterations}${salt.hex()}${key.hex()}"


def verify_password(stored_hash: str, password: str) -> bool:
    """Constant-time verification supporting both the current and the legacy `salt:key` format."""
    try:
        if stored_hash.startswith(_HASH_PREFIX + "$"):
            _, iterations, salt_hex, key_hex = stored_hash.split("$")
            iterations = int(iterations)
        else:
            salt_hex, key_hex = stored_hash.split(":")
            iterations = _LEGACY_ITERATIONS
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), iterations)
        return hmac.compare_digest(candidate, bytes.fromhex(key_hex))
    except (ValueError, AttributeError):
        return False


def password_needs_rehash(stored_hash: str) -> bool:
    if not stored_hash.startswith(_HASH_PREFIX + "$"):
        return True
    try:
        return int(stored_hash.split("$")[1]) < PBKDF2_ITERATIONS
    except (IndexError, ValueError):
        return True


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class CurrentUser:
    id: str                  # stable subject: "<db id>" for accounts, "guest:<uuid>" for guests
    email: str
    is_guest: bool = False

    @property
    def db_id(self) -> Optional[int]:
        """Integer primary key for registered users; None for guests."""
        return None if self.is_guest else int(self.id)


def _encode(claims: dict, expires_in: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        **claims,
        "iat": now,
        "nbf": now,
        "exp": now + expires_in,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def _decode(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.JWT_ISSUER,
            options={"require": ["exp", "iat", "sub", "typ"]},
        )
    except jwt.ExpiredSignatureError:
        raise AuthError("Session expired, please sign in again.", code="token_expired") from None
    except jwt.InvalidTokenError:
        raise AuthError("Invalid authentication token.", code="invalid_token") from None
    if payload.get("typ") != expected_type:
        raise AuthError("Invalid authentication token.", code="invalid_token")
    return payload


def create_access_token(user_id: int, email: str) -> str:
    return _encode(
        {"sub": str(user_id), "email": email, "typ": "access", "guest": False},
        timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
    )


def create_guest_token() -> tuple[str, str]:
    guest_id = f"guest:{uuid.uuid4().hex}"
    token = _encode(
        {"sub": guest_id, "email": "guest@local", "typ": "access", "guest": True},
        timedelta(minutes=settings.GUEST_TOKEN_EXPIRE_MINUTES),
    )
    return token, guest_id


def decode_access_token(token: str) -> CurrentUser:
    payload = _decode(token, "access")
    return CurrentUser(id=payload["sub"], email=payload.get("email", ""), is_guest=bool(payload.get("guest")))


# ---------------------------------------------------------------------------
# OAuth state (CSRF protection for the Gmail connect flow)
# ---------------------------------------------------------------------------

def create_oauth_state(user_id: int) -> str:
    """A short-lived signed token so the OAuth callback can trust which user started the flow."""
    return _encode({"sub": str(user_id), "typ": "oauth_state"}, timedelta(minutes=10))


def verify_oauth_state(state: str) -> int:
    return int(_decode(state, "oauth_state")["sub"])


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

_bearer = HTTPBearer(auto_error=False)


# Async so the user ID is set on the request's own context (sync dependencies run in a
# copied context in the threadpool, and the log correlation would be lost).
async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer)) -> CurrentUser:
    if credentials is None or not credentials.credentials:
        raise AuthError("Authentication required.", code="not_authenticated")
    user = decode_access_token(credentials.credentials)
    user_id_var.set(user.id)
    return user


async def get_registered_user(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """For features tied to a persistent account (e.g. Gmail), which guests cannot use."""
    if user.is_guest:
        raise AuthError("This feature requires a registered account. Please sign in.", code="guest_not_allowed")
    return user
