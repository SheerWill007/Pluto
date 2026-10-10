"""Prometheus metrics. Scrape GET /metrics."""

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

HTTP_REQUESTS = Counter(
    "pluto_http_requests_total", "HTTP requests handled", ["method", "route", "status"]
)
HTTP_LATENCY = Histogram(
    "pluto_http_request_duration_seconds", "HTTP request latency", ["method", "route"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120),
)
LLM_CALLS = Counter(
    "pluto_llm_calls_total", "LLM agent invocations", ["agent", "provider", "outcome"]
)
LLM_LATENCY = Histogram(
    "pluto_llm_call_duration_seconds", "LLM agent latency", ["agent", "provider"],
    buckets=(0.25, 0.5, 1, 2, 5, 10, 20, 40, 80, 160),
)
DOCUMENTS_INGESTED = Counter("pluto_documents_ingested_total", "Documents ingested into RAG")


def render_metrics() -> tuple[bytes, str]:
    return generate_latest(), CONTENT_TYPE_LATEST
