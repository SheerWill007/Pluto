from langchain.tools import Tool
from tools.code_context import code_context
from agents.code_generator import run_code_generator
from agents.code_critic import run_code_critic
import logging

logger = logging.getLogger(__name__)

def run_code_pipeline(query : str ) -> str:
    logger.info("CODE PIPELINE STARTED")

    context = code_context.run(query)
    generated_code = run_code_generator(query , project_context=context)

    for attempt in range(3):
        critic_result = run_code_critic(query , generated_code)

        if critic_result["approved"]:
            return generated_code

        if attempt < 2:
            generated_code = run_code_generator(
                query,
                project_context=context,
                feedback=critic_result["feedback"]
            )

    return generated_code

code_tool = Tool(
    name="code_tool",
    func= run_code_pipeline,
    description=(
        " Use this tool when the user asks to write, generate, or create code. "
        "It retrieves relevant project context, generates code, and runs it through "
        "an automated review before returning the final result."
    )
)