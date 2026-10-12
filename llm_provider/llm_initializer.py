"""
LLM Initializer
Universal zero-config LLM model resolution with intelligent auto-detection, compatibility validation, and fallback
"""

import logging
import re
from typing import Any, Dict, Optional

from langchain_core.language_models.llms import LLM

from config.models import default_model, upgrade_model
from config.settings import settings

from .provider_factory import LLMProviderFactory

logger = logging.getLogger(__name__)


def is_model_compatible_with_provider(provider: str, model_name: str) -> bool:
    """
    Rejects model names that obviously belong to another vendor, so switching providers in
    the UI never sends e.g. a Gemini model name to OpenAI. Aggregators (OpenRouter) and
    local runtimes (Ollama) host arbitrary models and accept anything.
    """
    if not model_name:
        return False
    m = model_name.lower()
    if provider == "google":
        return "gemini" in m or "gemma" in m
    if provider == "openai":
        return "gpt" in m or bool(re.match(r"^(o\d|chatgpt|text-embedding)", m))
    if provider == "anthropic":
        return "claude" in m
    if provider == "groq":
        # Groq hosts many open-weight families (gpt-oss, llama, qwen, kimi, ...), never these
        return not any(v in m for v in ("gemini", "claude")) and not m.startswith("gpt-")
    return True


def server_key_for_provider(provider: Optional[str], base_config: Dict[str, Any]) -> Optional[str]:
    """The server-configured API key for `provider`, or None if the server has no key for it."""
    explicit = {
        "google": settings.GOOGLE_API_KEY or settings.GEMINI_API_KEY,
        "openai": settings.OPENAI_API_KEY,
        "anthropic": settings.ANTHROPIC_API_KEY,
        "groq": settings.GROQ_API_KEY,
        "openrouter": settings.OPENROUTER_API_KEY,
    }.get(provider or "")
    if explicit and explicit.strip():
        return explicit.strip()
    if provider and provider == base_config.get("provider"):
        return base_config.get("api_key")
    return None


def resolve_llm_config(
    provider: Optional[str] = None,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Intelligently resolves LLM configuration:
    - Automatically detects provider if key format matches (AQ./AIza -> google, sk-ant -> anthropic, etc.)
    - Prefers .env configured provider when no custom key is provided
    - Validates model compatibility so a provider never receives an incompatible model name
    - Upgrades deprecated/invalid model names to active working models
    """
    base_config = settings.get_llm_config()

    req_api_key = api_key.strip() if (api_key and api_key.strip()) else None
    req_provider = provider.strip().lower() if (provider and provider.strip()) else None
    req_model = model.strip() if (model and model.strip()) else None

    # Determine provider & API key. A server-side key is only ever sent to the provider it
    # belongs to; otherwise picking another provider in the UI would leak it to that vendor.
    resolved_provider = req_provider or base_config["provider"]
    resolved_key = req_api_key or server_key_for_provider(resolved_provider, base_config)

    # Fallback key inference ONLY if resolved_provider is somehow still undetermined
    if not resolved_provider and resolved_key:
        if resolved_key.startswith("AQ.") or resolved_key.startswith("AIza"):
            resolved_provider = "google"
        elif resolved_key.startswith("sk-ant-"):
            resolved_provider = "anthropic"
        elif resolved_key.startswith("gsk_"):
            resolved_provider = "groq"
        elif resolved_key.startswith("sk-or-"):
            resolved_provider = "openrouter"
        elif resolved_key.startswith("sk-"):
            resolved_provider = "openai"
        else:
            resolved_provider = "openai"

    # If google provider is used with a custom key that does not look like a Gemini key, fallback to .env key
    if resolved_provider == "google" and req_api_key and not (req_api_key.startswith("AQ.") or req_api_key.startswith("AIza")):
        if base_config.get("api_key") and (base_config.get("api_key").startswith("AQ.") or base_config.get("api_key").startswith("AIza")):
            logger.warning("Custom key for Google does not look like a Gemini key. Falling back to .env key.")
            resolved_key = base_config.get("api_key")

    # Resolve model name with strict compatibility check, upgrading retired names
    if req_model and is_model_compatible_with_provider(resolved_provider, req_model):
        resolved_model = upgrade_model(resolved_provider, req_model)
    elif (base_config.get("model") and base_config["provider"] == resolved_provider
          and is_model_compatible_with_provider(resolved_provider, base_config["model"])):
        resolved_model = upgrade_model(resolved_provider, base_config["model"])
    else:
        resolved_model = default_model(resolved_provider)

    # Resolve base URL. The server's base URL belongs to the server's provider only;
    # reusing it for another provider would send that provider's key to the wrong host.
    base_url = kwargs.get("base_url")
    if not base_url and resolved_provider == base_config.get("provider"):
        base_url = base_config.get("base_url")
    if not base_url:
        base_url = {
            "groq": "https://api.groq.com/openai/v1",
            "openrouter": "https://openrouter.ai/api/v1",
            "ollama": settings.OLLAMA_BASE_URL or "http://localhost:11434",
        }.get(resolved_provider)

    config = {
        "provider": resolved_provider,
        "model": resolved_model,
        "api_key": resolved_key,
        "base_url": base_url,
        "temperature": temperature if temperature is not None else base_config.get("temperature", 0.7),
        "max_tokens": max_tokens if max_tokens is not None else base_config.get("max_tokens", 4096),
    }
    config.update(kwargs)
    return config


def get_llm_model(
    provider: Optional[str] = None,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    api_key: Optional[str] = None,
    **kwargs
) -> LLM:
    """
    Get an LLM model instance with automatic provider and model resolution.
    """
    config = resolve_llm_config(
        provider=provider,
        model=model,
        api_key=api_key or kwargs.pop("api_key", None),
        temperature=temperature,
        max_tokens=max_tokens,
        **kwargs
    )
    llm_provider = LLMProviderFactory.from_config(config)
    return llm_provider.get_model()


def create_llm_provider(
    provider: Optional[str] = None,
    **kwargs
) -> LLM:
    """
    Create and set the current LLM provider.
    """
    config = resolve_llm_config(provider=provider, **kwargs)
    llm_provider = LLMProviderFactory.from_config(config)
    LLMProviderFactory.set_current(llm_provider)
    return llm_provider.get_model()


def get_current_llm() -> LLM:
    """
    Get the current LLM provider's model.
    """
    try:
        provider = LLMProviderFactory.get_current()
        return provider.get_model()
    except RuntimeError:
        return create_llm_provider()


def validate_provider_config(provider_type: str) -> bool:
    """
    Validate that a provider has required configuration.
    """
    config = resolve_llm_config(provider=provider_type)
    try:
        llm_provider = LLMProviderFactory.from_config(config)
        llm_provider.validate_config()
        return True
    except Exception as e:
        raise ValueError(f"Invalid configuration for {provider_type}: {str(e)}") from e


def list_available_providers() -> Dict[str, str]:
    """
    List all available LLM providers.
    """
    return LLMProviderFactory.get_available_providers()
