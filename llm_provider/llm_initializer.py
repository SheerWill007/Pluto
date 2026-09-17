"""
LLM Initializer
Universal zero-config LLM model resolution with intelligent auto-detection, compatibility validation, and fallback
"""

import logging
from typing import Optional, Dict, Any
from langchain_core.language_models.llms import LLM
from config.settings import settings
from .provider_factory import LLMProviderFactory

logger = logging.getLogger(__name__)

ACTIVE_MODELS_MAP = {
    "google": {
        "default": "gemini-3.5-flash",
        "deprecated": {
            "gemini-pro": "gemini-3.6-flash",
            "gemini-1.5-pro": "gemini-3.6-flash",
            "gemini-1.5-flash": "gemini-3.6-flash",
            "gemini-2.0-flash": "gemini-3.6-flash",
            "gemini-2.5-flash": "gemini-3.6-flash",
            "gemini-2.5-flash-lite": "gemini-3.6-flash",
        }
    },
    "openai": {
        "default": "gpt-4o-mini",
        "deprecated": {
            "gpt-3.5-turbo": "gpt-4o-mini",
            "gpt-4": "gpt-4o",
        }
    },
    "anthropic": {
        "default": "claude-3-5-sonnet-20240620",
        "deprecated": {
            "claude-3-opus-20240229": "claude-3-5-sonnet-20240620",
        }
    },
    "groq": {
        "default": "openai/gpt-oss-20b",
        "deprecated": {
            "llama3-8b-8192": "openai/gpt-oss-20b",
            "llama-3.1-8b-instant": "openai/gpt-oss-20b",
            "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
        }
    },
    "openrouter": {
        "default": "openai/gpt-4o-mini",
        "deprecated": {}
    },
    "ollama": {
        "default": "llama3",
        "deprecated": {}
    }
}


def is_model_compatible_with_provider(provider: str, model_name: str) -> bool:
    """Check if model name matches the provider to prevent cross-provider errors."""
    if not model_name:
        return False
    m = model_name.lower()
    if provider == "google":
        return "gemini" in m or "gemma" in m
    if provider == "openai":
        return "gpt" in m or "o1" in m or "o3" in m or "text-embedding" in m
    if provider == "anthropic":
        return "claude" in m
    if provider == "groq":
        return "llama" in m or "mixtral" in m or "gemma" in m or "gpt-oss" in m
    return True


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

    # Determine provider & API key
    resolved_provider = req_provider or base_config["provider"]
    resolved_key = req_api_key or base_config.get("api_key")

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

    # Resolve model name with strict compatibility check
    provider_info = ACTIVE_MODELS_MAP.get(resolved_provider, {})
    default_model = provider_info.get("default", "gpt-4o-mini")
    deprecated_map = provider_info.get("deprecated", {})

    if req_model and is_model_compatible_with_provider(resolved_provider, req_model):
        resolved_model = deprecated_map.get(req_model, req_model)
    elif base_config.get("model") and base_config["provider"] == resolved_provider and is_model_compatible_with_provider(resolved_provider, base_config["model"]):
        resolved_model = deprecated_map.get(base_config["model"], base_config["model"])
    else:
        resolved_model = default_model

    # Resolve base URL
    base_url = kwargs.get("base_url") or base_config.get("base_url")
    if resolved_provider == "groq" and not base_url:
        base_url = "https://api.groq.com/openai/v1"
    elif resolved_provider == "openrouter" and not base_url:
        base_url = "https://openrouter.ai/api/v1"
    elif resolved_provider == "ollama" and not base_url:
        base_url = "http://localhost:11434"

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
        raise ValueError(f"Invalid configuration for {provider_type}: {str(e)}")


def list_available_providers() -> Dict[str, str]:
    """
    List all available LLM providers.
    """
    return LLMProviderFactory.get_available_providers()
