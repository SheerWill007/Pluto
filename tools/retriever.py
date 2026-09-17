from langchain.tools import Tool
from rag.vector_store import get_retriever

def search_document(query):
    try:
        retriever = get_retriever()
        chunks = retriever.invoke(query)
        return ("\n\n".join(chunk.page_content for chunk in chunks))
    except Exception as e:
        return f"Error occurred during extracting documents {e}"


document_retriever = Tool(
    name = "search_document",
    func = search_document,
    description= """ Use this to search and retrieve information from uploaded documents."""
)