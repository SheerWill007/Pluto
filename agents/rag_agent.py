"""
RAG Agent with dynamic LLM and embedding support
"""

import logging
from typing import Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from llm_provider.llm_initializer import get_llm_model
from rag.vector_store import get_retriever

logger = logging.getLogger(__name__)


def run_rag_agent(
    query: str,
    top_k: int = 4,
    source: Optional[str] = None,
    provider: Optional[str] = None,
    model_name: Optional[str] = None,
    api_key: Optional[str] = None,
) -> str:
    """
    Execute the RAG agent query using the selected LLM provider and model.
    """
    try:
        model = get_llm_model(
            provider="groq",
            model=model_name,
            api_key=api_key,
            temperature=0,
            max_tokens=2048,
        )

        def format_chunks(chunks):
            return "\n\n".join(chunk.page_content for chunk in chunks)

        retriever = get_retriever(
            top_k=top_k,
            source=source,
            provider=provider,
            api_key=api_key
        )
        docs = retriever.invoke(query)

        if not docs:
            return "No relevant documents found in knowledge base. Please upload documents in Document Ingestion first."

        context = format_chunks(docs)

        prompt_template = ChatPromptTemplate.from_template("""
            Use the following retrieved context from the uploaded documents to answer the question accurately.
            If the context does not contain enough information to answer the question, say "Insufficient context in the provided documents."

            Context:
            {context}

            Question:
            {question}
        """)

        chain = prompt_template | model | StrOutputParser()
        return chain.invoke({"context": context, "question": query})
    except Exception as e:
        logger.error(f"Error in run_rag_agent: {e}", exc_info=True)
        return f"Error occurred while running RAG agent: {e}"
