"""
Agent Orchestrator
"""

import logging
from typing import Annotated, TypedDict, Optional, List
from langgraph.graph import StateGraph, END, START
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langchain_core.tools import Tool

# Tools
from tools.retriever import document_retriever
from tools.web_search import web_search
from tools.code_pipeline import code_tool
from agents.gmail_agent import run_gmail_agent
from llm_provider.llm_initializer import get_llm_model

logger = logging.getLogger(__name__)


# Define Gmail tool for the orchestrator
def orchestrator_gmail_tool(query: str) -> str:
    """Useful to search or summarize user emails when asked about Gmail or inbox contents."""
    return run_gmail_agent(max_email=5)


gmail_tool = Tool(
    name="gmail_tool",
    func=orchestrator_gmail_tool,
    description="Get recent emails and summarize them from the user's inbox."
)

# Global tools pool
ALL_TOOLS = {
    "web_search": web_search,
    "code_tool": code_tool,
    "document_retriever": document_retriever,
    "gmail_tool": gmail_tool
}


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    provider: Optional[str]
    model_name: Optional[str]
    agent_mode: Optional[bool]
    api_key: Optional[str]


def orchestrator(state: AgentState):
    provider = state.get("provider")
    model_name = state.get("model_name")
    agent_mode = state.get("agent_mode", False)
    api_key = state.get("api_key")

    # Resolve dynamic LLM with potential key override
    llm = get_llm_model(
        provider=provider,
        model=model_name,
        api_key=api_key,
        temperature=0.7,
        max_tokens=2048
    )

    # Determine which tools are active
    active_tools = [web_search, code_tool]
    if agent_mode:
        active_tools.append(document_retriever)
        active_tools.append(gmail_tool)

    llm_with_tool = llm.bind_tools(active_tools)
    result = llm_with_tool.invoke(state["messages"])
    return {"messages": [result]}


def should_continue(state: AgentState):
    last_msg = state["messages"][-1]
    if hasattr(last_msg, 'tool_calls') and last_msg.tool_calls:
        return "tools"
    return END


def build_graph(agent_mode: bool = False):
    graph = StateGraph(AgentState)

    # We bind all tools to the ToolNode so the graph can execute them
    tools_list = list(ALL_TOOLS.values())
    
    graph.add_node("agent", orchestrator)
    graph.add_node("tools", ToolNode(tools_list))

    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", should_continue)
    graph.add_edge("tools", "agent")

    return graph.compile()


def run_orchestrator(
    user_message: str,
    context: dict = None,
    provider: Optional[str] = None,
    model_name: Optional[str] = None,
    agent_mode: bool = False,
    api_key: Optional[str] = None
) -> str:
    messages = []
    if context and context.get("remembered_facts"):
        facts_text = "\n".join(context["remembered_facts"])
        messages.append(("system", f"Here are known facts about this user:\n{facts_text}"))

    if context and context.get("recent_history"):
        for msg in context["recent_history"]:
            role = "human" if msg["role"] == "user" else "ai"
            messages.append((role, msg["content"]))

    messages.append(("human", user_message))

    app = build_graph(agent_mode=agent_mode)
    
    state_input = {
        "messages": messages,
        "provider": provider,
        "model_name": model_name,
        "agent_mode": agent_mode,
        "api_key": api_key
    }
    
    result = app.invoke(state_input)
    last_message = result["messages"][-1]
    return last_message.content if hasattr(last_message, 'content') else str(last_message)