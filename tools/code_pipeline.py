import logging

from langchain_core.tools import Tool

from agents.code_critic import run_code_critic
from agents.code_generator import run_code_generator
from agents.common import LLMSelection
from tools.code_context import code_context_retriever

logger = logging.getLogger(__name__)

MAX_REVIEW_ROUNDS = 3


def run_code_pipeline(query: str, owner: str, llm: LLMSelection = LLMSelection()) -> str:
    """Retrieve context -> generate -> critic review, regenerating with feedback until approved."""
    llm_kwargs = dict(provider=llm.provider, model_name=llm.model, api_key=llm.api_key)
    try:
        context = code_context_retriever(query, owner, llm)
    except Exception as e:
        logger.warning("Code context retrieval failed, continuing without it: %s", e)
        context = None

    generated_code = run_code_generator(query, project_context=context, **llm_kwargs)
    for attempt in range(MAX_REVIEW_ROUNDS):
        critic_result = run_code_critic(query, generated_code, **llm_kwargs)
        if critic_result["approved"]:
            logger.info("Code pipeline approved after %d review round(s)", attempt + 1)
            return generated_code
        if attempt < MAX_REVIEW_ROUNDS - 1:
            generated_code = run_code_generator(
                query, project_context=context, feedback=critic_result["feedback"], **llm_kwargs
            )
    logger.info("Code pipeline returning unapproved code after %d rounds", MAX_REVIEW_ROUNDS)
    return generated_code


def make_code_tool(owner: str, llm: LLMSelection) -> Tool:
    return Tool(
        name="code_tool",
        func=lambda query: run_code_pipeline(query, owner, llm),
        description=(
            "Use this tool when the user asks to write, generate, or create code. "
            "It retrieves relevant project context, generates code, and runs it through "
            "an automated review before returning the final result."
        ),
    )
