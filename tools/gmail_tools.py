import logging
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from config.settings import settings
from langchain_community.tools import Tool
from memory.postgres_memory import get_gmail_token, save_gmail_token

logger = logging.getLogger(__name__)

SCOPES = [settings.SCOPES]


def get_gmail_service(user_id):
    try:
        token_data = get_gmail_token(user_id)
        if not token_data:
            return "error in calling gmail: Gmail not connected for this user. Please connect your Gmail account first."

        creds = Credentials(
            token=token_data["access_token"],
            refresh_token=token_data["refresh_token"],
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GMAIL_WEB_CLIENT_ID,
            client_secret=settings.GMAIL_WEB_CLIENT_SECRET,
            scopes=SCOPES,
            expiry=token_data.get("token_expiry")
        )

        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            save_gmail_token(user_id, creds.token, creds.refresh_token, creds.expiry)

        return build("gmail", "v1", credentials=creds)
    except Exception as e:
        return f"error in calling gmail: {e}"


def fetch_recent_emails(user_id, max_results=10, label="INBOX", q=None):
    try:
        service = get_gmail_service(user_id)
        if isinstance(service, str):
            # If error string is returned from get_gmail_service
            raise Exception(service)

        label_ids = [label] if label else None
        results = service.users().messages().list(
            userId="me", maxResults=max_results, labelIds=label_ids, q=q
        ).execute()
        messages = results.get("messages", [])

        emails = []
        for msg in messages:
            msg_detail = service.users().messages().get(userId="me", id=msg["id"]).execute()

            headers = msg_detail["payload"]["headers"]
            subject = next((h["value"] for h in headers if h["name"] == "Subject"), "(no subject)")
            sender = next((h["value"] for h in headers if h["name"] == "From"), "(unknown sender)")
            date = next((h["value"] for h in headers if h["name"] == "Date"), "(unknown date)")

            # Extract body if possible, default to snippet
            body = msg_detail.get("snippet", "")
            emails.append({
                "id": msg["id"],
                "subject": subject,
                "sender": sender,
                "date": date,
                "snippet": msg_detail.get("snippet", ""),
                "body": body
            })

        return emails
    except Exception as e:
        return f"error in retrieving email from gmail : {e}"


def fetch_single_email(msg_id, user_id):
    try:
        service = get_gmail_service(user_id)
        if isinstance(service, str):
            raise Exception(service)

        msg_detail = service.users().messages().get(userId="me", id=msg_id).execute()
        headers = msg_detail["payload"]["headers"]
        subject = next((h["value"] for h in headers if h["name"] == "Subject"), "(no subject)")
        sender = next((h["value"] for h in headers if h["name"] == "From"), "(unknown sender)")
        date = next((h["value"] for h in headers if h["name"] == "Date"), "(unknown date)")

        body = msg_detail.get("snippet", "")
        # Attempt to extract full body
        payload = msg_detail.get("payload", {})
        parts = payload.get("parts", [])
        body_data = ""
        if not parts:
            body_data = payload.get("body", {}).get("data", "")
        else:
            for part in parts:
                if part.get("mimeType") == "text/plain":
                    body_data = part.get("body", {}).get("data", "")
                    break
            if not body_data:
                body_data = parts[0].get("body", {}).get("data", "")

        if body_data:
            import base64
            try:
                body = base64.urlsafe_b64decode(body_data).decode("utf-8")
            except Exception:
                pass

        return {
            "id": msg_id,
            "subject": subject,
            "sender": sender,
            "date": date,
            "snippet": msg_detail.get("snippet", ""),
            "body": body
        }
    except Exception as e:
        return f"error: {e}"
#
# gmail_tool = Tool(
#     func= fetch_recent_emails,
#     name= "gmail_tool",
#     description=  "use it when user ask summary of his gmail or anything related to gmail"
# )