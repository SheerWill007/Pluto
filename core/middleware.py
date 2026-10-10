"""
ASGI middleware: request IDs, access logging, metrics, and security headers.

Implemented as pure ASGI (rather than BaseHTTPMiddleware) so streaming responses
such as Server-Sent Events pass through without buffering.
"""

import logging
import re
import time
import uuid

from config.settings import settings
from core.logging import request_id_var, user_id_var
from core.metrics import HTTP_LATENCY, HTTP_REQUESTS

logger = logging.getLogger("pluto.access")

_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")

SECURITY_HEADERS = [
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"referrer-policy", b"strict-origin-when-cross-origin"),
    (b"permissions-policy", b"camera=(), microphone=(), geolocation=()"),
    (b"cross-origin-opener-policy", b"same-origin"),
]


def _route_template(scope) -> str:
    # Use the route pattern (e.g. /api/v1/gmail/get/{msg_id}) to keep metric cardinality bounded
    route = scope.get("route")
    return getattr(route, "path", None) or "unmatched"


class RequestContextMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        headers = dict(scope.get("headers") or [])
        incoming = headers.get(b"x-request-id", b"").decode("latin-1")
        request_id = incoming if _VALID_REQUEST_ID.match(incoming) else uuid.uuid4().hex
        rid_token = request_id_var.set(request_id)
        uid_token = user_id_var.set("-")

        start = time.perf_counter()
        status_holder = {"status": 500}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
                extra = [(b"x-request-id", request_id.encode())] + SECURITY_HEADERS
                if settings.is_production:
                    extra.append((b"strict-transport-security", b"max-age=63072000; includeSubDomains"))
                message["headers"] = list(message.get("headers", [])) + extra
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            elapsed = time.perf_counter() - start
            method = scope.get("method", "")
            path = scope.get("path", "")
            route = _route_template(scope)
            status = status_holder["status"]
            if settings.METRICS_ENABLED and path != "/metrics":
                HTTP_REQUESTS.labels(method, route, str(status)).inc()
                HTTP_LATENCY.labels(method, route).observe(elapsed)
            # Health checks and status polling would otherwise drown the log
            if not path.endswith(("/health", "/health/live", "/agents/status")) and path != "/metrics":
                logger.info(
                    "%s %s -> %s (%.0f ms)", method, path, status, elapsed * 1000,
                    extra={"method": method, "path": path, "status": status,
                           "duration_ms": round(elapsed * 1000, 1)},
                )
            request_id_var.reset(rid_token)
            user_id_var.reset(uid_token)
