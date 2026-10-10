"""Authentication: email/password, Google sign-in, and guest sessions."""

import logging

import psycopg2
from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool

from api.deps import audit
from config.settings import settings
from core.errors import AuthError, ConflictError, ForbiddenError, ServiceUnavailableError
from core.rate_limit import auth_rate_limit
from core.security import (
    CurrentUser,
    create_access_token,
    create_guest_token,
    get_current_user,
    hash_password,
    password_needs_rehash,
    verify_password,
)
from memory import postgres_memory as users
from schemas.request_models import AuthUserResponse, GoogleAuthRequest, UserLoginRequest, UserSignUpRequest
from services.google_auth import verify_google_login

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

# Verified against when the email is unknown, so response timing doesn't reveal which emails exist
_DUMMY_HASH = hash_password("timing-equalizer")


def _require_database() -> None:
    if not users.check_postgres_availability():
        raise ServiceUnavailableError("Authentication service is unavailable: the database is not reachable.")


def _auth_response(user: dict) -> AuthUserResponse:
    return AuthUserResponse(
        id=str(user["id"]),
        email=user["email"],
        name=user.get("name"),
        picture=user.get("picture"),
        auth_provider=user.get("auth_provider") or "local",
        token=create_access_token(user["id"], user["email"]),
        expires_in=settings.JWT_EXPIRE_MINUTES * 60,
    )


@router.post("/signup", response_model=AuthUserResponse, status_code=201, dependencies=[Depends(auth_rate_limit)])
async def signup(body: UserSignUpRequest, request: Request):
    _require_database()
    if users.get_user_by_email(body.email):
        raise ConflictError("An account with this email already exists.", code="email_taken")
    # PBKDF2 at 600k iterations is deliberately slow; keep it off the event loop
    pw_hash = await run_in_threadpool(hash_password, body.password)
    try:
        user = users.create_local_user(body.email, pw_hash, body.name)
    except psycopg2.IntegrityError:
        raise ConflictError("An account with this email already exists.", code="email_taken") from None
    audit(request, "auth.signup", str(user["id"]), email=user["email"])
    return _auth_response(user)


@router.post("/login", response_model=AuthUserResponse, dependencies=[Depends(auth_rate_limit)])
async def login(body: UserLoginRequest, request: Request):
    _require_database()
    user = users.get_user_by_email(body.email)

    if user and user.get("auth_provider") not in (None, "local"):
        raise AuthError(f"This account uses {user['auth_provider']} sign-in.", code="wrong_auth_provider")

    stored = (user or {}).get("password_hash") or _DUMMY_HASH
    valid = await run_in_threadpool(verify_password, stored, body.password)
    if not user or not valid:
        audit(request, "auth.login_failed", body.email)
        raise AuthError("Invalid email or password.", code="invalid_credentials")

    if password_needs_rehash(stored):
        # Transparently upgrade legacy / weaker hashes now that we have the plaintext
        users.update_password_hash(user["id"], await run_in_threadpool(hash_password, body.password))
    users.touch_last_login(user["id"])
    audit(request, "auth.login", str(user["id"]))
    return _auth_response(user)


@router.post("/google", response_model=AuthUserResponse, dependencies=[Depends(auth_rate_limit)])
def google_auth(body: GoogleAuthRequest, request: Request):
    _require_database()
    identity = verify_google_login(
        access_token=body.access_token, id_token=body.id_token,
        code=body.code, code_verifier=body.code_verifier, redirect_uri=body.redirect_uri,
    )
    existing = users.get_user_by_email(identity.email)
    if existing and existing.get("auth_provider") == "local" and existing.get("password_hash"):
        # Don't silently merge into a password account: whoever controls the Google
        # account isn't necessarily the person who registered the password account
        raise ConflictError("An account with this email already exists. Sign in with your password.",
                            code="email_taken")
    user = users.get_or_create_google_user(identity.email, identity.name, identity.picture)
    audit(request, "auth.google_login", str(user["id"]))
    return _auth_response(user)


@router.post("/guest", response_model=AuthUserResponse, dependencies=[Depends(auth_rate_limit)])
def guest_login(request: Request):
    if not settings.ALLOW_GUEST_ACCESS:
        raise ForbiddenError("Guest access is disabled on this server.", code="guest_disabled")
    token, guest_id = create_guest_token()
    audit(request, "auth.guest", guest_id)
    return AuthUserResponse(
        id=guest_id, email="guest@local", name="Guest User", picture=None, auth_provider="guest",
        token=token, expires_in=settings.GUEST_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/me")
def get_me(current_user: CurrentUser = Depends(get_current_user)):
    if current_user.is_guest:
        return {"id": current_user.id, "email": current_user.email, "name": "Guest User",
                "picture": None, "auth_provider": "guest"}
    user = users.get_user_by_id(current_user.db_id)
    if not user:
        raise AuthError("Account no longer exists.", code="user_not_found")
    return {**user, "id": str(user["id"])}
