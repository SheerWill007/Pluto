def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_security_headers_and_request_id(client):
    r = client.get("/api/v1/health", headers={"X-Request-ID": "trace-123"})
    assert r.headers["x-request-id"] == "trace-123"
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"


def test_invalid_request_id_is_replaced(client):
    r = client.get("/api/v1/health", headers={"X-Request-ID": "bad id with spaces <script>"})
    assert r.headers["x-request-id"] != "bad id with spaces <script>"
    assert len(r.headers["x-request-id"]) == 32


def test_readiness_reports_components(client):
    r = client.get("/api/v1/health/ready")
    body = r.json()
    # Outside production, a missing database degrades rather than fails readiness
    assert r.status_code == 200
    assert body["components"]["postgresql"]["status"] == "down"
    assert body["status"] in ("degraded", "ok")


def test_auth_config_never_exposes_secrets(client):
    body = client.get("/api/v1/config/auth").json()
    assert body["google_client_id"] == "test-client-id.apps.googleusercontent.com"
    assert "secret" not in str(body).lower()


def test_llm_config_never_exposes_keys(client):
    body = client.get("/api/v1/config/llm").json()
    assert "api_key" not in body and "has_key" in body


def test_metrics_endpoint(client):
    client.get("/api/v1/health")
    r = client.get("/metrics")
    assert r.status_code == 200 and "pluto_http_requests_total" in r.text


def test_cors_allows_only_configured_origins(client):
    ok = client.options("/api/v1/health", headers={"Origin": "http://localhost:5173",
                                                   "Access-Control-Request-Method": "GET"})
    bad = client.options("/api/v1/health", headers={"Origin": "https://evil.example",
                                                    "Access-Control-Request-Method": "GET"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "access-control-allow-origin" not in bad.headers


def test_unknown_errors_do_not_leak_internals(client, auth_headers, monkeypatch):
    import api.v1.rag
    monkeypatch.setattr(api.v1.rag, "list_documents", lambda owner: 1 / 0)
    from fastapi.testclient import TestClient

    from app import app
    with TestClient(app, raise_server_exceptions=False) as c:
        r = c.get("/api/v1/rag/documents", headers=auth_headers)
    assert r.status_code == 500
    assert "ZeroDivision" not in r.text and r.json()["code"] == "internal_error"
    assert r.json()["request_id"]
