import json

import pytest

PROTECTED = [
    ("post", "/api/v1/chat", {"message": "hi"}),
    ("post", "/api/v1/chat/stream", {"message": "hi"}),
    ("post", "/api/v1/rag/query", {"query": "q"}),
    ("get", "/api/v1/rag/documents", None),
    ("delete", "/api/v1/rag/documents", None),
    ("post", "/api/v1/code/generate", {"query": "q"}),
    ("post", "/api/v1/code/critic", {"user_request": "q", "generated_code": "x"}),
    ("get", "/api/v1/gmail/status", None),
]


@pytest.mark.parametrize("method,path,body", PROTECTED)
def test_endpoints_require_authentication(client, method, path, body):
    r = getattr(client, method)(path, **({"json": body} if body else {}))
    assert r.status_code == 401, path


def test_garbage_token_rejected(client):
    r = client.get("/api/v1/rag/documents", headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401 and r.json()["code"] == "invalid_token"


@pytest.mark.parametrize("path", ["/api/v1/gmail/status", "/api/v1/gmail/connect", "/api/v1/gmail/list"])
def test_gmail_requires_registered_account(client, guest_headers, path):
    r = client.get(path, headers=guest_headers)
    assert r.status_code == 401 and r.json()["code"] == "guest_not_allowed"


def test_gmail_callback_rejects_forged_state(client):
    r = client.get("/api/v1/gmail/callback", params={"state": "1", "code": "abc"})
    assert r.status_code == 400 and "expired" in r.text


class TestChat:
    @pytest.fixture
    def fake_orchestrator(self, monkeypatch):
        import api.v1.chat
        seen = []

        def fake(user_message, user, llm, context=None, agent_mode=False, system_prompt=None):
            seen.append({"user": user.id, "history": [m["content"] for m in context["recent_history"]],
                         "system_prompt": system_prompt, "llm": llm})
            return f"echo: {user_message}"

        monkeypatch.setattr(api.v1.chat, "run_orchestrator", fake)
        return seen

    def test_chat_round_trip(self, client, auth_headers, fake_orchestrator):
        r = client.post("/api/v1/chat", headers=auth_headers,
                        json={"message": "hello", "session_id": "s1", "system_prompt": "be brief",
                              "provider": " openai ", "api_key": "  "})
        assert r.status_code == 200
        assert r.json() == {"response": "echo: hello", "agent_used": "orchestrator", "session_id": "s1"}
        assert fake_orchestrator[0]["system_prompt"] == "be brief"
        assert fake_orchestrator[0]["llm"].provider == "openai" and fake_orchestrator[0]["llm"].api_key is None

    def test_history_is_isolated_between_users(self, client, fake_orchestrator):
        from core.security import create_access_token
        alice = {"Authorization": f"Bearer {create_access_token(1, 'alice@example.com')}"}
        mallory = {"Authorization": f"Bearer {create_access_token(2, 'mallory@example.com')}"}

        client.post("/api/v1/chat", headers=alice, json={"message": "my secret is 42", "session_id": "shared"})
        client.post("/api/v1/chat", headers=mallory, json={"message": "what was said?", "session_id": "shared"})

        assert fake_orchestrator[1]["user"] == "2"
        assert not any("secret" in h for h in fake_orchestrator[1]["history"])

    def test_history_accumulates_within_session(self, client, auth_headers, fake_orchestrator):
        client.post("/api/v1/chat", headers=auth_headers, json={"message": "one", "session_id": "s"})
        client.post("/api/v1/chat", headers=auth_headers, json={"message": "two", "session_id": "s"})
        # The current message is passed separately, so history holds only prior turns
        assert fake_orchestrator[1]["history"] == ["one", "echo: one"]

    def test_provider_failure_is_a_friendly_502(self, client, auth_headers, monkeypatch):
        import api.v1.chat

        def boom(**kwargs):
            raise RuntimeError("Error code: 401 - invalid_api_key")

        monkeypatch.setattr(api.v1.chat, "run_orchestrator", boom)
        r = client.post("/api/v1/chat", headers=auth_headers, json={"message": "hi"})
        assert r.status_code == 502
        assert r.json()["code"] == "upstream_error" and "Invalid API key" in r.json()["detail"]

    def test_message_length_is_capped(self, client, auth_headers):
        r = client.post("/api/v1/chat", headers=auth_headers, json={"message": "x" * 40_000})
        assert r.status_code == 422

    def test_stream_emits_sse_events(self, client, auth_headers, monkeypatch):
        import api.v1.chat

        def fake_stream(**kwargs):
            yield {"type": "tool_start", "tools": ["web_search"]}
            yield {"type": "tool_end", "tools": ["web_search"]}
            yield {"type": "token", "content": "Hel"}
            yield {"type": "token", "content": "lo"}
            yield {"type": "done", "content": "Hello"}

        monkeypatch.setattr(api.v1.chat, "stream_orchestrator", fake_stream)
        with client.stream("POST", "/api/v1/chat/stream", headers=auth_headers,
                           json={"message": "hi", "session_id": "s9"}) as r:
            assert r.headers["content-type"].startswith("text/event-stream")
            events = [json.loads(line[len("data: "):]) for line in r.iter_lines() if line.startswith("data: ")]

        assert [e["type"] for e in events] == ["start", "tool_start", "tool_end", "token", "token", "done"]
        assert events[-1]["content"] == "Hello" and events[0]["session_id"] == "s9"

        # The final answer is persisted to conversation memory
        from memory.memory_manager import get_context
        assert get_context("s9", "1")["recent_history"][-1]["content"] == "Hello"

    def test_stream_reports_errors_in_band(self, client, auth_headers, monkeypatch):
        import api.v1.chat

        def failing(**kwargs):
            yield {"type": "token", "content": "par"}
            raise RuntimeError("insufficient_quota")

        monkeypatch.setattr(api.v1.chat, "stream_orchestrator", failing)
        with client.stream("POST", "/api/v1/chat/stream", headers=auth_headers, json={"message": "hi"}) as r:
            events = [json.loads(line[6:]) for line in r.iter_lines() if line.startswith("data: ")]
        assert events[-1]["type"] == "error" and "credits" in events[-1]["detail"]


class TestRag:
    @pytest.fixture
    def fake_store(self, monkeypatch):
        import api.v1.rag
        store = {"added": [], "deleted": []}
        monkeypatch.setattr(api.v1.rag, "add_documents", lambda chunks, owner: store["added"].append((owner, chunks)))
        monkeypatch.setattr(api.v1.rag, "delete_documents_by_source",
                            lambda source, owner: store["deleted"].append((owner, source)) or 0)
        return store

    def test_upload_txt_is_chunked_and_owned(self, client, auth_headers, fake_store):
        r = client.post("/api/v1/rag/ingest", headers=auth_headers,
                        files={"file": ("../../etc/notes.txt", b"Pluto is a dwarf planet. " * 200, "text/plain")})
        assert r.status_code == 200, r.text
        assert r.json()["filename"] == "notes.txt"  # path stripped
        owner, chunks = fake_store["added"][0]
        assert owner == "1" and len(chunks) == r.json()["chunks_stored"] > 1
        assert chunks[0].metadata["source"] == "notes.txt" and "chunk_index" in chunks[0].metadata

    def test_upload_rejects_unsupported_type(self, client, auth_headers, fake_store):
        r = client.post("/api/v1/rag/ingest", headers=auth_headers,
                        files={"file": ("malware.exe", b"MZ...", "application/octet-stream")})
        assert r.status_code == 415

    def test_upload_enforces_size_limit(self, client, auth_headers, fake_store, monkeypatch):
        from config.settings import settings
        monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 1)
        r = client.post("/api/v1/rag/ingest", headers=auth_headers,
                        files={"file": ("big.txt", b"x" * (1024 * 1024 + 10), "text/plain")})
        assert r.status_code == 413

    def test_upload_rejects_empty_file(self, client, auth_headers, fake_store):
        r = client.post("/api/v1/rag/ingest", headers=auth_headers, files={"file": ("e.txt", b"", "text/plain")})
        assert r.status_code == 400 and r.json()["code"] == "empty_file"

    def test_query_retrieves_once_and_cites_sources(self, client, auth_headers, monkeypatch):
        from langchain_core.documents import Document

        import api.v1.rag
        calls = []

        def fake_search(owner, query, top_k=4, source=None):
            calls.append((owner, source))
            return [(Document(page_content="c1", metadata={"source": "a.pdf"}), 0.91234),
                    (Document(page_content="c2", metadata={"source": "a.pdf"}), None)]

        monkeypatch.setattr(api.v1.rag, "search", fake_search)
        monkeypatch.setattr(api.v1.rag, "answer_from_documents", lambda q, docs, **kw: f"{len(docs)} docs")
        r = client.post("/api/v1/rag/query", headers=auth_headers, json={"query": "q", "source": "a.pdf"})
        assert r.status_code == 200
        assert r.json() == {"answer": "2 docs", "sources": ["a.pdf"],
                            "chunks": [{"content": "c1", "score": 0.9123, "source": "a.pdf"},
                                       {"content": "c2", "score": None, "source": "a.pdf"}]}
        assert calls == [("1", "a.pdf")]

    def test_top_k_is_bounded(self, client, auth_headers):
        r = client.post("/api/v1/rag/query", headers=auth_headers, json={"query": "q", "top_k": 500})
        assert r.status_code == 422
