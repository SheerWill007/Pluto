"""
Ollama LLM Provider
"""

from .base_provider import BaseLLMProvider
from langchain_community.chat_models import ChatOllama


class OllamaProvider(BaseLLMProvider):
    """
    Ollama local LLM provider class.
    """

    def validate_config(self) -> bool:
        """Validate config parameters."""
        # Ollama is local, so no credentials or keys are strictly required.
        return True

    def get_model(self) -> ChatOllama:
        """Create and return the ChatOllama model instance."""
        if self._model is None:
            self.validate_config()
            base_url = self.config.get("base_url", "http://localhost:11434")
            model_name = self.config.get("model", "llama3")
            temperature = self.config.get("temperature", 0.7)

            # Setup ChatOllama
            self._model = ChatOllama(
                base_url=base_url,
                model=model_name,
                temperature=temperature,
            )
        return self._model
