"""Gmail OAuth connection, inbox access, and AI summaries."""

import html
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import HTMLResponse
from google_auth_oauthlib.flow import Flow

from agents.gmail_agent import run_gmail_agent
from api.deps import audit, call_llm, llm_selection
from config.settings import settings
from core.errors import AppError, AuthError, NotFoundError, ServiceUnavailableError
from core.security import CurrentUser, create_oauth_state, get_registered_user, verify_oauth_state
from memory.postgres_memory import delete_gmail_token, get_gmail_token, save_gmail_token
from schemas.request_models import GmailResponse, GmailSummarizeRequest
from tools.gmail_tools import fetch_recent_emails, fetch_single_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/gmail", tags=["gmail"])

_ALLOWED_LABELS = {"INBOX", "SENT", "STARRED", "IMPORTANT", "UNREAD", "SPAM", "TRASH", "DRAFT",
                   "CATEGORY_PERSONAL", "CATEGORY_SOCIAL", "CATEGORY_PROMOTIONS", "CATEGORY_UPDATES"}


def _flow() -> Flow:
    if not (settings.GMAIL_WEB_CLIENT_ID and settings.GMAIL_WEB_CLIENT_SECRET):
        raise ServiceUnavailableError("Gmail integration is not configured on this server.")
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GMAIL_WEB_CLIENT_ID,
                "client_secret": settings.GMAIL_WEB_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.GMAIL_REDIRECT_URI],
            }
        },
        scopes=[settings.SCOPES],
        redirect_uri=settings.GMAIL_REDIRECT_URI,
        # Confidential server-side client: the callback runs in a fresh Flow, so a
        # per-request PKCE verifier would be lost between the two requests
        autogenerate_code_verifier=False,
    )


def _close_tab_page(title: str, message: str, ok: bool) -> HTMLResponse:
    color = "#3f6212" if ok else "#991b1b"
    body = f"""<!doctype html><html><head><meta charset="utf-8"><title>{html.escape(title)}</title>
<style>body{{font-family:system-ui,sans-serif;background:#F5F2EB;color:#1c1917;display:grid;place-items:center;height:100vh;margin:0}}
main{{text-align:center;max-width:28rem;padding:2rem}}h1{{color:{color};font-size:1.25rem}}</style></head>
<body><main><h1>{html.escape(title)}</h1><p>{html.escape(message)}</p><p>You can close this tab.</p></main>
<script>setTimeout(function(){{window.close()}},2500)</script></body></html>"""
    return HTMLResponse(body, status_code=200 if ok else 400)


@router.get("/connect")
def gmail_connect(user: CurrentUser = Depends(get_registered_user)):
    auth_url, _ = _flow().authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true",
        # Signed and short-lived: the callback can trust which user started the flow,
        # which prevents linking an attacker's mailbox to a victim's account (login CSRF)
        state=create_oauth_state(user.db_id),
    )
    return {"auth_url": auth_url}


@router.get("/callback", include_in_schema=False)
def gmail_callback(request: Request, state: str, code: Optional[str] = None, error: Optional[str] = None):
    if error:
        return _close_tab_page("Gmail not connected", f"Google reported: {error}", ok=False)
    try:
        user_id = verify_oauth_state(state)
    except AuthError:
        return _close_tab_page("Gmail not connected", "This link has expired. Start the connection again.", ok=False)
    if not code:
        return _close_tab_page("Gmail not connected", "No authorization code was returned.", ok=False)

    try:
        flow = _flow()
        flow.fetch_token(code=code)
        creds = flow.credentials
        save_gmail_token(user_id=user_id, access_token=creds.token,
                         refresh_token=creds.refresh_token, token_expiry=creds.expiry)
    except Exception as e:
        logger.error("Gmail OAuth callback failed for user %s: %s", user_id, e)
        return _close_tab_page("Gmail not connected", "Google sign-in could not be completed. Please try again.",
                               ok=False)
    audit(request, "gmail.connect", str(user_id))
    return _close_tab_page("Gmail connected", "Your Gmail account is now linked to Pluto.", ok=True)


@router.get("/status")
def gmail_status(user: CurrentUser = Depends(get_registered_user)):
    return {"connected": get_gmail_token(user.db_id) is not None}


@router.post("/disconnect")
def gmail_disconnect(request: Request, user: CurrentUser = Depends(get_registered_user)):
    delete_gmail_token(user.db_id)
    audit(request, "gmail.disconnect", user.id)
    return {"message": "Gmail disconnected."}


@router.get("/list")
def gmail_list(
    max_results: int = Query(10, ge=1, le=50),
    label: str = Query("INBOX", max_length=64),
    q: Optional[str] = Query(None, max_length=500),
    user: CurrentUser = Depends(get_registered_user),
):
    if label.upper() not in _ALLOWED_LABELS and not label.startswith("Label_"):
        raise AppError(f"Unknown label '{label}'.", code="invalid_label")
    return fetch_recent_emails(user.db_id, max_results=max_results, label=label, q=q)


@router.get("/get/{msg_id}")
def gmail_get(msg_id: str, user: CurrentUser = Depends(get_registered_user)):
    if not msg_id.isalnum():
        raise NotFoundError("Email not found.")
    return fetch_single_email(msg_id, user.db_id)


@router.post("/summarize", response_model=GmailResponse)
@router.get("/summary", response_model=GmailResponse, include_in_schema=False)
def gmail_summarize(request: Optional[GmailSummarizeRequest] = None,
                    user: CurrentUser = Depends(get_registered_user)):
    request = request or GmailSummarizeRequest()
    emails = [fetch_single_email(i, user.db_id) for i in request.email_ids] if request.email_ids else None
    llm = llm_selection(request)
    summary = call_llm(run_gmail_agent, user_id=user.db_id, max_email=10, provider=llm.provider,
                       model_name=llm.model, emails=emails, api_key=llm.api_key)
    return GmailResponse(summary=summary)
