"""
RAG Agent: answers a question grounded in the caller's own documents.
"""

import logging
from typing import Optional

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from agents.common import track_llm_call
from llm_provider.llm_initializer import get_llm_model
from rag.vector_store import search

logger = logging.getLogger(__name__)

NO_DOCUMENTS = "No relevant documents found in knowledge base. Please upload documents in Document Ingestion first."

PROMPT = ChatPromptTemplate.from_template("""
Use the following retrieved context from the uploaded documents to answer the question accurately.
Cite the source document name in brackets, e.g. [report.pdf], after the facts you use.
If the context does not contain enough information to answer the question, say "Insufficient context in the provided documents."

Context:
{context}

Question:
{question}
""")


def format_context(docs) -> str:
    return "\n\n".join(f"[{d.metadata.get('source', 'unknown')}]\n{d.page_content}" for d in docs)


def answer_from_documents(query: str, docs, provider=None, model_name=None, api_key=None) -> str:
    if not docs:
        return NO_DOCUMENTS
    model = get_llm_model(provider=provider, model=model_name, api_key=api_key, temperature=0, max_tokens=2048)
    chain = PROMPT | model | StrOutputParser()
    with track_llm_call("rag_agent", provider):
        return chain.invoke({"context": format_context(docs), "question": query})


def run_rag_agent(
    query: str,
    owner: str,
    top_k: int = 4,
    source: Optional[str] = None,
    provider: Optional[str] = None,
    model_name: Optional[str] = None,
    api_key: Optional[str] = None,
) -> str:
    docs = [doc for doc, _ in search(owner, query, top_k=top_k, source=source)]
    return answer_from_documents(query, docs, provider=provider, model_name=model_name, api_key=api_key)
