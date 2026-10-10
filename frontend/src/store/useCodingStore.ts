import { create } from 'zustand';
import { useAppStore } from './useAppStore';
import { apiFetch, errorMessage } from '../lib/api';
import type { CodeGeneration, CodingSession } from '../lib/types';

const CODING_SESSIONS_KEY = 'pluto_coding_sessions_v1';
const ACTIVE_CODING_SESSION_KEY = 'pluto_active_coding_session_id_v1';
const NEW_TASK_TITLE = 'New Coding Task';
// Code generation (and especially review) can take a while on large models
const CODE_TIMEOUT_MS = 180_000;

const getStorageKeys = () => {
  const user = useAppStore.getState().user;
  const suffix = user?.email ? `_${user.email.trim().toLowerCase()}` : '';
  return {
    codingSessionsKey: `${CODING_SESSIONS_KEY}${suffix}`,
    activeCodingSessionIdKey: `${ACTIVE_CODING_SESSION_KEY}${suffix}`,
  };
};

const generateId = () => crypto.randomUUID();

const newSession = (): CodingSession => ({
  id: generateId(),
  title: NEW_TASK_TITLE,
  context: '',
  generations: [],
  timestamp: Date.now(),
});

const saveToStorage = (sessions: CodingSession[], activeSessionId: string) => {
  const { codingSessionsKey, activeCodingSessionIdKey } = getStorageKeys();
  try {
    localStorage.setItem(codingSessionsKey, JSON.stringify(sessions));
    localStorage.setItem(activeCodingSessionIdKey, activeSessionId);
  } catch (e) {
    console.warn('Could not persist coding sessions:', e);
  }
};

const cleanKey = (apiKey?: string | null) => (apiKey && apiKey.trim() ? apiKey.trim() : null);

interface CodingState {
  sessions: CodingSession[];
  activeSessionId: string;
  isGenerating: boolean;
  isCritiquing: boolean;
  error: string | null;
  initialize: () => void;
  createNewSession: () => string;
  setActiveSessionId: (id: string) => void;
  updateActiveContext: (context: string) => void;
  generateCodeForActiveSession: (promptText: string, provider: string, model: string, apiKey?: string | null,
    feedback?: string | null) => Promise<void>;
  critiqueCodeBlock: (blockId: string, provider: string, model: string, apiKey?: string | null) => Promise<void>;
  deleteSession: (id: string) => void;
  clearActiveSession: () => void;
}

export const useCodingStore = create<CodingState>((set, get) => {
  const updateSession = (sessionId: string, fn: (s: CodingSession) => CodingSession) => {
    const sessions = get().sessions.map((s) => (s.id === sessionId ? fn(s) : s));
    set({ sessions });
    saveToStorage(sessions, get().activeSessionId);
  };

  return {
    sessions: [],
    activeSessionId: '',
    isGenerating: false,
    isCritiquing: false,
    error: null,

    initialize: () => {
      if (!useAppStore.getState().user) {
        set({ sessions: [], activeSessionId: '', error: null });
        return;
      }
      const { codingSessionsKey, activeCodingSessionIdKey } = getStorageKeys();
      let sessions: CodingSession[] = [];
      try {
        sessions = JSON.parse(localStorage.getItem(codingSessionsKey) || '[]');
      } catch {
        sessions = [];
      }
      let activeSessionId = localStorage.getItem(activeCodingSessionIdKey) || '';
      if (!sessions.some((s) => s.id === activeSessionId) && sessions.length > 0) activeSessionId = sessions[0].id;
      if (sessions.length === 0) {
        const fresh = newSession();
        sessions = [fresh];
        activeSessionId = fresh.id;
        saveToStorage(sessions, activeSessionId);
      }
      set({ sessions, activeSessionId });
    },

    createNewSession: () => {
      const session = newSession();
      const sessions = [session, ...get().sessions];
      set({ sessions, activeSessionId: session.id, error: null });
      saveToStorage(sessions, session.id);
      return session.id;
    },

    setActiveSessionId: (id) => {
      set({ activeSessionId: id, error: null });
      try {
        localStorage.setItem(getStorageKeys().activeCodingSessionIdKey, id);
      } catch {
        /* storage unavailable */
      }
    },

    updateActiveContext: (context) => updateSession(get().activeSessionId, (s) => ({ ...s, context })),

    generateCodeForActiveSession: async (promptText, provider, model, apiKey, feedback = null) => {
      const sessionId = get().activeSessionId;
      const session = get().sessions.find((s) => s.id === sessionId);
      if (!session) return;
      set({ isGenerating: true, error: null });
      try {
        const data = await apiFetch<{ code: string }>('/code/generate', {
          json: {
            query: promptText.trim(),
            project_context: session.context || null,
            feedback: feedback || null,
            provider,
            model,
            api_key: cleanKey(apiKey),
          },
          timeoutMs: CODE_TIMEOUT_MS,
        });
        const block: CodeGeneration = {
          id: generateId(),
          prompt: promptText.trim(),
          code: data.code,
          critic: null,
          timestamp: Date.now(),
        };
        // Apply to the session that made the request, even if the user switched tabs meanwhile
        updateSession(sessionId, (s) => ({
          ...s,
          generations: [...s.generations, block],
          title: s.title === NEW_TASK_TITLE
            ? promptText.length > 28 ? `${promptText.substring(0, 25)}...` : promptText
            : s.title,
          timestamp: Date.now(),
        }));
        set({ isGenerating: false });
      } catch (err) {
        set({ error: `Generation failed: ${errorMessage(err)}`, isGenerating: false });
      }
    },

    critiqueCodeBlock: async (blockId, provider, model, apiKey) => {
      const sessionId = get().activeSessionId;
      const block = get().sessions.find((s) => s.id === sessionId)?.generations.find((b) => b.id === blockId);
      if (!block) return;
      set({ isCritiquing: true, error: null });
      try {
        const data = await apiFetch<{ approved: boolean; feedback: string }>('/code/critic', {
          json: { user_request: block.prompt, generated_code: block.code, provider, model, api_key: cleanKey(apiKey) },
          timeoutMs: CODE_TIMEOUT_MS,
        });
        updateSession(sessionId, (s) => ({
          ...s,
          generations: s.generations.map((b) =>
            b.id === blockId
              ? { ...b, critic: { approved: data.approved, feedback: data.feedback, timestamp: Date.now() } }
              : b),
        }));
        set({ isCritiquing: false });
      } catch (err) {
        set({ error: `Critic failed: ${errorMessage(err)}`, isCritiquing: false });
      }
    },

    deleteSession: (id) => {
      const { sessions, activeSessionId } = get();
      let remaining = sessions.filter((s) => s.id !== id);
      if (remaining.length === 0) remaining = [newSession()];
      const nextActive = activeSessionId === id || remaining.length === 1 ? remaining[0].id : activeSessionId;
      set({ sessions: remaining, activeSessionId: nextActive, error: null });
      saveToStorage(remaining, nextActive);
    },

    clearActiveSession: () => {
      updateSession(get().activeSessionId, (s) => ({ ...s, generations: [], context: '', title: NEW_TASK_TITLE }));
      set({ error: null });
    },
  };
});

// Reload sessions whenever the signed-in user changes
let lastUserEmail = useAppStore.getState().user?.email;
useAppStore.subscribe((state) => {
  if (state.user?.email !== lastUserEmail) {
    lastUserEmail = state.user?.email;
    useCodingStore.getState().initialize();
  }
});
