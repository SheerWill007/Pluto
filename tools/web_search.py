"""
Live web search via the `ddgs` metasearch library.

Single engines are unreliable from cloud hosts: DuckDuckGo often times out from datacenter
IPs and Brave rate-limits them. Engines are therefore tried in groups (each group queried
concurrently by ddgs), and the first group that returns results wins. A fixed region avoids
ddgs's default `wt-wt`, which makes the Wikipedia engine query a non-existent domain.
"""

import logging

from langchain_core.tools import Tool

logger = logging.getLogger(__name__)

ENGINE_GROUPS = (
    "bing, yahoo, yandex",
    "google, duckduckgo, brave, mojeek, wikipedia",
)
REGION = "us-en"
MAX_RESULTS = 5
TIMEOUT_SECONDS = 8


def _format(results: list) -> str:
    lines = []
    for i, r in enumerate(results[:MAX_RESULTS], 1):
        title = (r.get("title") or "").strip()
        url = (r.get("href") or r.get("url") or "").strip()
        body = (r.get("body") or "").strip()
        lines.append(f"{i}. {title}\n   {url}\n   {body}")
    return "\n".join(lines)


def web_searcher(query: str) -> str:
    try:
        from ddgs import DDGS
    except ImportError as e:  # pragma: no cover - dependency is in requirements.txt
        return f"Web search is currently unavailable ({e})."

    last_error = None
    for backend in ENGINE_GROUPS:
        try:
            results = DDGS(timeout=TIMEOUT_SECONDS).text(
                query, region=REGION, max_results=MAX_RESULTS, backend=backend
            )
        except Exception as e:  # ddgs raises when every engine in the group fails or finds nothing
            last_error = e
            logger.info("Web search engines [%s] returned nothing: %s", backend, e)
            continue
        if results:
            return _format(results)

    logger.warning("Web search failed on every engine group: %s", last_error)
    return "Web search is currently unavailable: no search engine returned results. Try rephrasing the query."


web_search = Tool(
    func=web_searcher,
    name="web_search",
    description="Use this when the user asks about current events, recent news, or any topic not found in uploaded documents.",
)
