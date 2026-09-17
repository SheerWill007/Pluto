"""
Google Gemini LLM Provider with automatic thought_signature preservation for tool calling
"""

import logging
from .base_provider import BaseLLMProvider
from langchain_google_genai import ChatGoogleGenerativeAI, chat_models

logger = logging.getLogger(__name__)

_PATCHED = False


def _apply_thought_signature_patch():
    """
    Patches langchain_google_genai to preserve thought_signature on functionCall parts.
    Required by Gemini 2.5/3.x thinking models during tool execution roundtrips.
    """
    global _PATCHED
    if _PATCHED:
        return
    _PATCHED = True

    orig_parse_candidate = chat_models._parse_response_candidate
    orig_parse_history = chat_models._parse_chat_history

    def patched_parse_candidate(candidate, streaming=False):
        ai_msg = orig_parse_candidate(candidate, streaming)
        signatures = []
        for p in candidate.content.parts:
            if getattr(p, "thought_signature", None):
                signatures.append(p.thought_signature)
        if signatures:
            ai_msg.additional_kwargs["thought_signatures"] = signatures
        return ai_msg

    def patched_parse_history(input_messages, convert_system_message_to_human=False, **kwargs):
        system_instruction, contents = orig_parse_history(input_messages, convert_system_message_to_human, **kwargs)
        # Re-attach thought_signatures to matching function_call parts in model content turns
        ai_msgs_with_sig = [
            m for m in input_messages 
            if isinstance(m, chat_models.AIMessage) and m.additional_kwargs.get("thought_signatures")
        ]
        if ai_msgs_with_sig:
            sig_map = {}
            fallback_sigs = []
            for m in ai_msgs_with_sig:
                sigs = m.additional_kwargs.get("thought_signatures", [])
                fallback_sigs.extend(sigs)
                for i, sig in enumerate(sigs):
                    if hasattr(m, "tool_calls") and i < len(m.tool_calls):
                        sig_map[m.tool_calls[i].get("name")] = sig

            sig_idx = 0
            for content in contents:
                if content.role == "model":
                    for part in content.parts:
                        if part.function_call:
                            if part.function_call.name in sig_map:
                                part.thought_signature = sig_map[part.function_call.name]
                            elif sig_idx < len(fallback_sigs):
                                part.thought_signature = fallback_sigs[sig_idx]
                                sig_idx += 1

        return system_instruction, contents

    chat_models._parse_response_candidate = patched_parse_candidate
    chat_models._parse_chat_history = patched_parse_history
    logger.info("Successfully enabled Gemini thought_signature tool-calling patch")


class GoogleProvider(BaseLLMProvider):
    """
    Google Gemini LLM provider class.
    """

    def validate_config(self) -> bool:
        """Validate config parameters."""
        api_key = self.config.get("api_key") or self.config.get("google_api_key")
        if not api_key:
            raise ValueError("Missing Google Gemini API key. Add LLM_API_KEY or GOOGLE_API_KEY to your .env file.")
        return True

    def get_model(self) -> ChatGoogleGenerativeAI:
        """Create and return the ChatGoogleGenerativeAI model instance."""
        if self._model is None:
            self.validate_config()
            _apply_thought_signature_patch()

            api_key = self.config.get("api_key") or self.config.get("google_api_key")
            model_name = self.config.get("model") or "gemini-flash-lite-latest"
            if model_name in ["gemini-3.5-flash", "gemini-3.6-flash"]:
                model_name = "gemini-flash-lite-latest"
            temperature = self.config.get("temperature", 0.7)
            max_tokens = self.config.get("max_tokens")

            # Setup ChatGoogleGenerativeAI with explicit client_options api_key for x-goog-api-key header
            self._model = ChatGoogleGenerativeAI(
                google_api_key=api_key,
                model=model_name,
                temperature=temperature,
                max_output_tokens=max_tokens,
                timeout=45,
                max_retries=2,
                transport="rest",
            )
        return self._model

    def generate_content_rest(self, prompt: str, **kwargs) -> str:
        """
        Direct REST call to generativelanguage.googleapis.com without any Authorization header.
        Passes the API key strictly as a URL query parameter:
        requests.post(url, params={"key": api_key}, ...)
        """
        import requests
        self.validate_config()
        api_key = self.config.get("api_key") or self.config.get("google_api_key")
        model_name = self.config.get("model") or "gemini-flash-lite-latest"
        if model_name in ["gemini-3.5-flash", "gemini-3.6-flash"]:
            model_name = "gemini-flash-lite-latest"

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
        # Explicitly ensure NO Authorization header is passed
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}]
        }

        response = requests.post(
            url,
            params={"key": api_key},
            json=payload,
            headers=headers,
            timeout=kwargs.get("timeout", 45)
        )
        response.raise_for_status()
        data = response.json()
        candidates = data.get("candidates", [])
        if candidates and "content" in candidates[0]:
            parts = candidates[0]["content"].get("parts", [])
            if parts and "text" in parts[0]:
                return parts[0]["text"]
        return ""
