"""
Agent Orchestrator: a LangGraph tool-calling loop over web search, code generation,
and (in agent mode) the user's documents and Gmail.

Tools are built per request and closed over the calling user, so a tool can only ever
touch that user's data.
"""

import logging
from typing import Annotated, Iterator, Optional, TypedDict

from langchain_core.messages import AIMessage, AIMessageChunk, ToolMessage
from langchain_core.tools import Tool
from langgraph.errors import GraphRecursionError
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from agents.common import LLMSelection, message_text, track_llm_call
from agents.gmail_agent import run_gmail_agent
from core.security import CurrentUser
from llm_provider.llm_initializer import get_llm_model
from tools.code_pipeline import make_code_tool
from tools.gmail_tools import GmailError
from tools.retriever import make_document_retriever
from tools.web_search import web_search

logger = logging.getLogger(__name__)

# Each agent<->tools round trip uses 2 steps; this allows ~5 tool calls before giving up
RECURSION_LIMIT = 12
LOOP_LIMIT_MESSAGE = (
    "I wasn't able to finish this request within the allowed number of tool calls. "
    "Try rephrasing it or breaking it into smaller steps."
)


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]


def _make_gmail_tool(user: CurrentUser, llm: LLMSelection) -> Tool:
    def gmail_tool(query: str) -> str:
        try:
            return run_gmail_agent(user_id=user.db_id, max_email=5, provider=llm.provider,
                                   model_name=llm.model, api_key=llm.api_key)
        except GmailError as e:
            return str(e)

    return Tool(
        name="gmail_tool",
        func=gmail_tool,
        description="Get recent emails and summarize them from the user's inbox.",
    )


def build_tools(user: CurrentUser, llm: LLMSelection, agent_mode: bool) -> list:
    tools = [web_search, make_code_tool(user.id, llm)]
    if agent_mode:
        tools.append(make_document_retriever(user.id))
        if not user.is_guest:
            tools.append(_make_gmail_tool(user, llm))
    return tools


def build_graph(tools: list, llm: LLMSelection):
    model = get_llm_model(provider=llm.provider, model=llm.model, api_key=llm.api_key,
                          temperature=0.7, max_tokens=2048)
    try:
        model_with_tools = model.bind_tools(tools)
    except NotImplementedError:
        # Some local models (e.g. older Ollama integrations) don't support tool calling
        logger.info("Model does not support tool calling; running without tools")
        model_with_tools, tools = model, []

    def agent(state: AgentState):
        return {"messages": [model_with_tools.invoke(state["messages"])]}

    def should_continue(state: AgentState):
        last = state["messages"][-1]
        return "tools" if getattr(last, "tool_calls", None) else END

    graph = StateGraph(AgentState)
    graph.add_node("agent", agent)
    graph.add_edge(START, "agent")
    if tools:
        graph.add_node("tools", ToolNode(tools))
        graph.add_conditional_edges("agent", should_continue)
        graph.add_edge("tools", "agent")
    else:
        graph.add_edge("agent", END)
    return graph.compile()


def build_messages(user_message: str, context: Optional[dict], system_prompt: Optional[str]) -> list:
    messages = []
    if system_prompt:
        messages.append(("system", system_prompt))
    if context and context.get("remembered_facts"):
        facts_text = "\n".join(context["remembered_facts"])
        messages.append(("system", f"Here are known facts about this user:\n{facts_text}"))
    for msg in (context or {}).get("recent_history", []):
        messages.append(("human" if msg["role"] == "user" else "ai", msg["content"]))
    messages.append(("human", user_message))
    return messages


def run_orchestrator(
    user_message: str,
    user: CurrentUser,
    llm: LLMSelection,
    context: Optional[dict] = None,
    agent_mode: bool = False,
    system_prompt: Optional[str] = None,
) -> str:
    app = build_graph(build_tools(user, llm, agent_mode), llm)
    with track_llm_call("orchestrator", llm.provider):
        try:
            result = app.invoke(
                {"messages": build_messages(user_message, context, system_prompt)},
                config={"recursion_limit": RECURSION_LIMIT},
            )
        except GraphRecursionError:
            return LOOP_LIMIT_MESSAGE
    return message_text(result["messages"][-1].content)


def stream_orchestrator(
    user_message: str,
    user: CurrentUser,
    llm: LLMSelection,
    context: Optional[dict] = None,
    agent_mode: bool = False,
    system_prompt: Optional[str] = None,
) -> Iterator[dict]:
    """
    Yields events as the agent works:
      {"type": "token", "content": str}        -- incremental answer text
      {"type": "tool_start", "tools": [str]}   -- the agent decided to call tools
      {"type": "tool_end", "tools": [str]}     -- tool results returned
      {"type": "done", "content": str}         -- the complete final answer
    """
    app = build_graph(build_tools(user, llm, agent_mode), llm)
    final_text = ""
    with track_llm_call("orchestrator_stream", llm.provider):
        try:
            for mode, payload in app.stream(
                {"messages": build_messages(user_message, context, system_prompt)},
                config={"recursion_limit": RECURSION_LIMIT},
                stream_mode=["messages", "updates"],
            ):
                if mode == "messages":
                    chunk, metadata = payload
                    if metadata.get("langgraph_node") == "agent" and isinstance(chunk, (AIMessageChunk, AIMessage)):
                        text = message_text(chunk.content)
                        if text:
                            yield {"type": "token", "content": text}
                elif mode == "updates":
                    for node, update in (payload or {}).items():
                        messages = (update or {}).get("messages", [])
                        if node == "agent" and messages:
                            last = messages[-1]
                            if getattr(last, "tool_calls", None):
                                yield {"type": "tool_start", "tools": [c["name"] for c in last.tool_calls]}
                            else:
                                final_text = message_text(last.content)
                        elif node == "tools":
                            names = [m.name for m in messages if isinstance(m, ToolMessage)]
                            yield {"type": "tool_end", "tools": names}
        except GraphRecursionError:
            final_text = LOOP_LIMIT_MESSAGE
    yield {"type": "done", "content": final_text}
