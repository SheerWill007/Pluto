"""Drives the real LangGraph orchestrator with scripted fake chat models."""

import json

from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, AIMessageChunk
from langchain_core.outputs import ChatGenerationChunk

from agents import orchestrator
from agents.common import LLMSelection
from core.security import CurrentUser

USER = CurrentUser("1", "ada@example.com")


class ToolCallingFake(GenericFakeChatModel):
    """
    Fake model that supports bind_tools and replays scripted messages. Unlike the base
    fake, streaming emits tool-call chunks the way real providers do.
    """

    def bind_tools(self, tools, **kwargs):
        return self

    def _stream(self, messages, stop=None, run_manager=None, **kwargs):
        msg = next(self.messages)
        chunk = ChatGenerationChunk(message=AIMessageChunk(
            content=msg.content,
            tool_call_chunks=[{"name": tc["name"], "args": json.dumps(tc["args"]), "id": tc["id"], "index": i}
                              for i, tc in enumerate(msg.tool_calls)],
        ))
        if run_manager:
            run_manager.on_llm_new_token(msg.content, chunk=chunk)
        yield chunk


def _patch_model(monkeypatch, model):
    monkeypatch.setattr(orchestrator, "get_llm_model", lambda **kwargs: model)


def test_plain_answer_without_tool_support(monkeypatch):
    # GenericFakeChatModel has no bind_tools: the graph must fall back to a tool-less run
    _patch_model(monkeypatch, GenericFakeChatModel(messages=iter([AIMessage(content="Hello there")])))
    assert orchestrator.run_orchestrator("hi", USER, LLMSelection()) == "Hello there"


def test_streams_tokens_and_final_answer(monkeypatch):
    _patch_model(monkeypatch, GenericFakeChatModel(messages=iter([AIMessage(content="Hello brave new world")])))
    events = list(orchestrator.stream_orchestrator("hi", USER, LLMSelection()))
    tokens = "".join(e["content"] for e in events if e["type"] == "token")
    assert tokens == "Hello brave new world"
    assert len([e for e in events if e["type"] == "token"]) > 1  # actually incremental
    assert events[-1] == {"type": "done", "content": "Hello brave new world"}


def test_tool_round_trip_is_reported(monkeypatch):
    calls = []
    monkeypatch.setattr(orchestrator.web_search, "func", lambda q: calls.append(q) or "Pluto has 5 moons")
    script = iter([
        AIMessage(content="", tool_calls=[{"name": "web_search", "args": {"__arg1": "pluto moons"},
                                           "id": "call_1", "type": "tool_call"}]),
        AIMessage(content="Pluto has five moons."),
    ])
    _patch_model(monkeypatch, ToolCallingFake(messages=script))

    events = list(orchestrator.stream_orchestrator("how many moons?", USER, LLMSelection()))
    types = [e["type"] for e in events]
    assert calls == ["pluto moons"]
    assert types.index("tool_start") < types.index("tool_end") < len(types) - 1
    assert events[types.index("tool_start")]["tools"] == ["web_search"]
    assert events[-1] == {"type": "done", "content": "Pluto has five moons."}


def test_runaway_tool_loop_is_stopped(monkeypatch):
    monkeypatch.setattr(orchestrator.web_search, "func", lambda q: "more")

    def endless():
        i = 0
        while True:
            i += 1
            yield AIMessage(content="", tool_calls=[{"name": "web_search", "args": {"__arg1": "x"},
                                                     "id": f"c{i}", "type": "tool_call"}])

    _patch_model(monkeypatch, ToolCallingFake(messages=endless()))
    assert orchestrator.run_orchestrator("loop", USER, LLMSelection()) == orchestrator.LOOP_LIMIT_MESSAGE
