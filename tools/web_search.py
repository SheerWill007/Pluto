import logging

from langchain_core.tools import Tool

logger = logging.getLogger(__name__)


def web_searcher(query: str) -> str:
    try:
        from langchain_community.tools import DuckDuckGoSearchRun
        return DuckDuckGoSearchRun().run(query)
    except Exception as e:
        logger.warning("Web search failed: %s", e)
        return f"Web search is currently unavailable ({e})."


web_search = Tool(
    func=web_searcher,
    name="web_search",
    description="Use this when the user asks about current events, recent news, or any topic not found in uploaded documents.",
)
