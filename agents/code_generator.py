from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from agents.common import track_llm_call
from llm_provider.llm_initializer import get_llm_model

SYSTEM_PROMPT = """You are an expert software engineer and coding assistant.
Instructions:
- Carefully understand the user's request.
- Use the provided project context when it is relevant.
- Do not invent functions, classes, or APIs that are not present in the context.
- Generate clean, efficient, and production-quality code.
- Follow Python best practices and PEP 8 conventions.
- Add comments only when they improve readability.
- Preserve existing project structure and naming conventions.
- If modifying existing code, return only the changed code.
- If the request is ambiguous, make reasonable assumptions and state them briefly.
- Ensure the code is syntactically correct.

Return the answer in the following format:

Code:
```python
# code here
```
"""


def run_code_generator(query, project_context=None, feedback=None, provider=None, model_name=None, api_key=None):
    model = get_llm_model(provider=provider, model=model_name, api_key=api_key, temperature=0, max_tokens=4096)

    human_msg = "Question: {query}"
    if project_context:
        human_msg += "\nProject Context: {context}"
    if feedback:
        human_msg += "\nFeedback: {feedback}"

    prompt = ChatPromptTemplate.from_messages([("system", SYSTEM_PROMPT), ("human", human_msg)])
    chain = prompt | model | StrOutputParser()
    with track_llm_call("code_generator", provider):
        return chain.invoke({
            "query": query,
            "context": project_context or "None",
            "feedback": feedback or "None",
        })
