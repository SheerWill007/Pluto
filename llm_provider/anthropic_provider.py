"""
Anthropic LLM Provider
"""

from .base_provider import BaseLLMProvider
from langchain_anthropic import ChatAnthropic


class AnthropicProvider(BaseLLMProvider):
    """
    Anthropic LLM provider class.
    """

    def validate_config(self) -> bool:
        """Validate config parameters."""
        api_key = self.config.get("api_key") or self.config.get("anthropic_api_key")
        if not api_key:
            raise ValueError("Missing Anthropic API key")
        return True

    def get_model(self) -> ChatAnthropic:
        """Create and return the ChatAnthropic model instance."""
        if self._model is None:
            self.validate_config()
            api_key = self.config.get("api_key") or self.config.get("anthropic_api_key")
            base_url = self.config.get("base_url") or self.config.get("anthropic_api_url")
            model_name = self.config.get("model", "claude-3-haiku-20240307")
            temperature = self.config.get("temperature", 0.7)
            max_tokens = self.config.get("max_tokens")

            # Setup ChatAnthropic
            self._model = ChatAnthropic(
                anthropic_api_key=api_key,
                model_name=model_name,
                anthropic_api_url=base_url,
                temperature=temperature,
                max_tokens_to_sample=max_tokens,
            )
        return self._model
