import os

os.environ.setdefault("GRPC_ENABLE_FORK_SUPPORT", "0")
# ChromaDB phones home by default; opt out unless explicitly enabled
os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

import faulthandler  # noqa: E402
import logging  # noqa: E402
import signal  # noqa: E402
from contextlib import asynccontextmanager  # noqa: E402

from fastapi import FastAPI, Response  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.middleware.gzip import GZipMiddleware  # noqa: E402

from config.settings import APP_VERSION, settings  # noqa: E402
from core.errors import register_exception_handlers  # noqa: E402
from core.logging import configure_logging  # noqa: E402
from core.metrics import render_metrics  # noqa: E402
from core.middleware import RequestContextMiddleware  # noqa: E402

faulthandler.enable()
try:
    faulthandler.register(signal.SIGUSR1)
except (AttributeError, ValueError):
    pass  # SIGUSR1 is unavailable on Windows

configure_logging(settings.LOG_LEVEL or ("DEBUG" if settings.DEBUG else "INFO"), settings.LOG_FORMAT)
logger = logging.getLogger("pluto")


def check_configuration() -> None:
    problems = settings.validate_for_startup()
    if problems and settings.is_production:
        for p in problems:
            logger.critical("Configuration error: %s", p)
        raise RuntimeError("Refusing to start in production with insecure configuration: " + " ".join(problems))
    for p in problems:
        logger.warning("Configuration warning (development): %s", p)
    if not settings.JWT_SECRET_KEY or len(settings.JWT_SECRET_KEY) < 32:
        settings.ensure_jwt_secret()
        logger.warning("Using an ephemeral JWT secret; sessions will not survive restarts or span multiple workers.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s v%s (%s)", settings.APP_NAME, APP_VERSION, settings.ENVIRONMENT)
    check_configuration()

    from memory import db
    if db.is_available(force=True):
        try:
            applied = db.run_migrations()
            logger.info("Database schema up to date (%d migration(s) applied)", applied)
        except Exception:
            logger.exception("Database migration failed")
            if settings.is_production:
                raise
    else:
        logger.warning("PostgreSQL unavailable at startup; auth and Gmail features are disabled until it is reachable")

    yield

    logger.info("Shutting down")
    db.close_pool()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        description="Pluto -- Multi-Agent AI System with RAG",
        version=APP_VERSION,
        lifespan=lifespan,
        # Interactive docs are useful in development but expand the attack surface in production
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None if settings.is_production else "/redoc",
        openapi_url=None if settings.is_production else "/openapi.json",
    )

    # Middleware order: the last added runs first (outermost)
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID", "Retry-After"],
        max_age=600,
    )
    app.add_middleware(RequestContextMiddleware)

    register_exception_handlers(app)

    from api.v1 import router as v1_router
    app.include_router(v1_router, prefix="/api/v1")

    @app.get("/", include_in_schema=False)
    def root():
        return {"name": settings.APP_NAME, "version": APP_VERSION,
                "docs": None if settings.is_production else "/docs", "health": "/api/v1/health"}

    if settings.METRICS_ENABLED:
        @app.get("/metrics", include_in_schema=False)
        def metrics():
            body, content_type = render_metrics()
            return Response(body, media_type=content_type)

    return app


app = create_app()
