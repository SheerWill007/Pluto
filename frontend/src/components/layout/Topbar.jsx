import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useAgentStore } from '../../store/useAgentStore';
import { useThemeStore } from '../../store/useThemeStore';
import { Key, Eye, EyeOff, Activity, ChevronDown, X, Sun, Moon } from 'lucide-react';
import PulseOrb from '../ui/PulseOrb';

export const Topbar = ({ showTopology, setShowTopology }) => {
  const {
    activeProvider,
    setActiveProvider,
    modelName,
    setModelName,
    apiKey,
    setApiKey,
    clearApiKey,
    agentMode,
    setAgentMode,
    backendConfig,
    fetchBackendConfig,
  } = useAppStore();

  const { agentStates } = useAgentStore();
  const { theme, toggleTheme } = useThemeStore();
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    fetchBackendConfig();
  }, []);

  const getConnectionStatus = () => {
    if (activeProvider === 'ollama') {
      return agentStates.ollama?.status === 'connected' ? 'connected' : 'disconnected';
    }
    if (apiKey && apiKey.trim()) return 'connected';
    if (backendConfig?.has_key && backendConfig?.provider === activeProvider) return 'connected';
    return 'disconnected';
  };

  const status = getConnectionStatus();
  const isInvalidOpenAIKey = activeProvider === 'openai' && apiKey && !apiKey.startsWith('sk-');

  return (
    <header className="h-20 bg-white/35 dark:bg-stone-900/40 backdrop-blur-2xl border-b border-white/50 dark:border-stone-700 flex items-center justify-between px-8 z-20 shrink-0 shadow-[0_2px_20px_rgba(168,152,120,0.06)]">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-extrabold text-stone-800 dark:text-stone-200 font-sans tracking-wide">
          Pluto Agent Console
        </h1>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/40 dark:bg-stone-800/40 border border-white/50 dark:border-stone-700">
          <PulseOrb status={status} />
          <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300 capitalize font-mono">
            {activeProvider} {status === 'connected' ? 'Ready' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg bg-white/40 dark:bg-stone-800/40 hover:bg-white/70 dark:hover:bg-stone-800/70 border border-white/50 dark:border-stone-700 text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-100 transition-colors cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 text-amber-500 dark:text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-stone-600 dark:text-stone-300" />
          )}
        </button>

        <div className="flex items-center gap-2 border-r border-white/40 dark:border-stone-700 pr-6">
          <span className="text-xs font-bold text-stone-600 dark:text-stone-300 select-none">Agent Mode</span>
          <button
            onClick={() => setAgentMode(!agentMode)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              agentMode ? 'bg-beige-500' : 'bg-stone-300/80 dark:bg-stone-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-stone-200 shadow ring-0 transition duration-200 ease-in-out ${
                agentMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-bold text-stone-500 dark:text-stone-500 uppercase tracking-wider font-mono">LLM Provider</label>
          <div className="relative flex items-center">
            <select
              value={activeProvider}
              onChange={(e) => setActiveProvider(e.target.value)}
              className="bg-white/40 dark:bg-stone-800/40 border border-white/50 dark:border-stone-700 text-stone-700 dark:text-stone-200 text-xs rounded-xl pl-3 pr-8 py-1.5 focus:outline-none focus:border-beige-400 cursor-pointer font-sans appearance-none backdrop-blur-md"
            >
              <option value="openai" className="bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200">OpenAI</option>
              <option value="anthropic" className="bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200">Anthropic</option>
              <option value="google" className="bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200">Google Gemini</option>
              <option value="groq" className="bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200">Groq</option>
              <option value="openrouter" className="bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200">OpenRouter</option>
              <option value="ollama" className="bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200">Ollama (Local)</option>
            </select>
            <ChevronDown className="absolute right-2.5 h-3.5 w-3.5 text-stone-500 dark:text-stone-500 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-bold text-stone-500 dark:text-stone-500 uppercase tracking-wider font-mono">Model</label>
          <input
            type="text"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="Enter model name..."
            className="bg-white/40 dark:bg-stone-800/40 border border-white/50 dark:border-stone-700 text-stone-700 dark:text-stone-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-beige-400 font-mono w-40 backdrop-blur-md"
          />
        </div>

        {activeProvider !== 'ollama' && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-bold text-stone-500 dark:text-stone-500 uppercase tracking-wider font-mono">API Key</label>
              <span className={`text-[9px] font-mono ${apiKey ? 'text-amber-600 dark:text-amber-400 font-semibold' : (backendConfig?.has_key && backendConfig?.provider === activeProvider ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-stone-400 dark:text-stone-500')}`}>
                {apiKey ? 'custom' : (backendConfig?.has_key && backendConfig?.provider === activeProvider ? '.env ready' : '.env')}
              </span>
            </div>
            <div className="relative flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Using .env (or paste override)..."
                className={`bg-white/40 dark:bg-stone-800/40 border ${isInvalidOpenAIKey ? 'border-red-400 dark:border-red-500' : 'border-white/50 dark:border-stone-700'} text-stone-700 dark:text-stone-200 text-xs rounded-xl pl-8 pr-14 py-1.5 focus:outline-none focus:border-beige-400 font-mono w-52 text-ellipsis backdrop-blur-md`}
              />
              <Key className="absolute left-2.5 h-3.5 w-3.5 text-stone-500 dark:text-stone-500" />
              <div className="absolute right-2 flex items-center gap-1">
                {apiKey && (
                  <button
                    type="button"
                    title="Clear custom key (revert to .env)"
                    onClick={clearApiKey}
                    className="hover:text-red-600 dark:hover:text-red-400 text-stone-400 dark:text-stone-500 focus:outline-none p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  title={showKey ? "Hide key" : "Show key"}
                  onClick={() => setShowKey(!showKey)}
                  className="hover:text-stone-800 dark:hover:text-stone-200 text-stone-500 dark:text-stone-500 focus:outline-none p-0.5"
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            {isInvalidOpenAIKey && (
              <span className="text-[9px] text-red-500 dark:text-red-400 font-medium">Must start with sk-</span>
            )}
          </div>
        )}

        <button
          onClick={() => setShowTopology(!showTopology)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold tracking-wide transition-all duration-300 ${
            showTopology
              ? 'bg-gradient-to-r from-beige-400 to-beige-600 border-beige-300/60 text-white shadow-[0_4px_12px_rgba(168,152,120,0.25)]'
              : 'border-white/50 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:text-stone-800 dark:hover:text-stone-100 hover:bg-white/40 dark:hover:bg-stone-800/40 bg-white/25 dark:bg-stone-800/25'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>Agent Topology Map</span>
        </button>
      </div>
    </header>
  );
};

export default Topbar;
