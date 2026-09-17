import { create } from 'zustand';
import { useAppStore } from './useAppStore';
import { API_URL } from '../lib/api';

const CODING_SESSIONS_KEY = 'pluto_coding_sessions_v1';
const ACTIVE_CODING_SESSION_KEY = 'pluto_active_coding_session_id_v1';

const getStorageKeys = () => {
  const user = useAppStore.getState().user;
  const emailSuffix = user?.email ? `_${user.email.trim().toLowerCase()}` : '';
  return {
    codingSessionsKey: `${CODING_SESSIONS_KEY}${emailSuffix}`,
    activeCodingSessionIdKey: `${ACTIVE_CODING_SESSION_KEY}${emailSuffix}`
  };
};

const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const saveToStorage = (sessions, activeSessionId) => {
  const { codingSessionsKey, activeCodingSessionIdKey } = getStorageKeys();
  localStorage.setItem(codingSessionsKey, JSON.stringify(sessions));
  localStorage.setItem(activeCodingSessionIdKey, activeSessionId);
};

export const useCodingStore = create((set, get) => ({
  sessions: [],
  activeSessionId: '',
  isGenerating: false,
  isCritiquing: false,
  error: null,

  initialize: () => {
    try {
      const user = useAppStore.getState().user;
      if (!user) {
        set({ sessions: [], activeSessionId: '', error: null });
        return;
      }

      const { codingSessionsKey, activeCodingSessionIdKey } = getStorageKeys();
      const storedSessions = localStorage.getItem(codingSessionsKey);
      const storedActiveId = localStorage.getItem(activeCodingSessionIdKey);
      
      let sessions = storedSessions ? JSON.parse(storedSessions) : [];
      let activeSessionId = storedActiveId || '';

      const exists = sessions.some(s => s.id === activeSessionId);
      if (!exists && sessions.length > 0) {
        activeSessionId = sessions[0].id;
      }

      if (sessions.length === 0) {
        const defaultSession = {
          id: generateId(),
          title: 'New Coding Task',
          context: '',
          generations: [],
          timestamp: Date.now()
        };
        sessions = [defaultSession];
        activeSessionId = defaultSession.id;
        saveToStorage(sessions, activeSessionId);
      }

      set({ sessions, activeSessionId });
    } catch (e) {
      console.error('Failed to load coding sessions:', e);
    }
  },

  createNewSession: () => {
    const newSession = {
      id: generateId(),
      title: 'New Coding Task',
      context: '',
      generations: [],
      timestamp: Date.now()
    };

    const updatedSessions = [newSession, ...get().sessions];
    set({ sessions: updatedSessions, activeSessionId: newSession.id, error: null });
    saveToStorage(updatedSessions, newSession.id);
    return newSession.id;
  },

  setActiveSessionId: (id) => {
    set({ activeSessionId: id, error: null });
    const { activeCodingSessionIdKey } = getStorageKeys();
    localStorage.setItem(activeCodingSessionIdKey, id);
  },

  updateActiveContext: (context) => {
    const { sessions, activeSessionId } = get();
    const updatedSessions = sessions.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, context };
      }
      return s;
    });
    set({ sessions: updatedSessions });
    saveToStorage(updatedSessions, activeSessionId);
  },

  generateCodeForActiveSession: async (promptText, provider, model, apiKey, feedback = null) => {
    const { sessions, activeSessionId } = get();
    const activeSession = sessions.find(s => s.id === activeSessionId);
    if (!activeSession) return;

    set({ isGenerating: true, error: null });

    try {
      const response = await fetch(`${API_URL}/api/v1/code/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: promptText.trim(),
          project_context: activeSession.context || null,
          feedback: feedback || null,
          provider,
          model,
          api_key: (apiKey && apiKey.trim()) ? apiKey.trim() : null
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Code generation failed.');
      }
      const data = await response.json();

      const newBlock = {
        id: generateId(),
        prompt: promptText.trim(),
        code: data.code,
        critic: null,
        timestamp: Date.now()
      };

      const updatedSessions = sessions.map(s => {
        if (s.id === activeSessionId) {
          const newGenerations = [...s.generations, newBlock];
          let newTitle = s.title;
          
          if (s.title === 'New Coding Task') {
            newTitle = promptText.length > 28 
              ? promptText.substring(0, 25) + '...' 
              : promptText;
          }

          return {
            ...s,
            generations: newGenerations,
            title: newTitle,
            timestamp: Date.now()
          };
        }
        return s;
      });

      set({ sessions: updatedSessions, isGenerating: false });
      saveToStorage(updatedSessions, activeSessionId);
    } catch (err) {
      console.error(err);
      set({ error: `Generation failed: ${err.message}`, isGenerating: false });
    }
  },

  critiqueCodeBlock: async (blockId, provider, model, apiKey) => {
    const { sessions, activeSessionId } = get();
    const activeSession = sessions.find(s => s.id === activeSessionId);
    if (!activeSession) return;

    const blockIndex = activeSession.generations.findIndex(b => b.id === blockId);
    if (blockIndex === -1) return;
    
    const block = activeSession.generations[blockIndex];

    set({ isCritiquing: true, error: null });

    try {
      const response = await fetch(`${API_URL}/api/v1/code/critic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_request: block.prompt,
          generated_code: block.code,
          provider,
          model,
          api_key: (apiKey && apiKey.trim()) ? apiKey.trim() : null
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Critic review failed.');
      }
      const data = await response.json();

      const updatedSessions = sessions.map(s => {
        if (s.id === activeSessionId) {
          const newGenerations = s.generations.map(b => {
            if (b.id === blockId) {
              return {
                ...b,
                critic: {
                  approved: data.approved,
                  feedback: data.feedback,
                  timestamp: Date.now()
                }
              };
            }
            return b;
          });
          return { ...s, generations: newGenerations };
        }
        return s;
      });

      set({ sessions: updatedSessions, isCritiquing: false });
      saveToStorage(updatedSessions, activeSessionId);
    } catch (err) {
      console.error(err);
      set({ error: `Critic failed: ${err.message}`, isCritiquing: false });
    }
  },

  deleteSession: (id) => {
    const { sessions, activeSessionId } = get();
    const filteredSessions = sessions.filter(s => s.id !== id);
    let newActiveId = activeSessionId;

    if (filteredSessions.length === 0) {
      const freshSession = {
        id: generateId(),
        title: 'New Coding Task',
        context: '',
        generations: [],
        timestamp: Date.now()
      };
      const sessionsList = [freshSession];
      set({ sessions: sessionsList, activeSessionId: freshSession.id, error: null });
      saveToStorage(sessionsList, freshSession.id);
    } else {
      if (activeSessionId === id) {
        newActiveId = filteredSessions[0].id;
      }
      set({ sessions: filteredSessions, activeSessionId: newActiveId, error: null });
      saveToStorage(filteredSessions, newActiveId);
    }
  },

  clearActiveSession: () => {
    const { sessions, activeSessionId } = get();
    const updatedSessions = sessions.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          generations: [],
          context: '',
          title: 'New Coding Task'
        };
      }
      return s;
    });
    set({ sessions: updatedSessions, error: null });
    saveToStorage(updatedSessions, activeSessionId);
  }
}));

// Subscribe to user changes to dynamically reload user's coding sessions
let lastUserEmail = useAppStore.getState().user?.email;
useAppStore.subscribe((state) => {
  const currentUserEmail = state.user?.email;
  if (currentUserEmail !== lastUserEmail) {
    lastUserEmail = currentUserEmail;
    useCodingStore.getState().initialize();
  }
});
