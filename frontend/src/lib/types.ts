export type Provider = 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter' | 'ollama';

// Keep in sync with ACTIVE_MODELS_MAP defaults in llm_provider/llm_initializer.py
export const DEFAULT_MODELS: Record<Provider, string> = {
  google: 'gemini-flash-lite-latest',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-5-5',
  groq: 'openai/gpt-oss-20b',
  openrouter: 'openai/gpt-4o-mini',
  // Tool calling (which the orchestrator needs) requires llama3.1 or newer
  ollama: 'llama3.1',
};

export const PROVIDER_LABELS: Record<Provider, string> = {
  google: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  groq: 'Groq',
  openrouter: 'OpenRouter',
  ollama: 'Ollama (local)',
};

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  auth_provider: 'local' | 'google' | 'guest' | string;
  token: string;
  /** Epoch milliseconds after which the token is no longer valid */
  expiresAt?: number;
}

export interface AuthResponse extends Omit<AuthUser, 'expiresAt'> {
  expires_in: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  tokens?: number;
  latency?: number;
  /** Tools the agent invoked while producing this message */
  tools?: string[];
  streaming?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  systemPrompt: string;
  timestamp: number;
}

export interface CriticResult {
  approved: boolean;
  feedback: string;
  timestamp: number;
}

export interface CodeGeneration {
  id: string;
  prompt: string;
  code: string;
  critic: CriticResult | null;
  timestamp: number;
}

export interface CodingSession {
  id: string;
  title: string;
  context: string;
  generations: CodeGeneration[];
  timestamp: number;
}

export interface NodeState {
  status: string;
  latency: number;
  last_action?: string;
}
