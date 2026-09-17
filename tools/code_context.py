from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain.tools import Tool
from rag.vector_store import get_retriever
from llm_provider.llm_initializer import get_llm_model

def code_context_retriever(query):
    try:
        model = get_llm_model(temperature=0, max_tokens=2048)

        retriever = get_retriever()
        chunks = retriever.invoke(query)
        context = "\n\n".join(chunk.page_content for chunk in chunks)

        prompt = ChatPromptTemplate.from_template("""
        You are a Code Context Retrieval Agent.
        Your job is NOT to write code.
        Given a user request and the retrieved project documents, identify and return only the information that would help another AI agent generate correct code.

        User Request:{question}
        Context (if provided) :{context}

        Instructions:
        - Analyze the user's request carefully.
        - Extract only the relevant classes, functions, APIs, file names, configuration values, and code snippets related to the request.
        - Ignore unrelated information.
        - Preserve existing naming conventions and project structure.
        - If multiple files are relevant, organize the information by file.
        - Do not summarize away important technical details.
        - Do not generate new code.
        - Do not invent missing information.
        - If no relevant information is found, return:
          "No relevant context found."

        Return the result in the following format:

        Relevant Files:
        - file_name.py
          - Functions:
          - Classes:
          - Important Details:

        Relevant Code Snippets:
        ```python
        # existing code snippets```
       """
       )
        chain = prompt|model|StrOutputParser()
        return chain.invoke({ "question":query , "context":context})
    except Exception as e:
        return f"Error occurred while running search agent {e}"

code_context = Tool(
    name = "code_research",
    func=code_context_retriever,
    description="Use this to retrieve existing project code and structure before generating new code"
)