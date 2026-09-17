import logging
from typing import Optional, List
from langchain_core.embeddings import Embeddings
from config.settings import settings

logger = logging.getLogger(__name__)


class ChromaBuiltinEmbeddings(Embeddings):
    """
    Zero-config local embedding using Chroma's built-in ONNX all-MiniLM-L6-v2 model.
    Runs locally and requires no external API keys.
    """
    def __init__(self):
        import chromadb.utils.embedding_functions as ef
        self._ef = ef.DefaultEmbeddingFunction()

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return self._ef(texts)

    def embed_query(self, text: str) -> List[float]:
        return self._ef([text])[0]


def get_embedding_provider_tag(provider: Optional[str] = None, api_key: Optional[str] = None) -> str:
    """
    Returns a consistent collection tag based on the active provider.
    This guarantees that Chroma collections never encounter dimension mismatch errors.
    """
    cfg = settings.detect_llm_settings()
    google_emb_key = (getattr(settings, "GOOGLE_EMBEDDING_API_KEY", None) or "").strip()

    if not api_key and google_emb_key and (provider == "google" or provider is None):
        key = google_emb_key
        target_provider = "google"
    else:
        key = (api_key or cfg.get("api_key") or "").strip()
        target_provider = (provider or cfg.get("provider") or "").strip().lower()

    if key.startswith("AQ.") or key.startswith("AIza"):
        return "google"
    elif key.startswith("sk-") and target_provider == "openai":
        return "openai"
    elif target_provider == "google" and key:
        return "google"
    elif target_provider == "openai" and key:
        return "openai"
    return "local"


def get_embeddings(provider: Optional[str] = None, api_key: Optional[str] = None) -> Embeddings:
    """
    Dynamically returns the best available embedding model based on active credentials:
    1. Google Gemini: models/gemini-embedding-001 (dim 3072)
    2. OpenAI: text-embedding-3-small (dim 1536)
    3. Chroma Built-in: Local ONNX all-MiniLM-L6-v2 (dim 384, offline)
    """
    cfg = settings.detect_llm_settings()
    google_emb_key = (getattr(settings, "GOOGLE_EMBEDDING_API_KEY", None) or "").strip()

    if not api_key and google_emb_key and (provider == "google" or provider is None):
        key = google_emb_key
        target_provider = "google"
    else:
        key = (api_key or cfg.get("api_key") or "").strip()
        target_provider = (provider or cfg.get("provider") or "").strip().lower()

    # Detect provider by key signature if not explicitly set
    if key.startswith("AQ.") or key.startswith("AIza"):
        target_provider = "google"
    elif key.startswith("sk-") and target_provider not in ["groq", "openrouter", "anthropic"]:
        target_provider = "openai"

    if target_provider == "google" and key:
        try:
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            logger.info("Initializing Google Generative AI Embeddings (models/gemini-embedding-001)")
            return GoogleGenerativeAIEmbeddings(
                model="models/gemini-embedding-001",
                google_api_key=key,
            )
        except Exception as e:
            logger.warning(f"Google embeddings initialization failed: {e}. Falling back to local ONNX embeddings.")

    elif target_provider == "openai" and key:
        try:
            from langchain_openai import OpenAIEmbeddings
            model_name = settings.EMBEDDING_MODEL or "text-embedding-3-small"
            base_url = settings.LLM_BASE_URL or settings.BASE_URL
            kwargs = {
                "model": model_name,
                "openai_api_key": key,
            }
            if base_url:
                kwargs["base_url"] = base_url
            logger.info(f"Initializing OpenAI Embeddings ({model_name})")
            return OpenAIEmbeddings(**kwargs)
        except Exception as e:
            logger.warning(f"OpenAI embeddings initialization failed: {e}. Falling back to local ONNX embeddings.")

    logger.info("Using Chroma local built-in embeddings (offline ONNX all-MiniLM-L6-v2)")
    return ChromaBuiltinEmbeddings()