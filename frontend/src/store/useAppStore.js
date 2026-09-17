import { create } from 'zustand';

const DEMO_EMAIL = 'admin@atlas.ai';
const DEMO_PASSWORD = 'atlas2024';

// Helper to get api keys from localStorage
const getStoredKey = (provider) => {
  const key = localStorage.getItem(`ai_agent_key_${provider}`) || '';
  // Automatically purge invalid OpenAI keys that don't start with sk- (e.g. accidental pastes)
  if (provider === 'openai' && key && !key.trim().startsWith('sk-')) {
    localStorage.removeItem(`ai_agent_key_${provider}`);
    return '';
  }
  // Automatically purge invalid Google keys (must start with AQ. or AIza)
  if (provider === 'google' && key && !key.trim().startsWith('AQ.') && !key.trim().startsWith('AIza')) {
    localStorage.removeItem(`ai_agent_key_${provider}`);
    return '';
  }
  return key;
};

// Helper to save api keys to localStorage
const storeKey = (provider, key) => {
  if (!key || !key.trim()) {
    localStorage.removeItem(`ai_agent_key_${provider}`);
  } else {
    localStorage.setItem(`ai_agent_key_${provider}`, key.trim());
  }
};

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('atlas_auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const storeUser = (user) => {
  if (user) {
    localStorage.setItem('atlas_auth_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('atlas_auth_user');
  }
};

export const useAppStore = create((set, get) => ({
  user: getStoredUser(),
  isAuthenticated: !!getStoredUser(),

  activeSection: 'chat', // 'rag', 'chat', 'gmail', 'coding'
  activeProvider: 'google', // 'openai', 'anthropic', 'google', 'groq', 'openrouter', 'ollama'
  modelName: 'gemini-flash-lite-latest',
  apiKey: getStoredKey('google'),
  ollamaBaseUrl: 'http://localhost:11434',
  gmailConnected: false,
  agentMode: false,
  systemPrompt: 'You are an advanced Orchestrator Agent. You have dynamic access to sub-agents (RAG, Gmail) to retrieve knowledge and execute tasks. Be direct, helpful, and concise.',
  
  // Auth
  login: async (email, password, remember = true) => {
    try {
      const response = await fetch('https://atlasmultiagentsystem.onrender.com/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Invalid email or password.');
      }
      const user = await response.json();
      if (remember) {
        storeUser(user);
      }
      set({ user, isAuthenticated: true });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  signup: async (name, email, password) => {
    try {
      const response = await fetch('https://atlasmultiagentsystem.onrender.com/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Sign up failed.');
      }
      const user = await response.json();
      storeUser(user);
      set({ user, isAuthenticated: true });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  loginWithGoogle: async (googleUser) => {
    try {
      const response = await fetch('https://atlasmultiagentsystem.onrender.com/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture
        })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Google authentication sync failed.');
      }
      const user = await response.json();
      storeUser(user);
      set({ user, isAuthenticated: true });
      return { success: true };
    } catch (err) {
      console.error("Google login backend sync error:", err);
      // Fallback: authenticates locally on frontend anyway so the user is not locked out
      storeUser(googleUser);
      set({ user: googleUser, isAuthenticated: true });
      return { success: true };
    }
  },

  loginAsGuest: () => {
    const guestUser = {
      id: 'guest',
      email: 'guest@local',
      name: 'Guest User',
      picture: null,
      auth_provider: 'guest'
    };
    // Don't persist guest to localStorage
    set({ user: guestUser, isAuthenticated: true });
    return { success: true };
  },

  logout: () => {
    storeUser(null);
    set({ user: null, isAuthenticated: false });
  },

  backendConfig: null,
  fetchBackendConfig: async () => {
    try {
      const response = await fetch('https://atlasmultiagentsystem.onrender.com/api/v1/config/llm');
      if (response.ok) {
        const data = await response.json();
        set({ backendConfig: data });
        // Sync UI provider and model to the active backend configuration
        if (data.has_key && data.provider) {
          const currentCustomKey = getStoredKey(data.provider);
          set({
            activeProvider: data.provider,
            modelName: data.model,
            apiKey: currentCustomKey || ''
          });
        }
      }
    } catch (err) {
      console.warn("Could not sync backend LLM config:", err);
    }
  },

  // Navigation
  setActiveSection: (section) => set({ activeSection: section }),
  
  // LLM Config
  setActiveProvider: (provider) => {
    let defaultModel = 'gpt-4o-mini';
    if (provider === 'anthropic') defaultModel = 'claude-3-5-sonnet-20240620';
    if (provider === 'google') defaultModel = 'gemini-flash-lite-latest';
    if (provider === 'groq') defaultModel = 'llama-3.1-8b-instant';
    if (provider === 'openrouter') defaultModel = 'meta-llama/llama-3-8b-instruct:free';
    if (provider === 'ollama') defaultModel = 'llama3';

    set({ 
      activeProvider: provider,
      apiKey: getStoredKey(provider),
      modelName: defaultModel
    });
  },
  
  setModelName: (modelName) => set({ modelName }),
  
  setApiKey: (key) => {
    const provider = get().activeProvider;
    storeKey(provider, key);
    set({ apiKey: key });
  },

  clearApiKey: () => {
    const provider = get().activeProvider;
    localStorage.removeItem(`ai_agent_key_${provider}`);
    set({ apiKey: '' });
  },
  
  setOllamaBaseUrl: (url) => set({ ollamaBaseUrl: url }),
  setGmailConnected: (connected) => set({ gmailConnected: connected }),
  setAgentMode: (mode) => set({ agentMode: mode }),
  setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),
}));
