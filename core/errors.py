"""
Application error types and the handlers that turn them into consistent JSON responses.

Every error response has the shape:
    {"detail": "<human readable message>", "code": "<machine code>", "request_id": "<id>"}
`detail` is kept for compatibility with FastAPI's default shape, which the frontend reads.
"""

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from core.logging import request_id_var

logger = logging.getLogger(__name__)


class AppError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, *, code: str = None, status_code: int = None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code


class AuthError(AppError):
    status_code = 401
    code = "unauthorized"


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"


class PayloadTooLargeError(AppError):
    status_code = 413
    code = "payload_too_large"


class RateLimitError(AppError):
    status_code = 429
    code = "rate_limited"

    def __init__(self, message: str, retry_after: int):
        super().__init__(message)
        self.retry_after = retry_after


class ServiceUnavailableError(AppError):
    status_code = 503
    code = "service_unavailable"


class UpstreamError(AppError):
    """An LLM provider or third-party API failed."""
    status_code = 502
    code = "upstream_error"


def friendly_llm_error(e: Exception) -> str:
    """Translate common provider failures into actionable messages."""
    err_str = str(e)
    if "credit_balance_exhausted" in err_str or "insufficient_quota" in err_str:
        return (
            "The LLM provider account has no remaining credits. Add billing credits with the provider "
            "or switch to another provider in the top bar."
        )
    if "invalid_api_key" in err_str or "Incorrect API key provided" in err_str or "API_KEY_INVALID" in err_str:
        return (
            "Invalid API key: the provider rejected the key. Clear any custom key in the top bar "
            "to fall back to the server key, or check that the key matches the selected provider."
        )
    if "is not found for API version" in err_str or ("models/" in err_str and "is not found" in err_str) \
            or "is no longer available" in err_str or "model_not_found" in err_str:
        return "The selected model is retired or unavailable for this provider. Choose a different model."
    if "Missing Authentication header" in err_str or ("Missing" in err_str and "API key" in err_str):
        return "Missing API key: provide one in the top bar or configure LLM_API_KEY on the server."
    if "rate limit" in err_str.lower() or "429" in err_str:
        return "The LLM provider is rate limiting requests. Wait a moment and try again."
    return err_str


def _body(message: str, code: str) -> dict:
    return {"detail": message, "code": code, "request_id": request_id_var.get()}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
        headers = {}
        if isinstance(exc, RateLimitError):
            headers["Retry-After"] = str(exc.retry_after)
        if exc.status_code >= 500:
            logger.error("%s: %s", exc.code, exc.message)
        return JSONResponse(_body(exc.message, exc.code), status_code=exc.status_code, headers=headers)

    @app.exception_handler(HTTPException)
    async def http_error_handler(request: Request, exc: HTTPException):
        detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        return JSONResponse(_body(detail, f"http_{exc.status_code}"), status_code=exc.status_code,
                            headers=getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        errors = exc.errors()
        first = errors[0] if errors else {}
        field = ".".join(str(p) for p in first.get("loc", []) if p != "body")
        message = f"{field}: {first.get('msg')}" if field else str(first.get("msg", "Invalid request"))
        body = _body(message, "validation_error")
        body["errors"] = [{"loc": e.get("loc"), "msg": e.get("msg")} for e in errors]
        return JSONResponse(body, status_code=422)

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception):
        # Never leak stack traces or internals to clients; the request ID links to the full log entry
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(_body("An internal error occurred. Please try again.", "internal_error"),
                            status_code=500)
