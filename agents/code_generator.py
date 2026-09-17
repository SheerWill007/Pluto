from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from llm_provider.llm_initializer import get_llm_model

def run_code_generator( query, project_context = None , feedback = None, provider = None, model_name = None, api_key = None ):
    model = get_llm_model(provider=provider, model=model_name, api_key=api_key, temperature=0, max_tokens=2048)
    # context = code_context_retriever(query) we are not calling it inside as we use it already in the start of function

    if project_context is not None and feedback is not None:
        human_msg = "Question: {query}\nProject Context: {context}\nFeedback: {feedback}"
    elif project_context is not None:
        human_msg = "Question: {query}\nProject Context: {context}"
    elif feedback is not None:
        human_msg = "Question: {query}\nFeedback: {feedback}"
    else:
        human_msg = "Question: {query}"

    prompt = ChatPromptTemplate.from_messages([
        ("system", """ You are an expert software engineer and coding assistant.
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
        # code here ```
        """),
        ("human" , human_msg)
    ])

    chain = prompt|model|StrOutputParser()
    result = chain.invoke({
        "query" : query,
        "context" : project_context or "None",
        "feedback" : feedback or "None"
    })
    return result