"""Unit tests for pure helpers across the codebase."""

import base64

import pytest

from agents.code_critic import _parse
from agents.common import message_text
from config.settings import settings


def b64(s: str) -> str:
    return base64.urlsafe_b64encode(s.encode()).decode().rstrip("=")


class TestCrypto:
    def test_encrypt_round_trip(self, monkeypatch):
        from cryptography.fernet import Fernet

        from core import crypto
        monkeypatch.setattr(settings, "TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode())
        crypto._fernet.cache_clear()
        try:
            enc = crypto.encrypt_secret("refresh-token")
            assert enc.startswith("enc:v1:") and "refresh-token" not in enc
            assert crypto.decrypt_secret(enc) == "refresh-token"
        finally:
            crypto._fernet.cache_clear()

    def test_plaintext_passthrough_for_legacy_rows(self):
        from core import crypto
        assert crypto.decrypt_secret("plain-legacy-token") == "plain-legacy-token"
        assert crypto.decrypt_secret(None) is None


class TestGmailBodyExtraction:
    def test_nested_multipart_prefers_plain_text(self):
        from tools.gmail_tools import extract_body
        payload = {"mimeType": "multipart/mixed", "parts": [
            {"mimeType": "multipart/alternative", "parts": [
                {"mimeType": "text/html", "body": {"data": b64("<p>html</p>")}},
                {"mimeType": "text/plain", "body": {"data": b64("plain body")}},
            ]},
        ]}
        assert extract_body(payload) == "plain body"

    def test_html_only_is_stripped(self):
        from tools.gmail_tools import extract_body
        payload = {"mimeType": "text/html",
                   "body": {"data": b64("<style>x{}</style><p>Hello&amp;bye</p><script>evil()</script>")}}
        assert extract_body(payload) == "Hello&bye"


class TestCriticParsing:
    def test_parses_fenced_json(self):
        raw = 'Sure!\n```json\n{"approved": true, "code": "x=1", "feedback": "ok"}\n```'
        assert _parse(raw, "orig") == {"approved": True, "code": "x=1", "feedback": "ok"}

    def test_garbage_is_rejected_safely(self):
        result = _parse("not json at all", "orig")
        assert result["approved"] is False and result["code"] == "orig"


class TestMessageText:
    @pytest.mark.parametrize("content,expected", [
        ("hi", "hi"),
        (None, ""),
        ([{"type": "text", "text": "a"}, {"type": "thinking", "thinking": "zzz"}, "b"], "ab"),
    ])
    def test_normalizes_provider_content(self, content, expected):
        assert message_text(content) == expected


class TestLLMKeyIsolation:
    def test_server_key_is_never_sent_to_a_different_provider(self, monkeypatch):
        from llm_provider import llm_initializer
        for name in ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY",
                     "GOOGLE_API_KEY", "GEMINI_API_KEY"):
            monkeypatch.setattr(settings, name, None)
        monkeypatch.setattr(settings, "LLM_PROVIDER", "google")
        monkeypatch.setattr(settings, "LLM_API_KEY", "AIza-server-gemini-key")

        assert llm_initializer.resolve_llm_config()["api_key"] == "AIza-server-gemini-key"
        assert llm_initializer.resolve_llm_config(provider="openai")["api_key"] is None
        assert llm_initializer.resolve_llm_config(provider="openai", api_key="sk-user")["api_key"] == "sk-user"


class TestVectorStoreScoping:
    def test_filters_always_include_owner(self):
        from rag.vector_store import _where
        assert _where("u1") == {"owner": "u1"}
        assert _where("u1", "all") == {"owner": "u1"}
        assert _where("u1", "a.pdf") == {"$and": [{"owner": "u1"}, {"source": "a.pdf"}]}


class TestOrchestratorTools:
    def test_guests_never_get_gmail_tool(self):
        from agents.common import LLMSelection
        from agents.orchestrator import build_tools
        from core.security import CurrentUser
        guest = [t.name for t in build_tools(CurrentUser("guest:x", "g", True), LLMSelection(), True)]
        member = [t.name for t in build_tools(CurrentUser("5", "m@x.io"), LLMSelection(), True)]
        assert "gmail_tool" not in guest and "search_document" in guest
        assert "gmail_tool" in member

    def test_build_messages_order(self):
        from agents.orchestrator import build_messages
        msgs = build_messages("now", {"remembered_facts": ["likes tea"],
                                      "recent_history": [{"role": "user", "content": "before"}]}, "be brief")
        assert [m[0] for m in msgs] == ["system", "system", "human", "human"]
        assert msgs[0][1] == "be brief" and msgs[-1][1] == "now"


class TestSettings:
    def test_production_problems_detected(self, monkeypatch):
        monkeypatch.setattr(settings, "JWT_SECRET_KEY", "short")
        monkeypatch.setattr(settings, "CORS_ORIGINS", "*")
        problems = " ".join(settings.validate_for_startup())
        assert "JWT_SECRET_KEY" in problems and "CORS_ORIGINS" in problems


# --- Model and endpoint resolution ------------------------------------------------

def test_retired_and_invented_model_names_are_upgraded():
    from llm_provider.llm_initializer import resolve_llm_config
    cfg = resolve_llm_config(provider="google", model="gemini-3.6-flash", api_key="AIza-test")
    assert cfg["model"] == "gemini-flash-lite-latest"
    cfg = resolve_llm_config(provider="groq", model="llama-3.1-8b-instant", api_key="gsk_test")
    assert cfg["model"] == "openai/gpt-oss-20b"


def test_current_model_names_pass_through():
    from llm_provider.llm_initializer import resolve_llm_config
    assert resolve_llm_config(provider="groq", model="qwen/qwen3-32b", api_key="gsk_test")["model"] == "qwen/qwen3-32b"
    assert resolve_llm_config(provider="openai", model="o4-mini", api_key="sk-test")["model"] == "o4-mini"
    # A model from another vendor falls back to the provider default
    assert resolve_llm_config(provider="openai", model="gemini-flash-latest", api_key="sk-test")["model"] == "gpt-4o-mini"


def test_server_base_url_is_not_reused_for_other_providers(monkeypatch):
    from llm_provider import llm_initializer
    # Server configured for Groq (which implies Groq's OpenAI-compatible base URL)
    for field, value in {"LLM_PROVIDER": "groq", "GROQ_API_KEY": "gsk_server", "LLM_BASE_URL": None,
                         "BASE_URL": None, "OLLAMA_BASE_URL": None}.items():
        monkeypatch.setattr(llm_initializer.settings, field, value)

    openai_cfg = llm_initializer.resolve_llm_config(provider="openai", api_key="sk-user")
    assert openai_cfg["base_url"] is None
    groq_cfg = llm_initializer.resolve_llm_config(provider="groq")
    assert groq_cfg["base_url"] == "https://api.groq.com/openai/v1"
    assert groq_cfg["api_key"] == "gsk_server"
    assert llm_initializer.resolve_llm_config(provider="ollama")["base_url"] == "http://localhost:11434"
