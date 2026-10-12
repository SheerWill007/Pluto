"""
Embedding backend selection.

The embedding backend is a property of the *server*, not of individual requests: if a
user's custom top-bar API key could change the embedding model, documents uploaded under
one key would silently vanish from searches made under another. The backend and the
collection tag are resolved together (and cached), so a failed initialization that falls
back to local embeddings can never write into a collection with different dimensions.
"""

import logging
import threading
from typing import List, Optional, Tuple

from langchain_core.embeddings import Embeddings

from config.settings import settings

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_backend: Optional[Tuple[str, Embeddings]] = None


class ChromaBuiltinEmbeddings(Embeddings):
    """
    Zero-config local embedding using Chroma's built-in ONNX all-MiniLM-L6-v2 model.
    Runs locally and requires no external API keys.
    """
    def __init__(self):
        import chromadb.utils.embedding_functions as ef
        self._ef = ef.DefaultEmbeddingFunction()

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [list(map(float, v)) for v in self._ef(texts)]

    def embed_query(self, text: str) -> List[float]:
        return self.embed_documents([text])[0]


def _is_google_key(key: str) -> bool:
    return key.startswith("AQ.") or key.startswith("AIza")


def _build_backend() -> Tuple[str, Embeddings]:
    cfg = settings.detect_llm_settings()
    google_emb_key = (settings.GOOGLE_EMBEDDING_API_KEY or "").strip()
    key = google_emb_key or (cfg.get("api_key") or "").strip()
    provider = "google" if google_emb_key else (cfg.get("provider") or "").lower()

    if key and (_is_google_key(key) or provider == "google"):
        try:
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            logger.info("Embeddings: Google (models/gemini-embedding-001)")
            return "google", GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001", google_api_key=key)
        except Exception as e:
            logger.warning("Google embeddings unavailable (%s); falling back to local embeddings", e)

    elif key and provider == "openai":
        try:
            from langchain_openai import OpenAIEmbeddings
            kwargs = {"model": settings.EMBEDDING_MODEL or "text-embedding-3-small", "openai_api_key": key}
            base_url = settings.LLM_BASE_URL or settings.BASE_URL
            if base_url:
                kwargs["base_url"] = base_url
            logger.info("Embeddings: OpenAI (%s)", kwargs["model"])
            return "openai", OpenAIEmbeddings(**kwargs)
        except Exception as e:
            logger.warning("OpenAI embeddings unavailable (%s); falling back to local embeddings", e)

    logger.info("Embeddings: local ONNX all-MiniLM-L6-v2")
    return "local", ChromaBuiltinEmbeddings()


def get_embedding_backend() -> Tuple[str, Embeddings]:
    """Returns (collection tag, embeddings), initialized once per process."""
    global _backend
    if _backend is None:
        with _lock:
            if _backend is None:
                _backend = _build_backend()
    return _backend


def get_embeddings() -> Embeddings:
    return get_embedding_backend()[1]
