"""
Server-side verification of Google sign-in.

The browser only proves possession of a Google-issued token; identity (email, name,
picture) is always taken from Google's response, never from the client. When
GOOGLE_CLIENT_ID is configured, tokens issued to any other OAuth client are rejected,
which prevents a token obtained by a third-party app from being replayed here.
"""

import logging
from dataclasses import dataclass
from typing import Optional

import httpx

from config.settings import settings
from core.errors import AuthError, ServiceUnavailableError

logger = logging.getLogger(__name__)

TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
TOKEN_URL = "https://oauth2.googleapis.com/token"  # noqa: S105
_TIMEOUT = httpx.Timeout(10.0)


@dataclass(frozen=True)
class GoogleIdentity:
    email: str
    name: str
    picture: Optional[str]


def _check_audience(aud: Optional[str]) -> None:
    client_id = settings.GOOGLE_CLIENT_ID.strip()
    if not client_id:
        if settings.is_production:
            raise ServiceUnavailableError("Google sign-in is not configured on this server.")
        logger.warning("GOOGLE_CLIENT_ID is not set; skipping token audience check (development only)")
        return
    if aud != client_id:
        raise AuthError("Google token was not issued for this application.", code="invalid_google_token")


def _identity_from_claims(claims: dict) -> GoogleIdentity:
    email = (claims.get("email") or "").strip().lower()
    verified = claims.get("email_verified") in (True, "true", "True")
    if not email or not verified:
        raise AuthError("Your Google account email is not verified.", code="unverified_email")
    return GoogleIdentity(email=email, name=claims.get("name") or email.split("@")[0], picture=claims.get("picture"))


def _verify_id_token(token: str) -> GoogleIdentity:
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token
    try:
        claims = google_id_token.verify_oauth2_token(token, google_requests.Request(),
                                                     settings.GOOGLE_CLIENT_ID.strip() or None)
    except ValueError as e:
        raise AuthError(f"Invalid Google ID token: {e}", code="invalid_google_token") from e
    _check_audience(claims.get("aud"))
    return _identity_from_claims(claims)


def _verify_access_token(token: str) -> GoogleIdentity:
    with httpx.Client(timeout=_TIMEOUT) as client:
        info = client.get(TOKENINFO_URL, params={"access_token": token})
        if info.status_code != 200:
            raise AuthError("Invalid or expired Google token.", code="invalid_google_token")
        _check_audience(info.json().get("aud") or info.json().get("azp"))

        profile = client.get(USERINFO_URL, headers={"Authorization": f"Bearer {token}"})
        if profile.status_code != 200:
            raise AuthError("Could not read Google profile.", code="invalid_google_token")
        return _identity_from_claims(profile.json())


def _exchange_code(code: str, code_verifier: str, redirect_uri: str) -> GoogleIdentity:
    if not (settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET):
        raise ServiceUnavailableError("Google redirect sign-in is not configured on this server.")
    with httpx.Client(timeout=_TIMEOUT) as client:
        resp = client.post(TOKEN_URL, data={
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "code": code,
            "code_verifier": code_verifier,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        })
    if resp.status_code != 200:
        raise AuthError("Google sign-in code was rejected.", code="invalid_google_token")
    tokens = resp.json()
    if tokens.get("id_token"):
        return _verify_id_token(tokens["id_token"])
    return _verify_access_token(tokens["access_token"])


def verify_google_login(access_token: Optional[str] = None, id_token: Optional[str] = None,
                        code: Optional[str] = None, code_verifier: Optional[str] = None,
                        redirect_uri: Optional[str] = None) -> GoogleIdentity:
    try:
        if id_token:
            return _verify_id_token(id_token)
        if access_token:
            return _verify_access_token(access_token)
        return _exchange_code(code, code_verifier, redirect_uri)
    except httpx.HTTPError as e:
        raise ServiceUnavailableError(f"Could not reach Google to verify sign-in: {e}") from e
