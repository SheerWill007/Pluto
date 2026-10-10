# syntax=docker/dockerfile:1.7

# ---- Build stage: compile wheels into an isolated virtualenv ---------------------------
FROM python:3.11-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install -r requirements.txt

# ---- Runtime stage: slim image, no compilers, non-root user ----------------------------
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    ENVIRONMENT=production \
    LOG_FORMAT=json \
    WEB_CONCURRENCY=2 \
    CHROMA_PERSIST_DIR=/app/data/chroma

RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin pluto

WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY --chown=pluto:pluto . .
RUN mkdir -p /app/data/chroma && chown -R pluto:pluto /app/data

USER pluto
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health/live', timeout=4)" || exit 1

# --proxy-headers: trust X-Forwarded-* from the load balancer for client IPs (rate limiting, audit)
# Workers come from WEB_CONCURRENCY. Multiple workers need Redis + a fixed JWT_SECRET_KEY.
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
