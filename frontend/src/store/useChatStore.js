import { create } from 'zustand';
import { useAppStore } from './useAppStore';

const CHATS_STORAGE_KEY = 'atlas_agent_chats_v1';
const ACTIVE_CHAT_ID_KEY = 'atlas_agent_active_chat_id_v1';

const getStorageKeys = () => {
  const user = useAppStore.getState().user;
  const emailSuffix = user?.email ? `_${user.email.trim().toLowerCase()}` : '';
  return {
    chatsKey: `${CHATS_STORAGE_KEY}${emailSuffix}`,
    activeChatIdKey: `${ACTIVE_CHAT_ID_KEY}${emailSuffix}`
  };
};

const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const DEFAULT_SYSTEM_PROMPT = 'You are an advanced Orchestrator Agent. You have dynamic access to sub-agents (RAG, Gmail) to retrieve knowledge and execute tasks. Be direct, helpful, and concise.';

const saveToStorage = (chats, activeChatId) => {
  const { chatsKey, activeChatIdKey } = getStorageKeys();
  localStorage.setItem(chatsKey, JSON.stringify(chats));
  localStorage.setItem(activeChatIdKey, activeChatId);
};

export const useChatStore = create((set, get) => ({
  chats: [],
  activeChatId: '',

  initialize: () => {
    try {
      const user = useAppStore.getState().user;
      if (!user) {
        set({ chats: [], activeChatId: '' });
        return;
      }

      const { chatsKey, activeChatIdKey } = getStorageKeys();
      const storedChats = localStorage.getItem(chatsKey);
      const storedActiveId = localStorage.getItem(activeChatIdKey);
      
      let chats = storedChats ? JSON.parse(storedChats) : [];
      let activeChatId = storedActiveId || '';

      // Check if activeChatId is valid and exists in chats
      const exists = chats.some(chat => chat.id === activeChatId);
      if (!exists && chats.length > 0) {
        activeChatId = chats[0].id;
      }

      if (chats.length === 0) {
        // Create initial default chat
        const defaultChat = {
          id: generateId(),
          title: 'New Conversation',
          messages: [
            {
              role: 'assistant',
              content: "Hello! I am the Atlas Agent Orchestrator. Switch to 'Agent Mode' to let me call RAG knowledge search and Gmail tools dynamically to solve your queries.",
              model: 'system',
              tokens: 28,
              latency: 0.05
            }
          ],
          systemPrompt: DEFAULT_SYSTEM_PROMPT,
          timestamp: Date.now()
        };
        chats = [defaultChat];
        activeChatId = defaultChat.id;
        saveToStorage(chats, activeChatId);
      }

      set({ chats, activeChatId });
    } catch (e) {
      console.error('Failed to load chats from storage:', e);
    }
  },

  createNewChat: (systemPrompt = DEFAULT_SYSTEM_PROMPT) => {
    const newChat = {
      id: generateId(),
      title: 'New Conversation',
      messages: [
        {
          role: 'assistant',
          content: "Hello! I am the Atlas Agent Orchestrator. Switch to 'Agent Mode' to let me call RAG knowledge search and Gmail tools dynamically to solve your queries.",
          model: 'system',
          tokens: 28,
          latency: 0.05
        }
      ],
      systemPrompt,
      timestamp: Date.now()
    };

    const updatedChats = [newChat, ...get().chats];
    set({ chats: updatedChats, activeChatId: newChat.id });
    saveToStorage(updatedChats, newChat.id);
    return newChat.id;
  },

  setActiveChatId: (id) => {
    set({ activeChatId: id });
    const { activeChatIdKey } = getStorageKeys();
    localStorage.setItem(activeChatIdKey, id);
  },

  addMessageToActiveChat: (message) => {
    const { chats, activeChatId } = get();
    const updatedChats = chats.map(chat => {
      if (chat.id === activeChatId) {
        const newMessages = [...chat.messages, message];
        let newTitle = chat.title;
        
        // If this is the first user message, generate a title from it
        if (chat.title === 'New Conversation' && message.role === 'user') {
          newTitle = message.content.length > 28 
            ? message.content.substring(0, 25) + '...' 
            : message.content;
        }

        return {
          ...chat,
          messages: newMessages,
          title: newTitle,
          timestamp: Date.now()
        };
      }
      return chat;
    });

    set({ chats: updatedChats });
    saveToStorage(updatedChats, activeChatId);
  },

  deleteChat: (id) => {
    const { chats, activeChatId } = get();
    const filteredChats = chats.filter(chat => chat.id !== id);
    let newActiveId = activeChatId;

    if (filteredChats.length === 0) {
      // If no chats left, create a fresh one
      const freshChat = {
        id: generateId(),
        title: 'New Conversation',
        messages: [
          {
            role: 'assistant',
            content: "Hello! I am the Atlas Agent Orchestrator. Switch to 'Agent Mode' to let me call RAG knowledge search and Gmail tools dynamically to solve your queries.",
            model: 'system',
            tokens: 28,
            latency: 0.05
          }
        ],
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        timestamp: Date.now()
      };
      const chatsList = [freshChat];
      set({ chats: chatsList, activeChatId: freshChat.id });
      saveToStorage(chatsList, freshChat.id);
    } else {
      if (activeChatId === id) {
        // If we deleted the active chat, switch to the most recent remaining one
        newActiveId = filteredChats[0].id;
      }
      set({ chats: filteredChats, activeChatId: newActiveId });
      saveToStorage(filteredChats, newActiveId);
    }
  },

  updateActiveSystemPrompt: (prompt) => {
    const { chats, activeChatId } = get();
    const updatedChats = chats.map(chat => {
      if (chat.id === activeChatId) {
        return {
          ...chat,
          systemPrompt: prompt
        };
      }
      return chat;
    });
    set({ chats: updatedChats });
    saveToStorage(updatedChats, activeChatId);
  }
}));

// Subscribe to user changes to dynamically reload user's chats
let lastUserEmail = useAppStore.getState().user?.email;
useAppStore.subscribe((state) => {
  const currentUserEmail = state.user?.email;
  if (currentUserEmail !== lastUserEmail) {
    lastUserEmail = currentUserEmail;
    useChatStore.getState().initialize();
  }
});
