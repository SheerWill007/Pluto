import { create } from 'zustand';
import { useAppStore } from './useAppStore';
import type { Chat, ChatMessage } from '../lib/types';

const CHATS_STORAGE_KEY = 'pluto_agent_chats_v1';
const ACTIVE_CHAT_ID_KEY = 'pluto_agent_active_chat_id_v1';
const NEW_CHAT_TITLE = 'New Conversation';
// Keep localStorage bounded (browsers cap it around 5 MB per origin)
const MAX_STORED_CHATS = 50;

const DEFAULT_SYSTEM_PROMPT =
  'You are an advanced Orchestrator Agent. You have dynamic access to sub-agents (RAG, Gmail) to retrieve knowledge and execute tasks. Be direct, helpful, and concise.';

const WELCOME: ChatMessage = {
  role: 'assistant',
  content:
    "Hello! I am the Pluto Agent Orchestrator. Switch to 'Agent Mode' to let me call RAG knowledge search and Gmail tools dynamically to solve your queries.",
  model: 'system',
  tokens: 28,
  latency: 0.05,
};

const getStorageKeys = () => {
  // Scope by account so users sharing a browser never see each other's chats. (Keyed by
  // email rather than ID to stay compatible with chats saved by earlier versions.)
  const user = useAppStore.getState().user;
  const suffix = user?.email ? `_${user.email.trim().toLowerCase()}` : '';
  return { chatsKey: `${CHATS_STORAGE_KEY}${suffix}`, activeChatIdKey: `${ACTIVE_CHAT_ID_KEY}${suffix}` };
};

const generateId = () => crypto.randomUUID();

const newChat = (systemPrompt = DEFAULT_SYSTEM_PROMPT): Chat => ({
  id: generateId(),
  title: NEW_CHAT_TITLE,
  messages: [WELCOME],
  systemPrompt,
  timestamp: Date.now(),
});

const saveToStorage = (chats: Chat[], activeChatId: string) => {
  const { chatsKey, activeChatIdKey } = getStorageKeys();
  try {
    // Never persist half-streamed messages
    const persistable = chats.slice(0, MAX_STORED_CHATS).map((c) => ({
      ...c,
      messages: c.messages.map(({ streaming, ...m }) => m),
    }));
    localStorage.setItem(chatsKey, JSON.stringify(persistable));
    localStorage.setItem(activeChatIdKey, activeChatId);
  } catch (e) {
    console.warn('Could not persist chats:', e);
  }
};

interface ChatState {
  chats: Chat[];
  activeChatId: string;
  initialize: () => void;
  createNewChat: (systemPrompt?: string) => string;
  setActiveChatId: (id: string) => void;
  addMessageToActiveChat: (message: ChatMessage) => void;
  /** Patch the last message of the active chat (used while streaming). */
  updateLastMessage: (patch: Partial<ChatMessage> | ((m: ChatMessage) => Partial<ChatMessage>), persist?: boolean) => void;
  deleteChat: (id: string) => void;
  updateActiveSystemPrompt: (prompt: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => {
  const updateActive = (fn: (chat: Chat) => Chat, persist = true) => {
    const { chats, activeChatId } = get();
    const updated = chats.map((c) => (c.id === activeChatId ? fn(c) : c));
    set({ chats: updated });
    if (persist) saveToStorage(updated, activeChatId);
  };

  return {
    chats: [],
    activeChatId: '',

    initialize: () => {
      if (!useAppStore.getState().user) {
        set({ chats: [], activeChatId: '' });
        return;
      }
      const { chatsKey, activeChatIdKey } = getStorageKeys();
      let chats: Chat[] = [];
      try {
        chats = JSON.parse(localStorage.getItem(chatsKey) || '[]');
      } catch {
        chats = [];
      }
      let activeChatId = localStorage.getItem(activeChatIdKey) || '';
      if (!chats.some((c) => c.id === activeChatId) && chats.length > 0) activeChatId = chats[0].id;
      if (chats.length === 0) {
        const fresh = newChat();
        chats = [fresh];
        activeChatId = fresh.id;
        saveToStorage(chats, activeChatId);
      }
      set({ chats, activeChatId });
    },

    createNewChat: (systemPrompt = DEFAULT_SYSTEM_PROMPT) => {
      const chat = newChat(systemPrompt);
      const chats = [chat, ...get().chats];
      set({ chats, activeChatId: chat.id });
      saveToStorage(chats, chat.id);
      return chat.id;
    },

    setActiveChatId: (id) => {
      set({ activeChatId: id });
      try {
        localStorage.setItem(getStorageKeys().activeChatIdKey, id);
      } catch {
        /* storage unavailable */
      }
    },

    addMessageToActiveChat: (message) =>
      updateActive((chat) => ({
        ...chat,
        messages: [...chat.messages, message],
        // Title the conversation from its first user message
        title:
          chat.title === NEW_CHAT_TITLE && message.role === 'user'
            ? message.content.length > 28 ? `${message.content.substring(0, 25)}...` : message.content
            : chat.title,
        timestamp: Date.now(),
      })),

    updateLastMessage: (patch, persist = true) =>
      updateActive((chat) => {
        if (chat.messages.length === 0) return chat;
        const messages = [...chat.messages];
        const last = messages[messages.length - 1];
        messages[messages.length - 1] = { ...last, ...(typeof patch === 'function' ? patch(last) : patch) };
        return { ...chat, messages };
      }, persist),

    deleteChat: (id) => {
      const { chats, activeChatId } = get();
      let remaining = chats.filter((c) => c.id !== id);
      if (remaining.length === 0) remaining = [newChat()];
      const nextActive = activeChatId === id || remaining.length === 1 ? remaining[0].id : activeChatId;
      set({ chats: remaining, activeChatId: nextActive });
      saveToStorage(remaining, nextActive);
    },

    updateActiveSystemPrompt: (prompt) => updateActive((chat) => ({ ...chat, systemPrompt: prompt })),
  };
});

// Reload chats whenever the signed-in user changes
let lastUserEmail = useAppStore.getState().user?.email;
useAppStore.subscribe((state) => {
  if (state.user?.email !== lastUserEmail) {
    lastUserEmail = state.user?.email;
    useChatStore.getState().initialize();
  }
});
