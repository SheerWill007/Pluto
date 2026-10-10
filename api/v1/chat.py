"""Conversational orchestrator: blocking and streaming (Server-Sent Events) endpoints."""

import json
import logging
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from agents.orchestrator import run_orchestrator, stream_orchestrator
from api.deps import call_llm, llm_selection
from core.errors import friendly_llm_error
from core.security import CurrentUser, get_current_user
from memory.memory_manager import check_and_save_fact, clear_session, get_context, handle_message
from schemas.request_models import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])

REMEMBERED_PREFIX = "Got it, I'll remember that.\n\n"


def _prepare(request: ChatRequest, user: CurrentUser) -> tuple[str, dict, bool]:
    session_id = request.session_id or str(uuid.uuid4())
    context = get_context(session_id, user.id)
    facts_saved = check_and_save_fact(session_id, request.message, user.id)
    handle_message(session_id, "user", request.message, user.id)
    return session_id, context, facts_saved


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest, user: CurrentUser = Depends(get_current_user)):
    session_id, context, facts_saved = _prepare(request, user)
    response = call_llm(
        run_orchestrator,
        user_message=request.message,
        user=user,
        llm=llm_selection(request),
        context=context,
        agent_mode=bool(request.agent_mode),
        system_prompt=request.system_prompt,
    )
    if facts_saved:
        response = REMEMBERED_PREFIX + response
    handle_message(session_id, "assistant", response, user.id)
    return ChatResponse(response=response, agent_used="orchestrator", session_id=session_id)


def _sse(event: dict) -> str:
    return f"event: {event['type']}\ndata: {json.dumps(event)}\n\n"


@router.post("/chat/stream", responses={200: {"content": {"text/event-stream": {}}}})
def chat_stream(request: ChatRequest, user: CurrentUser = Depends(get_current_user)):
    """
    Streams the answer as Server-Sent Events: `token`, `tool_start`, `tool_end`, then a
    final `done` (full answer) or `error`. The connection always ends with one of those two.
    """
    session_id, context, facts_saved = _prepare(request, user)

    def events():
        yield _sse({"type": "start", "session_id": session_id})
        if facts_saved:
            yield _sse({"type": "token", "content": REMEMBERED_PREFIX})
        try:
            for event in stream_orchestrator(
                user_message=request.message,
                user=user,
                llm=llm_selection(request),
                context=context,
                agent_mode=bool(request.agent_mode),
                system_prompt=request.system_prompt,
            ):
                if event["type"] == "done":
                    final = (REMEMBERED_PREFIX if facts_saved else "") + event["content"]
                    handle_message(session_id, "assistant", final, user.id)
                    yield _sse({"type": "done", "content": final, "session_id": session_id})
                else:
                    yield _sse(event)
        except Exception as e:
            logger.warning("Streaming chat failed: %s", e, exc_info=True)
            yield _sse({"type": "error", "detail": friendly_llm_error(e)})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        # Disable proxy buffering (nginx) so tokens reach the browser immediately
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.delete("/chat/{session_id}/history", status_code=204)
def clear_chat_history(session_id: str, user: CurrentUser = Depends(get_current_user)):
    clear_session(session_id, user.id)
