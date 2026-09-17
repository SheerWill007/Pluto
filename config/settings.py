from pydantic_settings import BaseSettings
from typing import Optional, Dict, Any
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Pluto Agent"
    DEBUG: bool = False

    # LLM - Universal multi-provider configuration
    LLM_PROVIDER: Optional[str] = None
    LLM_MODEL: Optional[str] = None
    LLM_API_KEY: Optional[str] = None
    LLM_BASE_URL: Optional[str] = None
    LLM_TEMPERATURE: float = 0.7
    LLM_MAX_TOKENS: int = 4096
    
    # Specific provider keys (all optional, auto-detected)
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None
    OLLAMA_BASE_URL: Optional[str] = None

    # Legacy support
    BASE_URL: Optional[str] = None
    MAX_TOKEN: Optional[int] = None

    # Embeddings
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    GOOGLE_EMBEDDING_API_KEY: Optional[str] = None

    # ChromaDB
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    CHROMA_COLLECTION_NAME: str = "documents"

    # Redis
    REDIS_URL: Optional[str] = "redis://localhost:6379"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_USERNAME: str = "default"
    REDIS_PASSWORD: str = ""

    # PostgreSQL
    POSTGRES_URL: Optional[str] = None
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "agent_db"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "password"

    # Gmail
    GMAIL_CREDENTIALS_PATH: Optional[str] = "credentials.json"
    GMAIL_TOKEN_PATH: Optional[str] = "./token.json"
    SCOPES: str = "https://www.googleapis.com/auth/gmail.readonly"
    GMAIL_WEB_CLIENT_ID: str = ""
    GMAIL_WEB_CLIENT_SECRET: str = ""
    GMAIL_REDIRECT_URI: str = "https://pluto-agent.onrender.com/api/v1/gmail/callback"

    # Auth / JWT
    JWT_SECRET_KEY: str = ""

    def detect_llm_settings(self) -> Dict[str, Any]:
        """
        Intelligently auto-detect provider, active model, api key, and base URL from any environment variable.
        """
        api_key = None
        provider = (self.LLM_PROVIDER or "").strip().lower()
        model = (self.LLM_MODEL or self.OPENAI_MODEL or "").strip()
        base_url = self.LLM_BASE_URL or self.BASE_URL

        # 1. If provider is explicitly configured, pick its corresponding key
        if provider == "google":
            api_key = (self.GOOGLE_API_KEY or self.GEMINI_API_KEY or self.LLM_API_KEY or "").strip()
        elif provider == "openai":
            api_key = (self.OPENAI_API_KEY or self.LLM_API_KEY or "").strip()
        elif provider == "anthropic":
            api_key = (self.ANTHROPIC_API_KEY or self.LLM_API_KEY or "").strip()
        elif provider == "groq":
            api_key = (self.GROQ_API_KEY or self.LLM_API_KEY or "").strip()
        elif provider == "openrouter":
            api_key = (self.OPENROUTER_API_KEY or self.LLM_API_KEY or "").strip()
        elif provider == "ollama":
            api_key = None
        else:
            # Provider is not explicitly set; infer from keys present
            if self.GOOGLE_API_KEY or self.GEMINI_API_KEY:
                provider = "google"
                api_key = (self.GOOGLE_API_KEY or self.GEMINI_API_KEY).strip()
            elif self.ANTHROPIC_API_KEY:
                provider = "anthropic"
                api_key = self.ANTHROPIC_API_KEY.strip()
            elif self.GROQ_API_KEY:
                provider = "groq"
                api_key = self.GROQ_API_KEY.strip()
            elif self.OPENROUTER_API_KEY:
                provider = "openrouter"
                api_key = self.OPENROUTER_API_KEY.strip()
            elif self.OPENAI_API_KEY:
                provider = "openai"
                api_key = self.OPENAI_API_KEY.strip()
            elif self.LLM_API_KEY:
                api_key = self.LLM_API_KEY.strip()
                if api_key.startswith("AQ.") or api_key.startswith("AIza"):
                    provider = "google"
                elif api_key.startswith("sk-ant-"):
                    provider = "anthropic"
                elif api_key.startswith("gsk_"):
                    provider = "groq"
                elif api_key.startswith("sk-or-"):
                    provider = "openrouter"
                elif api_key.startswith("sk-"):
                    provider = "openai"
                else:
                    provider = "openai"
            else:
                provider = "openai"

        # 4. Standard active models per provider
        provider_default_models = {
            "google": "gemini-flash-lite-latest",
            "openai": "gpt-4o-mini",
            "anthropic": "claude-3-5-sonnet-20240620",
            "groq": "llama-3.1-8b-instant",
            "openrouter": "openai/gpt-4o-mini",
            "ollama": "llama3",
        }

        # Auto-upgrade deprecated or quota-restricted model names
        deprecated_models = {
            "gemini-pro": "gemini-flash-lite-latest",
            "gemini-1.5-pro": "gemini-flash-lite-latest",
            "gemini-1.5-flash": "gemini-flash-lite-latest",
            "gemini-2.0-flash": "gemini-flash-lite-latest",
            "gemini-2.5-flash": "gemini-flash-lite-latest",
            "gemini-3.5-flash": "gemini-flash-lite-latest",
            "gemini-3.6-flash": "gemini-flash-lite-latest",
            "gpt-3.5-turbo": "gpt-4o-mini",
            "llama3-8b-8192": "llama-3.1-8b-instant",
        }

        if not model or model in deprecated_models:
            model = deprecated_models.get(model) or provider_default_models.get(provider, "gpt-4o-mini")

        # 5. Base URLs
        if provider == "groq" and not base_url:
            base_url = "https://api.groq.com/openai/v1"
        elif provider == "openrouter" and not base_url:
            base_url = "https://openrouter.ai/api/v1"
        elif provider == "ollama" and not base_url:
            base_url = self.OLLAMA_BASE_URL or "http://localhost:11434"

        return {
            "provider": provider,
            "model": model,
            "api_key": api_key,
            "base_url": base_url,
            "temperature": self.LLM_TEMPERATURE,
            "max_tokens": self.LLM_MAX_TOKENS or self.MAX_TOKEN or 4096,
        }

    def get_llm_config(self) -> Dict[str, Any]:
        return self.detect_llm_settings()

    class Config:
        env_file = str(ENV_PATH)
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
