"""Health, readiness, public configuration, and component status."""

import time

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from config.settings import APP_VERSION, settings
from memory import db
from memory.redis_client import get_redis
from rag import vector_store
from schemas.request_models import HealthResponse

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
@router.get("/health/live", response_model=HealthResponse, include_in_schema=False)
def health_check():
    """Liveness: the process is up and serving requests."""
    return HealthResponse(status="ok")


def _timed(check) -> dict:
    t0 = time.perf_counter()
    try:
        ok = bool(check())
    except Exception:
        ok = False
    return {"status": "up" if ok else "down", "latency_ms": round((time.perf_counter() - t0) * 1000, 1)}


@router.get("/health/ready")
def readiness():
    """
    Readiness: dependencies are reachable. In production PostgreSQL is required (auth and
    Gmail depend on it); Redis and ChromaDB degrade gracefully.
    """
    components = {
        "postgresql": _timed(lambda: db.is_available(force=True)),
        "redis": _timed(lambda: get_redis() is not None and get_redis().ping()),
        "chromadb": _timed(vector_store.is_ready),
    }
    required = ["postgresql"] if settings.is_production else []
    healthy = all(components[c]["status"] == "up" for c in required)
    degraded = any(c["status"] == "down" for c in components.values())
    body = {"status": "ok" if not degraded else ("degraded" if healthy else "unavailable"),
            "version": APP_VERSION, "components": components}
    return JSONResponse(body, status_code=200 if healthy else 503)


@router.get("/config/llm")
def get_llm_configuration():
    """Auto-detected LLM provider and model so the frontend can sync. Never exposes keys."""
    cfg = settings.get_llm_config()
    return {
        "provider": cfg["provider"],
        "model": cfg["model"],
        "has_key": bool(cfg.get("api_key")),
        "temperature": cfg.get("temperature", 0.7),
        "max_tokens": cfg.get("max_tokens", 4096),
    }


@router.get("/config/auth")
def get_auth_config():
    """Public sign-in configuration. The Google client ID is public by design; the secret never leaves the server."""
    return {
        "google_client_id": settings.GOOGLE_CLIENT_ID,
        "has_google_auth": bool(settings.GOOGLE_CLIENT_ID),
        "allow_guest": settings.ALLOW_GUEST_ACCESS,
    }


def _status(ok: bool, latency: float = 0, when_down: str = "disconnected", **extra) -> dict:
    return {"status": "connected" if ok else when_down, "latency": int(latency), **extra}


@router.get("/agents/status")
def agents_status():
    status = {}

    t0 = time.perf_counter()
    client = get_redis()
    try:
        redis_ok = client is not None and client.ping()
    except Exception:
        redis_ok = False
    status["redis"] = _status(redis_ok, (time.perf_counter() - t0) * 1000)

    t0 = time.perf_counter()
    pg_ok = db.is_available()
    status["postgresql"] = _status(pg_ok, (time.perf_counter() - t0) * 1000, when_down="error")

    t0 = time.perf_counter()
    chroma_ok = vector_store.is_ready()
    status["chromadb"] = _status(chroma_ok, (time.perf_counter() - t0) * 1000, when_down="idle")

    cfg = settings.get_llm_config()
    if cfg["provider"] == "ollama":
        t0 = time.perf_counter()
        try:
            with httpx.Client(timeout=0.5) as http:
                ollama_ok = http.get(cfg.get("base_url") or "http://localhost:11434").status_code == 200
        except Exception:
            ollama_ok = False
        status["ollama"] = _status(ollama_ok, (time.perf_counter() - t0) * 1000)
    else:
        status["ollama"] = _status(False)

    llm_ready = bool(cfg.get("api_key")) or cfg["provider"] == "ollama"
    status["orchestrator"] = _status(llm_ready, when_down="idle", last_action="Listening for prompts")
    status["rag_agent"] = _status(chroma_ok, when_down="idle", last_action="Ready to query indexes")
    status["gmail_agent"] = _status(bool(settings.GMAIL_WEB_CLIENT_ID) and pg_ok, when_down="idle",
                                    last_action="Monitoring messages")
    status["code_generator"] = _status(llm_ready, when_down="idle", last_action="Synthesizing code")
    status["code_critic"] = _status(llm_ready, when_down="idle", last_action="Evaluating scripts")

    provider, has_key = cfg["provider"], bool(cfg.get("api_key"))
    status["openai"] = _status(bool(settings.OPENAI_API_KEY) or (has_key and provider == "openai"))
    status["anthropic"] = _status(bool(settings.ANTHROPIC_API_KEY) or (has_key and provider == "anthropic"))
    status["gemini"] = _status(bool(settings.GOOGLE_API_KEY or settings.GEMINI_API_KEY) or (has_key and provider == "google"))
    status["groq"] = _status(bool(settings.GROQ_API_KEY) or (has_key and provider == "groq"))
    status["openrouter"] = _status(bool(settings.OPENROUTER_API_KEY) or (has_key and provider == "openrouter"))
    return status
