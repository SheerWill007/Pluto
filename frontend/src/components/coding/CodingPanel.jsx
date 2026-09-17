import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useAgentStore } from '../../store/useAgentStore';
import { useCodingStore } from '../../store/useCodingStore';
import GlassCard from '../ui/GlassCard';
import MarkdownFormatter from '../ui/MarkdownFormatter';
import { 
  Plus, Trash2, Code2, Cpu, Sparkles, Terminal, FileText, 
  ChevronDown, ChevronUp, Clipboard, RefreshCw, Zap, CheckCircle2, 
  XCircle, Send, MessageSquare, FileCode, Play
} from 'lucide-react';
import { gsap } from 'gsap';

export const CodingPanel = () => {
  const { apiKey } = useAppStore();
  const { setNodeActive, clearActiveNodes } = useAgentStore();
  
  const {
    sessions,
    activeSessionId,
    isGenerating,
    isCritiquing,
    error,
    initialize,
    createNewSession,
    setActiveSessionId,
    updateActiveContext,
    generateCodeForActiveSession,
    critiqueCodeBlock,
    deleteSession,
    clearActiveSession
  } = useCodingStore();

  const [input, setInput] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState(null);
  
  const [localProvider, setLocalProvider] = useState('openai');
  const [localModel, setLocalModel] = useState('gpt-4o-mini');

  const threadEndRef = useRef(null);
  const sendBtnRef = useRef(null);

  // Initialize on component mount
  useEffect(() => {
    initialize();
  }, []);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const generations = activeSession ? activeSession.generations : [];
  const activeBlock = generations.find(b => b.id === activeBlockId) || generations[generations.length - 1];

  // Auto-scroll output thread to bottom on new code outputs
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [generations, isGenerating]);

  // Set default active block to the newest block when a generation completes
  useEffect(() => {
    if (generations.length > 0 && (!activeBlockId || !generations.some(b => b.id === activeBlockId))) {
      setActiveBlockId(generations[generations.length - 1].id);
    }
  }, [generations]);

  const handleProviderChange = (provider) => {
    setLocalProvider(provider);
    if (provider === 'openai') setLocalModel('gpt-4o-mini');
    else if (provider === 'anthropic') setLocalModel('claude-3-5-sonnet-20240620');
    else if (provider === 'google') setLocalModel('gemini-1.5-pro');
    else if (provider === 'groq') setLocalModel('llama3-8b-8192');
    else if (provider === 'openrouter') setLocalModel('meta-llama/llama-3-8b-instruct:free');
    else if (provider === 'ollama') setLocalModel('llama3');
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isGenerating || !activeSession) return;

    const queryText = input.trim();
    setInput('');

    // Apply "liquid press squish" using GSAP on the send button
    if (sendBtnRef.current) {
      gsap.timeline()
        .to(sendBtnRef.current, { scaleX: 1.25, scaleY: 0.7, duration: 0.08, ease: "power1.out" })
        .to(sendBtnRef.current, { scaleX: 0.9, scaleY: 1.15, duration: 0.1, ease: "power1.inOut" })
        .to(sendBtnRef.current, { scaleX: 1.0, scaleY: 1.0, duration: 0.35, ease: "elastic.out(1, 0.4)" });
    }

    setNodeActive('orchestrator', true);
    setNodeActive('code_generator', true);
    setNodeActive(localProvider, true);

    await generateCodeForActiveSession(queryText, localProvider, localModel, apiKey);

    setTimeout(() => {
      clearActiveNodes();
    }, 1500);
  };

  const handleCritique = async (blockId) => {
    if (isCritiquing) return;

    setNodeActive('orchestrator', true);
    setNodeActive('code_critic', true);
    setNodeActive(localProvider, true);

    await critiqueCodeBlock(blockId, localProvider, localModel, apiKey);

    setTimeout(() => {
      clearActiveNodes();
    }, 1500);
  };

  const handleApplyFeedback = async () => {
    if (!activeBlock || !activeBlock.critic || isGenerating) return;

    setNodeActive('orchestrator', true);
    setNodeActive('code_generator', true);
    setNodeActive('code_critic', true);
    setNodeActive(localProvider, true);

    await generateCodeForActiveSession(
      activeBlock.prompt,
      localProvider,
      localModel,
      apiKey,
      activeBlock.critic.feedback
    );

    setTimeout(() => {
      clearActiveNodes();
    }, 1500);
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
  };

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-stone-500 dark:text-stone-400 font-sans">
        Loading coding tasks...
      </div>
    );
  }

  return (
    <div className="flex-1 flex gap-6 h-full min-h-0 overflow-hidden p-6 relative">
      
      {/* Left Sidebar: Coding History Tasks */}
      <div className="w-64 shrink-0 flex flex-col gap-4 h-full min-h-0">
        <button
          onClick={createNewSession}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-semibold text-xs tracking-wide transition-all duration-300 shadow-[0_2px_8px_rgba(217,119,6,0.15)] flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Task</span>
        </button>

        <GlassCard 
          className="flex-grow flex flex-col min-h-0 overflow-hidden"
          contentClassName="flex-1 flex flex-col min-h-0 overflow-hidden p-3"
        >
          <div className="text-[10px] font-bold text-stone-500 dark:text-stone-400 tracking-wider uppercase font-mono mb-2 px-1 shrink-0">
            Coding Tasks
          </div>
          
          <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 min-h-0">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                onClick={() => setActiveSessionId(sess.id)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 border ${
                  sess.id === activeSessionId
                    ? 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/20 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 font-medium'
                    : 'hover:bg-white/50 dark:hover:bg-stone-800/50 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileCode className={`h-4 w-4 shrink-0 ${
                    sess.id === activeSessionId ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300'
                  }`} />
                  <span className="text-xs truncate">{sess.title}</span>
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(sess.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-stone-100/80 dark:hover:bg-stone-800/80 text-stone-400 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 transition-all duration-150 cursor-pointer"
                  title="Delete coding task"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Center Column: Collapsible Context, Output Thread, Bottom Input */}
      <div className="flex-grow flex flex-col h-full min-h-0 overflow-hidden">
        {/* Code Context Drawer (Top) */}
        <GlassCard className="mb-4 shrink-0 p-4! rounded-xl">
          <button
            onClick={() => setShowContext(!showContext)}
            className="flex items-center justify-between w-full text-stone-700 dark:text-stone-200 hover:text-stone-900 dark:hover:text-white font-bold text-xs font-sans"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-beige-600 dark:text-beige-400" />
              <span>CODE CONTEXT / INPUT FILES</span>
            </div>
            {showContext ? <ChevronUp className="h-4 w-4 text-stone-500 dark:text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-500 dark:text-stone-400" />}
          </button>

          {showContext && (
            <div className="mt-3">
              <textarea
                value={activeSession?.context || ''}
                onChange={(e) => updateActiveContext(e.target.value)}
                placeholder="Paste code snippet, libraries, or file contexts to feed the LLM..."
                rows={4}
                className="w-full bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-2.5 text-xs text-stone-850 dark:text-stone-200 font-mono focus:outline-none focus:border-beige-400 dark:focus:border-stone-500 select-text"
              />
            </div>
          )}
        </GlassCard>

        {/* Output Viewport (Middle) */}
        <GlassCard 
          className="flex-1 flex flex-col rounded-2xl relative mb-4 overflow-hidden min-h-0"
          contentClassName="flex-grow flex flex-col overflow-hidden p-4 min-h-0 bg-stone-50/20 dark:bg-stone-900/20"
        >
          <div className="flex-1 overflow-y-auto pr-2 space-y-5 min-h-0">
            {generations.length > 0 ? (
              generations.map((gen, idx) => {
                const isSelected = activeBlock && activeBlock.id === gen.id;
                
                return (
                  <div key={gen.id} className="space-y-2">
                    {/* Prompt Header */}
                    <div 
                      onClick={() => setActiveBlockId(gen.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs cursor-pointer border transition-all ${
                        isSelected 
                          ? 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/20 dark:border-amber-500/30 text-amber-900 dark:text-amber-200' 
                          : 'bg-white dark:bg-stone-800/80 border-stone-200/60 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-stone-300 dark:hover:border-stone-600'
                      }`}
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="font-semibold select-none">Prompt:</span>
                      <span className="truncate flex-1 font-mono text-[11px]">{gen.prompt}</span>
                      
                      {gen.critic ? (
                        gen.critic.approved ? (
                          <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-250 dark:border-emerald-800 px-2 py-0.5 rounded font-bold uppercase tracking-wide">Approved</span>
                        ) : (
                          <span className="text-[10px] bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-250 dark:border-rose-800 px-2 py-0.5 rounded font-bold uppercase tracking-wide">Needs Fix</span>
                        )
                      ) : (
                        <span className="text-[9px] bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 border border-stone-250 dark:border-stone-700 px-2 py-0.5 rounded font-bold uppercase tracking-wide">Unreviewed</span>
                      )}
                    </div>

                    {/* Code Container */}
                    <div className="rounded-xl border border-stone-200/70 dark:border-stone-700 overflow-hidden bg-stone-900 text-stone-100 font-mono text-[11px] relative shadow-sm">
                      <div className="flex items-center justify-between px-4 py-2 bg-stone-850 border-b border-stone-800 text-[10px] text-stone-400 font-bold uppercase tracking-wider shrink-0 select-none">
                        <span>Generated code output</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCopyCode(gen.code)}
                            className="hover:text-white transition-colors text-[9px] px-2 py-0.5 rounded bg-stone-800 border border-stone-700/50 hover:bg-stone-700 cursor-pointer"
                          >
                            Copy
                          </button>
                          
                          {!gen.critic && (
                            <button
                              onClick={() => {
                                setActiveBlockId(gen.id);
                                handleCritique(gen.id);
                              }}
                              disabled={isCritiquing}
                              className="hover:text-amber-400 text-amber-505 transition-colors text-[9px] px-2 py-0.5 rounded bg-stone-800 border border-stone-750 hover:bg-stone-750 cursor-pointer flex items-center gap-1 disabled:opacity-50"
                            >
                              {isCritiquing && isSelected ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : <Zap className="h-2.5 w-2.5" />}
                              <span>Review</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <pre className="p-4 overflow-x-auto leading-relaxed select-text bg-stone-950/40 max-h-96">
                        <code>{gen.code}</code>
                      </pre>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex-grow flex flex-col items-center justify-center text-center text-stone-450 dark:text-stone-500 h-full p-6 select-none">
                <Code2 className="h-10 w-10 mb-2 text-stone-450 dark:text-stone-500 opacity-40 animate-pulse" />
                <span className="text-xs font-semibold">Ready to generate code</span>
                <span className="text-[10px] opacity-60 mt-1 max-w-[240px]">Submit an instruction at the bottom. The model will reference the context details if pasted.</span>
              </div>
            )}
            {isGenerating && (
              <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500 font-mono pl-2">
                <Sparkles className="h-4 w-4 text-beige-600 dark:text-beige-400 animate-spin" />
                <span>Generating code package...</span>
              </div>
            )}
            <div ref={threadEndRef} />
          </div>
        </GlassCard>

        {/* Input Submit Area (Bottom) */}
        <form onSubmit={handleSend} className="flex flex-col gap-3 shrink-0">
          {error && (
            <div className="text-[11px] text-red-650 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-2 font-mono">
              {error}
            </div>
          )}

          <div className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask orchestrator to generate or edit code..."
              disabled={isGenerating}
              className="w-full bg-white/40 dark:bg-stone-800/40 border border-stone-200/50 dark:border-stone-700 backdrop-blur-md rounded-2xl pl-5 pr-14 py-4 text-sm text-stone-855 dark:text-stone-200 focus:outline-none focus:border-beige-400 dark:focus:border-stone-500 shadow-[0_4px_24px_rgba(28,25,23,0.02)] placeholder-stone-450 dark:placeholder-stone-500 disabled:opacity-50"
            />
            <button
              ref={sendBtnRef}
              type="submit"
              disabled={!input.trim() || isGenerating}
              className="absolute right-3 p-2.5 rounded-xl bg-gradient-to-tr from-beige-400 to-beige-600 hover:from-beige-300 hover:to-beige-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-[0_2px_8px_rgba(168,152,120,0.2)]"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          {/* Local Provider/Model override dropdown selectors */}
          <div className="flex gap-4 shrink-0 px-2">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider font-mono">Provider:</span>
              <div className="relative flex items-center">
                <select
                  value={localProvider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="bg-white/40 dark:bg-stone-800/40 border border-stone-200/40 dark:border-stone-700 text-stone-750 dark:text-stone-200 text-[10px] rounded-lg pl-2 pr-6 py-1 focus:outline-none focus:border-beige-400 dark:focus:border-stone-500 cursor-pointer appearance-none font-sans"
                >
                  <option value="openai" className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">OpenAI</option>
                  <option value="anthropic" className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">Anthropic</option>
                  <option value="google" className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">Google Gemini</option>
                  <option value="groq" className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">Groq</option>
                  <option value="openrouter" className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">OpenRouter</option>
                  <option value="ollama" className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">Ollama (Local)</option>
                </select>
                <ChevronDown className="absolute right-1.5 h-3 w-3 text-stone-500 dark:text-stone-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider font-mono">Model:</span>
              <input
                type="text"
                value={localModel}
                onChange={(e) => setLocalModel(e.target.value)}
                className="bg-white/40 dark:bg-stone-800/40 border border-stone-200/40 dark:border-stone-700 text-stone-750 dark:text-stone-200 text-[10px] rounded-lg px-2 py-0.5 focus:outline-none focus:border-beige-400 dark:focus:border-stone-500 font-mono w-32"
              />
            </div>

            <button
              type="button"
              onClick={clearActiveSession}
              className="ml-auto text-[9px] text-stone-400 dark:text-stone-500 hover:text-rose-500 dark:hover:text-rose-400 font-bold uppercase tracking-wider font-mono transition-colors"
            >
              Clear Task
            </button>
          </div>
        </form>
      </div>

      {/* Right Column: Critic Audit panel */}
      <div className="w-full lg:w-[380px] shrink-0 flex flex-col min-h-0">
        <GlassCard className="p-5! rounded-2xl flex-grow flex flex-col min-h-0" contentClassName="flex-grow flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-4 text-xs font-bold text-stone-500 dark:text-stone-400 tracking-wider uppercase font-mono shrink-0">
            <Cpu className="h-4 w-4 text-beige-600 dark:text-beige-400" />
            <span>Senior Critic Audit</span>
          </div>

          <div className="flex-grow flex flex-col overflow-y-auto pr-1 min-h-0 select-text">
            {activeBlock ? (
              activeBlock.critic ? (
                <div className="space-y-4 flex flex-col h-full min-h-0">
                  {/* Approval Status Banner */}
                  {activeBlock.critic.approved ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-250 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 shrink-0">
                      <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-xs font-bold font-sans">APPROVED BY REVIEWER</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-250 dark:border-rose-800 text-rose-800 dark:text-rose-300 shrink-0">
                      <XCircle className="h-4.5 w-4.5 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span className="text-xs font-bold font-sans">REVISION REQUIRED</span>
                    </div>
                  )}

                  {/* Audit comments */}
                  <div className="flex-1 bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-700 rounded-xl p-3.5 overflow-y-auto text-[11px] leading-relaxed text-stone-700 dark:text-stone-300 font-sans shadow-inner">
                    <MarkdownFormatter text={activeBlock.critic.feedback} />
                  </div>

                  {/* Iterative apply trigger */}
                  {!activeBlock.critic.approved && (
                    <button
                      onClick={handleApplyFeedback}
                      disabled={isGenerating}
                      className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(217,119,6,0.15)] cursor-pointer shrink-0"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Apply recommendations & refine</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-center text-stone-400 dark:text-stone-500 h-full p-6 select-none">
                  <Cpu className="h-8 w-8 mb-2 text-stone-500 dark:text-stone-400 opacity-40" />
                  <span className="text-xs font-semibold">Block unreviewed</span>
                  <span className="text-[10px] opacity-60 mt-1 max-w-[200px] mb-4">Click "Review" on the generation code block above to invoke the Code Critic audit check.</span>
                  
                  <button
                    onClick={() => handleCritique(activeBlock.id)}
                    disabled={isCritiquing || isGenerating}
                    className="w-full py-2.5 rounded-xl bg-stone-900 border border-stone-800 hover:bg-stone-800 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isCritiquing ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Running Critic Review...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="h-3.5 w-3.5 text-amber-500" />
                        <span>Audit Selected Block</span>
                      </>
                    )}
                  </button>
                </div>
              )
            ) : (
              <div className="flex-grow flex flex-col items-center justify-center text-center text-stone-400 dark:text-stone-500 h-full p-6 select-none">
                <Cpu className="h-8 w-8 mb-2 text-stone-500 dark:text-stone-400 opacity-40 animate-pulse" />
                <span className="text-xs font-semibold">No code block selected</span>
                <span className="text-[10px] opacity-60 mt-1 max-w-[200px]">Generate code output, then select the code block header to inspect reviewer comments here.</span>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

    </div>
  );
};

export default CodingPanel;
