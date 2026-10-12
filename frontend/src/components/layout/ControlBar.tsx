import { useState } from 'react';
import { ChevronDown, Eye, EyeOff, KeyRound, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useAgentStore } from '../../store/useAgentStore';
import { PROVIDER_LABELS, type Provider } from '../../lib/types';

/** Provider, model, key override and agent-mode switch, shared by every panel. */
export function ControlBar() {
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
  } = useAppStore();
  const agentStates = useAgentStore((s) => s.agentStates);
  const [showKey, setShowKey] = useState(false);

  const serverHasKey = !!backendConfig?.has_key && backendConfig?.provider === activeProvider;
  const ready =
    activeProvider === 'ollama'
      ? agentStates.ollama?.status === 'connected'
      : !!apiKey.trim() || serverHasKey;
  const keyLooksWrong = activeProvider === 'openai' && apiKey && !apiKey.startsWith('sk-');

  return (
    <div className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-white/[0.07] bg-black/50 px-2 py-1.5 text-xs backdrop-blur-xl">
      <span
        className="flex items-center gap-2 rounded-full px-3 py-1.5 text-white/70"
        title={ready ? 'The selected model can be reached' : 'No API key for this provider (server or custom)'}
      >
        <span className={`relative flex h-2 w-2`}>
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${ready ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${ready ? 'bg-emerald-400' : 'bg-rose-400'}`} />
        </span>
        {ready ? 'Ready' : 'Offline'}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={agentMode}
        onClick={() => setAgentMode(!agentMode)}
        title="Agent mode lets the orchestrator search your documents and Gmail"
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors ${
          agentMode ? 'border-beige-300/40 bg-beige-400/15 text-beige-100' : 'border-white/10 text-white/55 hover:text-white'
        }`}
      >
        <span className={`relative h-3.5 w-6 rounded-full transition-colors ${agentMode ? 'bg-beige-300' : 'bg-white/15'}`}>
          <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-black transition-all ${agentMode ? 'left-3' : 'left-0.5'}`} />
        </span>
        Agent mode
      </button>

      <label className="relative flex items-center">
        <span className="sr-only">LLM provider</span>
        <select
          value={activeProvider}
          onChange={(e) => setActiveProvider(e.target.value as Provider)}
          className="appearance-none rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-3 pr-7 text-white/85 focus:border-beige-400/60 focus:outline-none"
        >
          {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 h-3 w-3 text-white/40" />
      </label>

      <label className="flex items-center">
        <span className="sr-only">Model</span>
        <input
          type="text"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder="Model name"
          spellCheck={false}
          className="w-40 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] text-white/85 placeholder:text-white/30 focus:border-beige-400/60 focus:outline-none"
        />
      </label>

      {activeProvider !== 'ollama' && (
        <label className="relative flex items-center" title={apiKey ? 'Using your key for this provider' : serverHasKey ? 'Using the server key' : 'Paste a key for this provider'}>
          <span className="sr-only">API key</span>
          <KeyRound className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-white/35" />
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={serverHasKey ? 'Server key (paste to override)' : 'Paste API key'}
            autoComplete="off"
            spellCheck={false}
            className={`w-52 rounded-full border bg-white/[0.04] py-1.5 pl-8 pr-14 font-mono text-[11px] text-white/85 placeholder:text-white/30 focus:outline-none ${
              keyLooksWrong ? 'border-rose-400/60' : 'border-white/10 focus:border-beige-400/60'
            }`}
          />
          <span className="absolute right-2 flex items-center gap-0.5">
            {apiKey && (
              <button type="button" onClick={clearApiKey} title="Clear custom key" className="rounded-full p-1 text-white/40 hover:text-rose-300">
                <X className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              title={showKey ? 'Hide key' : 'Show key'}
              className="rounded-full p-1 text-white/40 hover:text-white"
            >
              {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </button>
          </span>
        </label>
      )}
    </div>
  );
}

export default ControlBar;
