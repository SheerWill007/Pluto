from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from agents.common import LLMSelection, track_llm_call
from llm_provider.llm_initializer import get_llm_model
from rag.vector_store import search

PROMPT = ChatPromptTemplate.from_template("""
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
# existing code snippets
```
""")


def code_context_retriever(query: str, owner: str, llm: LLMSelection = LLMSelection()) -> str:
    docs = [doc for doc, _ in search(owner, query, top_k=4)]
    if not docs:
        # Nothing uploaded: skip an LLM round trip that could only answer "no context"
        return "No relevant context found."
    model = get_llm_model(provider=llm.provider, model=llm.model, api_key=llm.api_key, temperature=0, max_tokens=2048)
    chain = PROMPT | model | StrOutputParser()
    with track_llm_call("code_context", llm.provider):
        return chain.invoke({"question": query, "context": "\n\n".join(d.page_content for d in docs)})
