"""
ChromaDB access. Every chunk is tagged with an `owner` (the user ID) and every read,
delete, and list is filtered by it, so users only ever see their own documents.
"""

import logging
import threading
from typing import Optional

from chromadb.config import Settings as ChromaSettings
from langchain_community.vectorstores import Chroma

from config.settings import settings
from rag.embeddings import get_embedding_backend

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_store: Optional[Chroma] = None


def get_collection_name() -> str:
    tag, _ = get_embedding_backend()
    return f"{settings.CHROMA_COLLECTION_NAME or 'documents'}_{tag}"


def _vectorstore() -> Chroma:
    global _store
    if _store is None:
        with _lock:
            if _store is None:
                _, embeddings = get_embedding_backend()
                _store = Chroma(
                    embedding_function=embeddings,
                    collection_name=get_collection_name(),
                    persist_directory=settings.CHROMA_PERSIST_DIR,
                    # Never send usage telemetry from an embedded, self-hosted vector store
                    client_settings=ChromaSettings(anonymized_telemetry=False, is_persistent=True,
                                                   persist_directory=settings.CHROMA_PERSIST_DIR),
                )
    return _store


def _where(owner: str, source: Optional[str] = None) -> dict:
    if source and source.strip() and source.strip().lower() != "all":
        return {"$and": [{"owner": owner}, {"source": source.strip()}]}
    return {"owner": owner}


def add_documents(chunks, owner: str) -> int:
    if not chunks:
        logger.warning("No chunks provided to add_documents.")
        return 0
    for chunk in chunks:
        chunk.metadata["owner"] = owner
    _vectorstore().add_documents(chunks)
    logger.info("Indexed %d chunks into '%s'", len(chunks), get_collection_name())
    return len(chunks)


def get_retriever(owner: str, top_k: int = 4, source: Optional[str] = None):
    return _vectorstore().as_retriever(search_kwargs={"k": top_k, "filter": _where(owner, source)})


def search(owner: str, query: str, top_k: int = 4, source: Optional[str] = None) -> list:
    """Returns [(Document, relevance score in [0, 1])], best first."""
    try:
        return _vectorstore().similarity_search_with_relevance_scores(
            query, k=top_k, filter=_where(owner, source)
        )
    except Exception as e:
        # Some embedding/distance combinations can't produce normalized scores
        logger.debug("Relevance scores unavailable (%s); falling back to plain search", e)
        docs = _vectorstore().similarity_search(query, k=top_k, filter=_where(owner, source))
        return [(d, None) for d in docs]


def delete_documents_by_source(source: str, owner: str) -> int:
    if not source:
        return 0
    try:
        store = _vectorstore()
        ids = store.get(where=_where(owner, source), include=[]).get("ids", [])
        if ids:
            store.delete(ids=ids)
        return len(ids)
    except Exception as e:
        logger.warning("Error deleting documents for source '%s': %s", source, e)
        return 0


def list_documents(owner: str) -> list:
    try:
        data = _vectorstore().get(where=_where(owner), include=["metadatas"])
        return sorted({m["source"] for m in (data.get("metadatas") or []) if m and m.get("source")})
    except Exception as e:
        logger.warning("Error listing documents: %s", e)
        return []


def clear_collection(owner: str) -> int:
    """Removes all of `owner`'s chunks. Returns the number deleted."""
    store = _vectorstore()
    ids = store.get(where=_where(owner), include=[]).get("ids", [])
    if ids:
        store.delete(ids=ids)
    return len(ids)


def is_ready() -> bool:
    try:
        _vectorstore()._collection.count()
        return True
    except Exception:
        return False
