import { create } from 'zustand';
import { apiFetch, configureApi, errorMessage } from '../lib/api';
import { DEFAULT_MODELS, type AuthResponse, type AuthUser, type Provider } from '../lib/types';

const USER_KEY = 'pluto_auth_user';
const keyStorageName = (provider: string) => `ai_agent_key_${provider}`;

// ---------------------------------------------------------------------------
// Persistence helpers (storage can throw in private mode / when disabled)
// ---------------------------------------------------------------------------

const safeGet = (storage: Storage, key: string) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (storage: Storage, key: string, value: string | null) => {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
};

const getStoredKey = (provider: string): string => {
  const key = (safeGet(localStorage, keyStorageName(provider)) || '').trim();
  // Purge keys that obviously belong to another provider (accidental pastes)
  const invalid =
    (provider === 'openai' && key && !key.startsWith('sk-')) ||
    (provider === 'google' && key && !key.startsWith('AQ.') && !key.startsWith('AIza'));
  if (invalid) {
    safeSet(localStorage, keyStorageName(provider), null);
    return '';
  }
  return key;
};

/** "Remember this device" sessions live in localStorage; others only for the tab's lifetime. */
const loadStoredUser = (): AuthUser | null => {
  for (const storage of [localStorage, sessionStorage]) {
    const raw = safeGet(storage, USER_KEY);
    if (!raw) continue;
    try {
      const user = JSON.parse(raw) as AuthUser;
      // Sessions from before token auth, or expired ones, can't be used
      if (user?.token && (!user.expiresAt || user.expiresAt > Date.now())) return user;
    } catch {
      /* corrupt entry */
    }
    safeSet(storage, USER_KEY, null);
  }
  return null;
};

const persistUser = (user: AuthUser | null, remember: boolean) => {
  safeSet(localStorage, USER_KEY, null);
  safeSet(sessionStorage, USER_KEY, null);
  if (user) safeSet(remember ? localStorage : sessionStorage, USER_KEY, JSON.stringify(user));
};

const toUser = (res: AuthResponse): AuthUser => ({
  id: String(res.id),
  email: res.email,
  name: res.name,
  picture: res.picture,
  auth_provider: res.auth_provider,
  token: res.token,
  expiresAt: Date.now() + res.expires_in * 1000,
});

// Not a discriminated union: narrowing on it needs strictNullChecks, which this project doesn't enable yet
type Result = { success: boolean; error?: string };

export type Section = 'chat' | 'rag' | 'gmail' | 'coding';

export interface GoogleCredential {
  access_token?: string;
  id_token?: string;
  code?: string;
  code_verifier?: string;
  redirect_uri?: string;
}

interface BackendConfig {
  provider: Provider;
  model: string;
  has_key: boolean;
  temperature: number;
  max_tokens: number;
}

export interface AuthConfig {
  google_client_id: string;
  has_google_auth: boolean;
  allow_guest: boolean;
}

interface AppState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  sessionExpired: boolean;

  activeSection: Section;
  activeProvider: Provider;
  modelName: string;
  apiKey: string;
  ollamaBaseUrl: string;
  gmailConnected: boolean;
  agentMode: boolean;
  systemPrompt: string;
  backendConfig: BackendConfig | null;
  authConfig: AuthConfig | null;

  login: (email: string, password: string, remember?: boolean) => Promise<Result>;
  signup: (name: string, email: string, password: string) => Promise<Result>;
  loginWithGoogle: (credential: GoogleCredential) => Promise<Result>;
  loginAsGuest: () => Promise<Result>;
  logout: (opts?: { expired?: boolean }) => void;

  fetchBackendConfig: () => Promise<void>;
  fetchAuthConfig: () => Promise<void>;
  setActiveSection: (section: Section) => void;
  setActiveProvider: (provider: Provider) => void;
  setModelName: (modelName: string) => void;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  setOllamaBaseUrl: (url: string) => void;
  setGmailConnected: (connected: boolean) => void;
  setAgentMode: (mode: boolean) => void;
  setSystemPrompt: (prompt: string) => void;
}

const initialUser = loadStoredUser();

