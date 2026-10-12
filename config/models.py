"""
Default and retired model names per provider -- the single source of truth used by both
server configuration (config.settings) and per-request resolution (llm_provider).

Retired names are upgraded so old .env files and saved browser settings keep working.
Prefer Google's `-latest` aliases: they track the current model instead of going stale.
Keep the defaults in sync with DEFAULT_MODELS in frontend/src/lib/types.ts.
"""

DEFAULT_MODELS = {
    "google": "gemini-flash-lite-latest",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-sonnet-5-5",
    "groq": "openai/gpt-oss-20b",
    "openrouter": "openai/gpt-4o-mini",
    # Tool calling, which the orchestrator relies on, needs llama3.1 or newer
    "ollama": "llama3.1",
}

RETIRED_MODELS = {
    "google": {
        "gemini-pro": "gemini-flash-latest",
        "gemini-1.0-pro": "gemini-flash-latest",
        "gemini-1.5-pro": "gemini-flash-latest",
        "gemini-1.5-flash": "gemini-flash-lite-latest",
        "gemini-2.0-flash": "gemini-flash-lite-latest",
        "gemini-2.0-flash-lite": "gemini-flash-lite-latest",
        "gemini-2.5-flash": "gemini-flash-latest",
        "gemini-2.5-flash-lite": "gemini-flash-lite-latest",
        # Names written by earlier Pluto versions that never existed upstream
        "gemini-3.5-flash": "gemini-flash-lite-latest",
        "gemini-3.6-flash": "gemini-flash-lite-latest",
    },
    "openai": {
        "gpt-3.5-turbo": "gpt-4o-mini",
        "gpt-4": "gpt-4o",
    },
    "anthropic": {
        "claude-3-opus-20240229": "claude-sonnet-5-5",
        "claude-3-sonnet-20240229": "claude-sonnet-5-5",
        "claude-3-haiku-20240307": "claude-haiku-5-5",
        "claude-3-5-sonnet-20240620": "claude-sonnet-5-5",
        "claude-3-5-sonnet-20241022": "claude-sonnet-5-5",
        "claude-3-5-haiku-20241022": "claude-haiku-5-5",
        "claude-3-7-sonnet-20250219": "claude-sonnet-5-5",
    },
    "groq": {
        "llama3-8b-8192": "openai/gpt-oss-20b",
        "llama3-70b-8192": "openai/gpt-oss-120b",
        "llama-3.1-8b-instant": "openai/gpt-oss-20b",
        "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
        "mixtral-8x7b-32768": "openai/gpt-oss-20b",
        "gemma2-9b-it": "openai/gpt-oss-20b",
    },
    "openrouter": {},
    "ollama": {},
}


def default_model(provider: str) -> str:
    return DEFAULT_MODELS.get(provider, DEFAULT_MODELS["openai"])


def upgrade_model(provider: str, model: str) -> str:
    """Maps a retired model name to its replacement; other names pass through unchanged."""
    return RETIRED_MODELS.get(provider, {}).get(model, model)
