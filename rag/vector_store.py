import logging
from typing import Optional
from langchain_community.vectorstores import Chroma
from rag.embeddings import get_embeddings, get_embedding_provider_tag
from config.settings import settings

logger = logging.getLogger(__name__)


def get_collection_name(provider: Optional[str] = None, api_key: Optional[str] = None) -> str:
    tag = get_embedding_provider_tag(provider=provider, api_key=api_key)
    base_name = settings.CHROMA_COLLECTION_NAME or "documents"
    return f"{base_name}_{tag}"


def add_documents(chunks, provider: Optional[str] = None, api_key: Optional[str] = None):
    """
    Index document chunks into ChromaDB under the collection matching the active embedding model.
    """
    if not chunks:
        logger.warning("No chunks provided to add_documents.")
        return

    embedding = get_embeddings(provider=provider, api_key=api_key)
    col_name = get_collection_name(provider=provider, api_key=api_key)
    
    logger.info(f"Adding {len(chunks)} chunks to collection '{col_name}' in '{settings.CHROMA_PERSIST_DIR}'")
    Chroma.from_documents(
        documents=chunks,
        embedding=embedding,
        collection_name=col_name,
        persist_directory=settings.CHROMA_PERSIST_DIR
    )


def get_retriever(
    top_k: int = 4,
    source: Optional[str] = None,
    provider: Optional[str] = None,
    api_key: Optional[str] = None
):
    """
    Return a Chroma retriever targeting the active embedding model's collection.
    If source is provided, scopes retrieval to chunks matching that source metadata.
    """
    embedding = get_embeddings(provider=provider, api_key=api_key)
    col_name = get_collection_name(provider=provider, api_key=api_key)

    vectorstore = Chroma(
        embedding_function=embedding,
        collection_name=col_name,
        persist_directory=settings.CHROMA_PERSIST_DIR
    )

    search_kwargs = {"k": top_k}
    if source and source.strip() and source.strip().lower() != "all":
        search_kwargs["filter"] = {"source": source.strip()}

    return vectorstore.as_retriever(search_kwargs=search_kwargs)


def delete_documents_by_source(
    source: str,
    provider: Optional[str] = None,
    api_key: Optional[str] = None
) -> int:
    """
    Deletes all existing chunks for a specific document filename/source from the collection.
    Returns the count of deleted chunks.
    """
    if not source:
        return 0

    try:
        embedding = get_embeddings(provider=provider, api_key=api_key)
        col_name = get_collection_name(provider=provider, api_key=api_key)
        vectorstore = Chroma(
            embedding_function=embedding,
            collection_name=col_name,
            persist_directory=settings.CHROMA_PERSIST_DIR
        )
        data = vectorstore.get(where={"source": source.strip()}, include=["metadatas"])
        ids = data.get("ids", [])
        if ids:
            vectorstore.delete(ids=ids)
            logger.info(f"Deleted {len(ids)} existing chunks for source '{source}' in collection '{col_name}'.")
        return len(ids)
    except Exception as e:
        logger.warning(f"Error deleting documents for source '{source}': {e}")
        return 0


def list_documents(
    provider: Optional[str] = None,
    api_key: Optional[str] = None
) -> list:
    """
    Returns a sorted list of unique document filenames/sources currently in the collection.
    """
    try:
        embedding = get_embeddings(provider=provider, api_key=api_key)
        col_name = get_collection_name(provider=provider, api_key=api_key)
        vectorstore = Chroma(
            embedding_function=embedding,
            collection_name=col_name,
            persist_directory=settings.CHROMA_PERSIST_DIR
        )
        data = vectorstore.get(include=["metadatas"])
        sources = set()
        for meta in (data.get("metadatas") or []):
            if meta and meta.get("source"):
                sources.add(meta["source"])
        return sorted(list(sources))
    except Exception as e:
        logger.warning(f"Error listing documents from collection: {e}")
        return []


def clear_collection(
    provider: Optional[str] = None,
    api_key: Optional[str] = None
) -> bool:
    """
    Wipes all chunks in the active Chroma collection for a fresh start.
    """
    try:
        embedding = get_embeddings(provider=provider, api_key=api_key)
        col_name = get_collection_name(provider=provider, api_key=api_key)
        vectorstore = Chroma(
            embedding_function=embedding,
            collection_name=col_name,
            persist_directory=settings.CHROMA_PERSIST_DIR
        )
        data = vectorstore.get(include=[])
        ids = data.get("ids", [])
        if ids:
            vectorstore.delete(ids=ids)
            logger.info(f"Cleared {len(ids)} chunks from collection '{col_name}'.")
        return True
    except Exception as e:
        logger.error(f"Error clearing collection: {e}")
        return False