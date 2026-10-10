import base64
import html
import logging
import re
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from config.settings import settings
from core.errors import AppError
from memory.postgres_memory import get_gmail_token, save_gmail_token

logger = logging.getLogger(__name__)

SCOPES = [settings.SCOPES]
_METADATA_HEADERS = ["Subject", "From", "Date"]


class GmailError(AppError):
    status_code = 502
    code = "gmail_error"


class GmailNotConnectedError(GmailError):
    status_code = 409
    code = "gmail_not_connected"


def get_gmail_service(user_id: int):
    token_data = get_gmail_token(user_id)
    if not token_data:
        raise GmailNotConnectedError("Gmail is not connected for this account. Connect Gmail first.")

    creds = Credentials(
        token=token_data["access_token"],
        refresh_token=token_data["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",  # noqa: S106
        client_id=settings.GMAIL_WEB_CLIENT_ID,
        client_secret=settings.GMAIL_WEB_CLIENT_SECRET,
        scopes=SCOPES,
        expiry=token_data.get("token_expiry"),
    )
    try:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            save_gmail_token(user_id, creds.token, creds.refresh_token, creds.expiry)
    except Exception as e:
        raise GmailNotConnectedError(f"Gmail authorization expired; reconnect Gmail. ({e})") from e
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def _header(headers: list, name: str, default: str) -> str:
    return next((h["value"] for h in headers if h["name"].lower() == name.lower()), default)


def _summary(msg: dict) -> dict:
    headers = msg.get("payload", {}).get("headers", [])
    return {
        "id": msg["id"],
        "subject": _header(headers, "Subject", "(no subject)"),
        "sender": _header(headers, "From", "(unknown sender)"),
        "date": _header(headers, "Date", "(unknown date)"),
        "snippet": html.unescape(msg.get("snippet", "")),
        "labels": msg.get("labelIds", []),
    }


def _decode(data: str) -> str:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4)).decode("utf-8", errors="replace")


def _find_part(payload: dict, mime_type: str) -> Optional[str]:
    """Depth-first search through (possibly nested) multipart payloads."""
    if payload.get("mimeType") == mime_type and payload.get("body", {}).get("data"):
        return payload["body"]["data"]
    for part in payload.get("parts", []) or []:
        found = _find_part(part, mime_type)
        if found:
            return found
    return None


def extract_body(payload: dict) -> str:
    data = _find_part(payload, "text/plain")
    if data:
        return _decode(data)
    data = _find_part(payload, "text/html")
    if data:
        text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", _decode(data), flags=re.S | re.I)
        text = re.sub(r"<br\s*/?>|</p>|</div>", "\n", text, flags=re.I)
        return html.unescape(re.sub(r"<[^>]+>", "", text)).strip()
    if payload.get("body", {}).get("data"):
        return _decode(payload["body"]["data"])
    return ""


def fetch_recent_emails(user_id: int, max_results: int = 10, label: str = "INBOX", q: Optional[str] = None) -> list:
    service = get_gmail_service(user_id)
    try:
        results = service.users().messages().list(
            userId="me", maxResults=max_results, labelIds=[label] if label else None, q=q
        ).execute()
        ids = [m["id"] for m in results.get("messages", [])]
        if not ids:
            return []

        # One batched HTTP round trip instead of one request per message
        by_id: dict = {}

        def collect(request_id, response, exception):
            if exception is not None:
                logger.warning("Failed to fetch message %s: %s", request_id, exception)
            else:
                by_id[response["id"]] = _summary(response)

        batch = service.new_batch_http_request(callback=collect)
        for msg_id in ids:
            batch.add(
                service.users().messages().get(userId="me", id=msg_id, format="metadata",
                                               metadataHeaders=_METADATA_HEADERS),
                request_id=msg_id,
            )
        batch.execute()

        emails = [by_id[i] for i in ids if i in by_id]
        for e in emails:
            e["body"] = e["snippet"]
        return emails
    except GmailError:
        raise
    except Exception as e:
        raise GmailError(f"Could not retrieve emails from Gmail: {e}") from e


def fetch_single_email(msg_id: str, user_id: int) -> dict:
    service = get_gmail_service(user_id)
    try:
        msg = service.users().messages().get(userId="me", id=msg_id, format="full").execute()
    except Exception as e:
        raise GmailError(f"Could not retrieve email {msg_id}: {e}") from e
    email = _summary(msg)
    email["body"] = extract_body(msg.get("payload", {})) or email["snippet"]
    return email
