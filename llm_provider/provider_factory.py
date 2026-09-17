"""
LLM Provider Factory
Creates and manages LLM provider instances based on configuration
"""

from typing import Dict, Any, Optional
from .base_provider import BaseLLMProvider
from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider
from .google_provider import GoogleProvider
from .ollama_provider import OllamaProvider


class LLMProviderFactory:
    """
    Factory for creating LLM provider instances.
    Supports multiple provider types and configurations.
    """

    # Mapping of provider types to their classes
    PROVIDERS = {
        "openai": OpenAIProvider,
        "anthropic": AnthropicProvider,
        "google": GoogleProvider,
        "ollama": OllamaProvider,
    }

    # Aliases for backward compatibility
    ALIASES = {
        "openrouter": "openai",  # OpenRouter uses OpenAI-compatible API
        "azure": "openai",  # Azure OpenAI uses OpenAI-compatible API
        "groq": "openai",  # Groq uses OpenAI-compatible API
        "claude": "anthropic",
        "gemini": "google",
        "llama": "ollama",
        "mistral": "ollama",
    }

    _instance: Optional["LLMProviderFactory"] = None
    _current_provider: Optional[BaseLLMProvider] = None

    def __new__(cls):
        """Singleton pattern for factory."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    def create(
        cls,
        provider_type: str,
        **kwargs
    ) -> BaseLLMProvider:
        """
        Create a new LLM provider instance.
        """
        raw_provider = (provider_type or "openai").lower()
        provider_type = cls.ALIASES.get(raw_provider, raw_provider)

        # Set default base_url for OpenAI-compatible providers if not provided
        if raw_provider == "groq" and not kwargs.get("base_url"):
            kwargs["base_url"] = "https://api.groq.com/openai/v1"
        elif raw_provider == "openrouter" and not kwargs.get("base_url"):
            kwargs["base_url"] = "https://openrouter.ai/api/v1"

        if provider_type not in cls.PROVIDERS:
            available = ", ".join(cls.PROVIDERS.keys())
            raise ValueError(
                f"Unknown provider: {raw_provider}. Available providers: {available}"
            )
        
        provider_class = cls.PROVIDERS[provider_type]
        return provider_class(**kwargs)

    @classmethod
    def set_current(cls, provider: BaseLLMProvider) -> None:
        """Set the current active provider."""
        factory = cls()
        factory._current_provider = provider

    @classmethod
    def get_current(cls) -> BaseLLMProvider:
        """Get the current active provider."""
        factory = cls()
        if factory._current_provider is None:
            raise RuntimeError("No LLM provider set. Call set_current() first.")
        return factory._current_provider

    @classmethod
    def from_config(cls, config: Dict[str, Any]) -> BaseLLMProvider:
        """
        Create a provider from a configuration dictionary.
        
        Config format:
        {
            "provider": "openai",  # or "anthropic", "google", "ollama"
            "api_key": "...",
            "model": "...",
            # ... provider-specific settings
        }
        """
        config = config.copy()
        provider_type = config.pop("provider", "openai")
        return cls.create(provider_type, **config)

    @classmethod
    def register_provider(
        cls,
        name: str,
        provider_class: type,
        alias: Optional[str] = None
    ) -> None:
        """
        Register a custom provider.
        
        Args:
            name: Provider name
            provider_class: Provider class (must inherit from BaseLLMProvider)
            alias: Optional alias for the provider
        """
        if not issubclass(provider_class, BaseLLMProvider):
            raise TypeError("Provider must inherit from BaseLLMProvider")
        
        cls.PROVIDERS[name.lower()] = provider_class
        if alias:
            cls.ALIASES[alias.lower()] = name.lower()

    @classmethod
    def get_available_providers(cls) -> Dict[str, str]:
        """Get all available providers with their descriptions."""
        return {
            "openai": "OpenAI, Azure OpenAI, OpenRouter",
            "anthropic": "Anthropic Claude models",
            "google": "Google Gemini models",
            "ollama": "Local Ollama models (Llama, Mistral, etc.)",
        }
