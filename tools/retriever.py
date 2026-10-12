from langchain_core.tools import Tool

from agents.rag_agent import format_context
from rag.vector_store import search


def make_document_retriever(owner: str) -> Tool:
    """A document search tool bound to one user's documents."""

    def search_document(query: str) -> str:
        try:
            docs = [doc for doc, _ in search(owner, query, top_k=4)]
            return format_context(docs) if docs else "No matching content in the user's uploaded documents."
        except Exception as e:
            return f"Document search failed: {e}"

    return Tool(
        name="search_document",
        func=search_document,
        description="Use this to search and retrieve information from the user's uploaded documents.",
    )
