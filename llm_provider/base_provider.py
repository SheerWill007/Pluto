"""
Base LLM Provider Interface
Defines the contract for all LLM provider implementations
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from langchain_core.language_models.llms import LLM


class BaseLLMProvider(ABC):
    """
    Abstract base class for LLM providers.
    All LLM providers should inherit from this class and implement the required methods.
    """

    def __init__(self, **kwargs):
        """
        Initialize the provider with configuration.
        
        Args:
            **kwargs: Provider-specific configuration parameters
        """
        self.config = kwargs
        self._model = None

    @abstractmethod
    def get_model(self) -> LLM:
        """
        Get the LLM model instance.
        
        Returns:
            LLM: A LangChain LLM instance
        """
        pass

    @abstractmethod
    def validate_config(self) -> bool:
        """
        Validate that all required configuration is present.
        
        Returns:
            bool: True if configuration is valid
            
        Raises:
            ValueError: If configuration is invalid or missing required fields
        """
        pass

    def invoke(self, prompt: str, **kwargs) -> str:
        """
        Invoke the model with a prompt.
        
        Args:
            prompt: The input prompt
            **kwargs: Additional parameters for the model
            
        Returns:
            str: The model's response
        """
        model = self.get_model()
        response = model.invoke(prompt, **kwargs)
        return response if isinstance(response, str) else response.content

    def batch_invoke(self, prompts: List[str], **kwargs) -> List[str]:
        """
        Invoke the model with multiple prompts.
        
        Args:
            prompts: List of input prompts
            **kwargs: Additional parameters for the model
            
        Returns:
            List[str]: List of model responses
        """
        model = self.get_model()
        responses = model.batch(prompts, **kwargs)
        return [r if isinstance(r, str) else r.content for r in responses]

    def get_config(self) -> Dict[str, Any]:
        """Get the current configuration."""
        return self.config.copy()

    def update_config(self, **kwargs) -> None:
        """Update configuration parameters."""
        self.config.update(kwargs)
        self._model = None  # Reset model instance when config changes

    def post_request(
        self,
        url: str,
        payload: Dict[str, Any],
        headers: Optional[Dict[str, str]] = None,
        **kwargs
    ) -> Any:
        """
        Execute an HTTP POST request to an LLM endpoint.
        Safely handles provider-specific authentication:
        - If the target URL points to generativelanguage.googleapis.com, NEVER sets an
          Authorization header; passes the key strictly as a URL query parameter:
          requests.post(url, params={"key": api_key}, ...)
        - For other providers, uses standard Authorization: Bearer header.
        """
        import requests
        api_key = self.config.get("api_key") or self.config.get("google_api_key") or self.config.get("openai_api_key")
        clean_headers = dict(headers or {})

        # Google Gemini / Generative Language API path
        if "generativelanguage.googleapis.com" in url:
            # Strip ANY Authorization header completely - Google Generative Language rejects 'Bearer <key>' with 401
            clean_headers.pop("Authorization", None)
            clean_headers.pop("authorization", None)
            clean_headers.setdefault("Content-Type", "application/json")

            params = kwargs.pop("params", {})
            if api_key:
                params["key"] = api_key

            return requests.post(url, params=params, json=payload, headers=clean_headers, **kwargs)

        # Other standard providers (OpenAI, Anthropic, Groq, OpenRouter)
        if api_key and "Authorization" not in clean_headers and "authorization" not in clean_headers:
            clean_headers["Authorization"] = f"Bearer {api_key}"
        clean_headers.setdefault("Content-Type", "application/json")

        return requests.post(url, json=payload, headers=clean_headers, **kwargs)
