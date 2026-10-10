import React, { useState, useRef, useEffect } from 'react';
import { useAppStore, llmFields } from '../../store/useAppStore';
import { useAgentStore } from '../../store/useAgentStore';
import { streamSSE, errorMessage, type SSEEvent } from '../../lib/api';
import { useChatStore } from '../../store/useChatStore';
import MessageBubble from './MessageBubble';
import GlassCard from '../ui/GlassCard';
import { Send, Terminal, Sparkles, ChevronDown, ChevronUp, Radio, Plus, Trash2, MessageSquare } from 'lucide-react';
import { gsap } from 'gsap';
import { clickableProps } from '../../lib/a11y';

// Which topology nodes light up when the orchestrator calls each tool
const TOOL_NODES: Record<string, string[]> = {
  search_document: ['rag_agent', 'chromadb'],
  gmail_tool: ['gmail_agent'],
  code_tool: ['code_generator', 'code_critic'],
  web_search: [],
};

const estimateTokens = (text: string) => Math.round(text.length / 4);

export const ChatPanel = () => {
  const { activeProvider, modelName, ollamaBaseUrl, setOllamaBaseUrl, agentMode, systemPrompt } = useAppStore();
  const { setNodeActive, clearActiveNodes } = useAgentStore();
  const {
    chats,
    activeChatId,
    initialize,
    createNewChat,
    setActiveChatId,
    addMessageToActiveChat,
    updateLastMessage,
    deleteChat,
    updateActiveSystemPrompt,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);

  const threadEndRef = useRef<HTMLDivElement>(null);
  const sendBtnRef = useRef<HTMLButtonElement>(null);
  const activeControllerRef = useRef<AbortController | null>(null);

  const handleCancel = () => {
    activeControllerRef.current?.abort();
    activeControllerRef.current = null;
  };

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Abort any in-flight request when the panel unmounts
  useEffect(() => () => activeControllerRef.current?.abort(), []);

  const activeChat = chats.find((c) => c.id === activeChatId) || chats[0];
  const messages = activeChat ? activeChat.messages : [];
  const activeSystemPrompt = activeChat ? activeChat.systemPrompt : systemPrompt;

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendToOllama = async (userMessage: string, signal: AbortSignal) => {
    const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: modelName,
        messages: [
          ...(activeSystemPrompt ? [{ role: 'system', content: activeSystemPrompt }] : []),
          { role: 'user', content: userMessage },
        ],
        stream: false,
      }),
    });
    if (!response.ok) throw new Error('Ollama connection failed.');
    const data = await response.json();
    return (data.message?.content as string) || 'Empty response.';
  };

  const streamFromBackend = async (userMessage: string, signal: AbortSignal) => {
    let final = '';
    let failure: string | null = null;
    const onEvent = (event: SSEEvent) => {
      switch (event.type) {
        case 'token':
          updateLastMessage((m) => ({ content: m.content + String(event.content ?? '') }), false);
          break;
        case 'tool_start':
          (event.tools as string[]).forEach((tool) => (TOOL_NODES[tool] || []).forEach((n) => setNodeActive(n, true)));
          updateLastMessage((m) => ({ tools: [...new Set([...(m.tools || []), ...(event.tools as string[])])] }), false);
          break;
        case 'done':
          final = String(event.content ?? '');
          break;
        case 'error':
          failure = String(event.detail ?? 'The agent failed to respond.');
          break;
      }
    };
    await streamSSE('/chat/stream', {
      message: userMessage,
      session_id: activeChat.id,
      agent_mode: agentMode,
      system_prompt: activeSystemPrompt || null,
      ...llmFields(),
    }, onEvent, { signal });
    if (failure) throw new Error(failure);
    return final;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !activeChat) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // "Liquid press squish" on the send button
    if (sendBtnRef.current) {
      gsap.timeline()
        .to(sendBtnRef.current, { scaleX: 1.25, scaleY: 0.7, duration: 0.08, ease: 'power1.out' })
        .to(sendBtnRef.current, { scaleX: 0.9, scaleY: 1.15, duration: 0.1, ease: 'power1.inOut' })
        .to(sendBtnRef.current, { scaleX: 1.0, scaleY: 1.0, duration: 0.35, ease: 'elastic.out(1, 0.4)' });
    }

    addMessageToActiveChat({ role: 'user', content: userMessage });
    addMessageToActiveChat({ role: 'assistant', content: '', model: modelName, streaming: true, tools: [] });

    setNodeActive('orchestrator', true);
    setNodeActive(activeProvider, true);

    const controller = new AbortController();
    activeControllerRef.current = controller;
    const t0 = performance.now();

    try {
      const content = activeProvider === 'ollama'
        ? await sendToOllama(userMessage, controller.signal)
        : await streamFromBackend(userMessage, controller.signal);
      updateLastMessage((m) => {
        const text = content || m.content || 'Empty response.';
        return {
          content: text,
          streaming: false,
          tokens: estimateTokens(text),
          latency: parseFloat(((performance.now() - t0) / 1000).toFixed(2)),
        };
      });
    } catch (err) {
      const cancelled = controller.signal.aborted;
      updateLastMessage((m) => ({
        // Keep whatever streamed before a cancel; replace it on a real failure
        content: cancelled ? (m.content ? `${m.content}\n\n_(stopped)_` : '_(stopped)_') : `Error: ${errorMessage(err)}`,
        model: cancelled ? m.model : 'system-error',
        streaming: false,
        tokens: estimateTokens(m.content),
        latency: 0,
      }));
    } finally {
      activeControllerRef.current = null;
      setIsLoading(false);
      setTimeout(() => clearActiveNodes(), 1500);
    }
  };

  if (chats.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-stone-500 dark:text-stone-400 font-sans">
        Loading conversations...
      </div>
    );
  }

  return (
    <div className="flex-1 flex gap-6 h-full min-h-0 overflow-hidden p-6 relative">

      {/* Left Sidebar: Recent Chats */}
      <div className="w-64 shrink-0 flex flex-col gap-4 h-full min-h-0">
        {/* "+ New Chat" Button */}
        <button
          onClick={() => createNewChat(systemPrompt)}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-semibold text-xs tracking-wide transition-all duration-300 shadow-[0_2px_8px_rgba(217,119,6,0.15)] flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Chat</span>
        </button>

        {/* Scrollable list of recent conversations */}
        <GlassCard
          className="flex-grow flex flex-col min-h-0 overflow-hidden"
          contentClassName="flex-1 flex flex-col min-h-0 overflow-hidden p-3"
        >
          <div className="text-[10px] font-bold text-stone-500 dark:text-stone-400 tracking-wider uppercase font-mono mb-2 px-1 shrink-0">
            Recent Conversations
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 min-h-0">
            {chats.map((chat) => (
              <div
                key={chat.id}
                {...clickableProps(() => setActiveChatId(chat.id), { selected: chat.id === activeChatId })}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 border ${chat.id === activeChatId
                    ? 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/20 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 font-medium'
                    : 'hover:bg-white/50 dark:hover:bg-stone-800/50 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 border-transparent'
                  }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <MessageSquare className={`h-4 w-4 shrink-0 ${chat.id === activeChatId ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300'
                    }`} />
                  <span className="text-xs truncate">{chat.title}</span>
                </div>

                {/* Trash Icon for deletion */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(chat.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-stone-100/80 dark:hover:bg-stone-800/80 text-stone-400 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 transition-all duration-150 cursor-pointer"
                  title="Delete conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Right Column: Active Chat Window */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        {/* System Prompt Drawer */}
        <GlassCard className="mb-4 shrink-0 p-4! rounded-xl">
          <button
            onClick={() => setShowSystemPrompt(!showSystemPrompt)}
            className="flex items-center justify-between w-full text-stone-700 dark:text-stone-200 hover:text-stone-900 dark:hover:text-white font-bold text-xs font-sans"
          >
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-beige-600 dark:text-beige-400" />
              <span>SYSTEM PROMPT INSTRUCTIONS</span>
            </div>
            {showSystemPrompt ? <ChevronUp className="h-4 w-4 text-stone-500 dark:text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-500 dark:text-stone-400" />}
          </button>

          {showSystemPrompt && (
            <div className="mt-3">
              <textarea
                value={activeSystemPrompt}
                onChange={(e) => updateActiveSystemPrompt(e.target.value)}
                rows={3}
                className="w-full bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-2.5 text-xs text-stone-800 dark:text-stone-200 font-mono focus:outline-none focus:border-beige-400 dark:focus:border-stone-500"
              />
            </div>
          )}
        </GlassCard>

        {/* Ollama Local URL Configuration */}
        {activeProvider === 'ollama' && (
          <GlassCard className="mb-4 shrink-0 p-3! rounded-xl border-beige-200/50 dark:border-stone-700 bg-beige-150/50 dark:bg-stone-800/50">
            <div className="flex items-center gap-3">
              <Radio className="h-4 w-4 text-beige-600 dark:text-beige-400 animate-pulse" />
              <span className="text-xs font-bold text-beige-700 dark:text-beige-300 font-sans">Ollama Local Connection</span>
              <input
                type="text"
                value={ollamaBaseUrl}
                onChange={(e) => setOllamaBaseUrl(e.target.value)}
                placeholder="e.g. http://localhost:11434"
                className="bg-white dark:bg-stone-800 border border-beige-300/60 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-beige-400 dark:focus:border-stone-500 font-mono flex-1"
              />
            </div>
          </GlassCard>
        )}

        <GlassCard
          className="flex-1 flex flex-col rounded-2xl relative mb-4 overflow-hidden min-h-0"
          contentClassName="flex-grow flex flex-col overflow-hidden p-4 min-h-0"
        >
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 min-h-0">
            {messages.map((msg, index) => (
              <MessageBubble key={index} message={msg} />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500 font-mono pl-2">
                <Sparkles className="h-4 w-4 text-beige-600 dark:text-beige-400 animate-spin" />
                <span>{messages[messages.length - 1]?.content ? 'Streaming response...' : 'Agents thinking...'}</span>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-[11px] font-sans text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 px-2 py-0.5 rounded-md ml-2 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
            <div ref={threadEndRef} />
          </div>
        </GlassCard>

        {/* Input Submit Area */}
        <form onSubmit={handleSend} className="relative flex items-center shrink-0">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask orchestrator a query..."
            className="w-full bg-white/40 dark:bg-stone-800/40 border border-white/50 dark:border-stone-700 backdrop-blur-md rounded-2xl pl-5 pr-14 py-4 text-sm text-stone-800 dark:text-stone-200 focus:outline-none focus:border-beige-400 dark:focus:border-stone-500 shadow-[0_4px_24px_rgba(28,25,23,0.02)] placeholder-stone-400 dark:placeholder-stone-500"
          />
          <button
            ref={sendBtnRef}
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-3 p-2.5 rounded-xl bg-gradient-to-tr from-beige-400 to-beige-600 hover:from-beige-300 hover:to-beige-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-[0_2px_8px_rgba(168,152,120,0.2)]"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;
