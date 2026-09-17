"""
OpenAI LLM Provider
"""

from .base_provider import BaseLLMProvider
from langchain_openai import ChatOpenAI


class OpenAIProvider(BaseLLMProvider):
    """
    OpenAI LLM provider class.
    Supports OpenAI API, Azure OpenAI, and OpenRouter.
    """

    def validate_config(self) -> bool:
        """Validate config parameters."""
        api_key = self.config.get("api_key") or self.config.get("openai_api_key")
        if not api_key:
            raise ValueError("Missing OpenAI or OpenRouter API key")
        return True

    def get_model(self) -> ChatOpenAI:
        """Create and return the ChatOpenAI model instance."""
        if self._model is None:
            self.validate_config()
            api_key = self.config.get("api_key") or self.config.get("openai_api_key")
            base_url = self.config.get("base_url") or self.config.get("openai_api_base")
            model_name = self.config.get("model", "gpt-3.5-turbo")
            temperature = self.config.get("temperature", 0.7)
            max_tokens = self.config.get("max_tokens")

            # Branch Google/Gemini endpoint separately to avoid sending Authorization: Bearer to generativelanguage.googleapis.com
            if base_url and "generativelanguage.googleapis.com" in base_url:
                from .google_provider import GoogleProvider
                google_cfg = self.config.copy()
                google_cfg["provider"] = "google"
                return GoogleProvider(**google_cfg).get_model()

            # Setup ChatOpenAI with correct parameter names
            kwargs = {
                "api_key": api_key,
                "model": model_name,
                "temperature": temperature,
            }
            
            if base_url:
                kwargs["base_url"] = base_url
            
            if max_tokens:
                kwargs["max_tokens"] = max_tokens
            
            self._model = ChatOpenAI(**kwargs)
            
        return self._model
