from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from llm_provider.llm_initializer import get_llm_model
import json
import re

def run_code_critic(user_request, generated_code, provider = None, model_name = None, api_key = None):
    # Intentionally override model: critic requires the stronger model regardless of caller
    model_name = "openai/gpt-oss-120b"
    print(f"[CRITIC DEBUG] Using model: {model_name}", flush=True)
    model = get_llm_model(provider=provider, model=model_name, api_key=api_key, temperature=0, max_tokens=8192)
    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """
    You are a senior software engineer and code reviewer.
    Your task is to review the generated code and determine whether it:
    1. Contains bugs or logical errors. For EACH function, mentally trace 
       through execution with these specific boundary values and confirm 
       the OUTPUT VALUE is correct (not just that it runs without crashing):
       - Empty inputs (empty list, empty string, empty dict, the number 0)
       - The exact value 0 where relevant to loops, slicing, or indexing
       - Negative numbers where relevant
       - None/null values
       - The maximum boundary (e.g. last valid index, full-length slice)
       - Unhandled exceptions
       - Type mismatches
       IMPORTANT: A function can run without crashing and still return the 
       WRONG value. For each boundary case above, state what the ACTUAL 
       output would be and whether that output is correct given the 
       function's intended behavior — do not just confirm "no exception 
       raised."
    2. Has security vulnerabilities.
    3. Has performance issues.
    4. Violates readability or Python best practices.
    5. Fulfills the user's original request.

    In the "feedback" field, you MUST explicitly state which checklist items were checked and verified, even when approved.

    Respond ONLY with valid JSON.
    Expected format:
    {{
      "approved": true,
      "code": "<original code>",
      "feedback": "<State which checklist items were checked (empty inputs, division by zero, None/null values, off-by-one errors, unhandled exceptions, type mismatches) and findings>"
    }}
    If problems exist:
    {{
      "approved": false,
      "code": "<improved code or original code>",
      "feedback": "<State which checklist items were checked and explain what should be fixed>"
    }}
    Do not return markdown.
    Do not wrap the response inside ```json.
    Do not add any text outside the JSON.
    """
        ),
        (
            "human",
    """
    User request: {user_request}
    Generated code: {generated_code}
    """
        )
    ])
    chain = prompt | model | StrOutputParser()
    raw_response = chain.invoke({
        "user_request": user_request,
        "generated_code" : generated_code,
    })
    clean_response = raw_response.replace("```json", "").replace("```", "").strip()
    match = re.search(r"\{.*\}", clean_response, re.DOTALL)
    if match:
        clean_response = match.group(0)

    try:
        result = json.loads(clean_response)
    except json.JSONDecodeError:
        result = {
            "approved": False,
            "code": generated_code,
            "feedback": "Could not parse critic response"
        }
    return result