export const useAppStore = create<AppState>((set, get) => {
  const establishSession = (res: AuthResponse, remember: boolean): Result => {
    const user = toUser(res);
    persistUser(user, remember);
    set({ user, isAuthenticated: true, sessionExpired: false });
    return { success: true };
  };

  return {
    user: initialUser,
    isAuthenticated: !!initialUser,
    sessionExpired: false,

    activeSection: 'chat',
    activeProvider: 'google',
    modelName: DEFAULT_MODELS.google,
    apiKey: getStoredKey('google'),
    ollamaBaseUrl: 'http://localhost:11434',
    gmailConnected: false,
    agentMode: false,
    systemPrompt:
      'You are an advanced Orchestrator Agent. You have dynamic access to sub-agents (RAG, Gmail) to retrieve knowledge and execute tasks. Be direct, helpful, and concise.',
    backendConfig: null,
    authConfig: null,

    login: async (email, password, remember = true) => {
      try {
        const res = await apiFetch<AuthResponse>('/auth/login', {
          json: { email: email.trim(), password },
          auth: false,
        });
        return establishSession(res, remember);
      } catch (err) {
        return { success: false, error: errorMessage(err, 'Invalid email or password.') };
      }
    },

    signup: async (name, email, password) => {
      try {
        const res = await apiFetch<AuthResponse>('/auth/signup', {
          json: { name: name.trim(), email: email.trim().toLowerCase(), password },
          auth: false,
        });
        return establishSession(res, true);
      } catch (err) {
        return { success: false, error: errorMessage(err, 'Sign up failed.') };
      }
    },

    loginWithGoogle: async (credential) => {
      try {
        // The server verifies the Google token and derives the identity from it
        const res = await apiFetch<AuthResponse>('/auth/google', { json: credential, auth: false });
        return establishSession(res, true);
      } catch (err) {
        return { success: false, error: errorMessage(err, 'Google sign-in failed.') };
      }
    },

    loginAsGuest: async () => {
      try {
        const res = await apiFetch<AuthResponse>('/auth/guest', { method: 'POST', auth: false });
        return establishSession(res, false);
      } catch (err) {
        return { success: false, error: errorMessage(err, 'Guest access is unavailable.') };
      }
    },

    logout: (opts) => {
      persistUser(null, false);
      set({ user: null, isAuthenticated: false, sessionExpired: !!opts?.expired, gmailConnected: false });
    },

    fetchBackendConfig: async () => {
      try {
        const data = await apiFetch<BackendConfig>('/config/llm', { auth: false, timeoutMs: 10_000 });
        set({ backendConfig: data });
        // Sync the UI to the server's active provider and model
        if (data.has_key && data.provider) {
          set({
            activeProvider: data.provider,
            modelName: data.model,
            apiKey: getStoredKey(data.provider),
          });
        }
      } catch (err) {
        console.warn('Could not sync backend LLM config:', err);
      }
    },

    fetchAuthConfig: async () => {
      try {
        set({ authConfig: await apiFetch<AuthConfig>('/config/auth', { auth: false, timeoutMs: 10_000 }) });
      } catch (err) {
        console.warn('Could not load auth config:', err);
      }
    },

    setActiveSection: (section) => set({ activeSection: section }),

    setActiveProvider: (provider) =>
      set({
        activeProvider: provider,
        apiKey: getStoredKey(provider),
        modelName: DEFAULT_MODELS[provider] || DEFAULT_MODELS.openai,
      }),

    setModelName: (modelName) => set({ modelName }),

    setApiKey: (key) => {
      safeSet(localStorage, keyStorageName(get().activeProvider), key && key.trim() ? key.trim() : null);
      set({ apiKey: key });
    },

    clearApiKey: () => {
      safeSet(localStorage, keyStorageName(get().activeProvider), null);
      set({ apiKey: '' });
    },

    setOllamaBaseUrl: (url) => set({ ollamaBaseUrl: url }),
    setGmailConnected: (connected) => set({ gmailConnected: connected }),
    setAgentMode: (mode) => set({ agentMode: mode }),
    setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),
  };
});

configureApi({
  getToken: () => useAppStore.getState().user?.token,
  onUnauthorized: () => {
    if (useAppStore.getState().isAuthenticated) useAppStore.getState().logout({ expired: true });
  },
});

/** Shared request fields describing the user's model choice. */
export const llmFields = () => {
  const { activeProvider, modelName, apiKey } = useAppStore.getState();
  return {
    provider: activeProvider,
    model: modelName,
    api_key: apiKey && apiKey.trim() ? apiKey.trim() : null,
  };
};
