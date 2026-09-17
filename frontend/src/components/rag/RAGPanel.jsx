import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useAgentStore } from '../../store/useAgentStore';
import DocumentUpload from './DocumentUpload';
import ChunkViewer from './ChunkViewer';
import GlassCard from '../ui/GlassCard';
import { Search, Database, Sparkles, BookOpen, Layers, ChevronDown, FileText, Trash2 } from 'lucide-react';
import MarkdownFormatter from '../ui/MarkdownFormatter';

export const RAGPanel = () => {
  const { apiKey, selectedProvider, selectedModel } = useAppStore();
  const { setNodeActive, clearActiveNodes } = useAgentStore();

  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(4);
  const [localProvider, setLocalProvider] = useState(selectedProvider || 'google');
  const [localModel, setLocalModel] = useState(selectedModel || 'gemini-flash-lite-latest');
  
  const [availableDocs, setAvailableDocs] = useState([]);
  const [selectedSource, setSelectedSource] = useState('all');

  const [answer, setAnswer] = useState('');
  const [chunks, setChunks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Sync with global store when backend config is loaded
  useEffect(() => {
    if (selectedProvider) setLocalProvider(selectedProvider);
    if (selectedModel) setLocalModel(selectedModel);
  }, [selectedProvider, selectedModel]);

  // Load existing ingested documents from backend
  const fetchDocuments = async () => {
    try {
      const response = await fetch('https://atlasmultiagentsystem.onrender.com/api/v1/rag/documents');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.documents)) {
          setAvailableDocs(data.documents);
        }
      }
    } catch (error) {
      console.error('Failed to fetch RAG documents:', error);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // When a file is uploaded, refresh doc list and auto-select as active document
  const handleUploadSuccess = (uploadData) => {
    const filename = uploadData?.filename;
    if (filename) {
      setAvailableDocs(prev => {
        if (!prev.includes(filename)) {
          return [...prev, filename];
        }
        return prev;
      });
      // Auto-select just-uploaded document as the active document
      setSelectedSource(filename);
    } else {
      fetchDocuments();
    }
  };

  // Optional: clear entire knowledge base
  const handleClearKB = async () => {
    if (!window.confirm('Are you sure you want to clear all documents from the knowledge base?')) return;
    try {
      const res = await fetch('https://atlasmultiagentsystem.onrender.com/api/v1/rag/documents', {
        method: 'DELETE'
      });
      if (res.ok) {
        setAvailableDocs([]);
        setSelectedSource('all');
        setChunks([]);
        setAnswer('Knowledge base cleared successfully.');
      }
    } catch (err) {
      console.error('Failed to clear knowledge base:', err);
    }
  };

  // Default models map for local override
  const handleProviderChange = (provider) => {
    setLocalProvider(provider);
    if (provider === 'google') setLocalModel('gemini-flash-lite-latest');
    else if (provider === 'openai') setLocalModel('gpt-4o-mini');
    else if (provider === 'anthropic') setLocalModel('claude-3-5-sonnet-20240620');
    else if (provider === 'groq') setLocalModel('llama-3.1-8b-instant');
    else if (provider === 'openrouter') setLocalModel('openai/gpt-4o-mini');
    else if (provider === 'ollama') setLocalModel('llama3');
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setAnswer('');
    
    setNodeActive('rag_agent', true);
    setNodeActive('chromadb', true);
    setNodeActive('orchestrator', true);

    try {
      const payload = {
        query: query.trim(),
        top_k: parseInt(topK),
        provider: localProvider,
        model: localModel,
        api_key: (apiKey && apiKey.trim()) ? apiKey.trim() : null
      };

      // Add document scoping when an active document is selected
      if (selectedSource && selectedSource !== 'all') {
        payload.source = selectedSource;
      }

      const response = await fetch('https://atlasmultiagentsystem.onrender.com/api/v1/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Search request failed.');
      }
      const data = await response.json();
      
      setAnswer(data.answer);
      setChunks(data.chunks || []);
    } catch (error) {
      console.error(error);
      setAnswer(`Failed to query RAG agent. ${error.message}`);
      setChunks([]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        clearActiveNodes();
      }, 1500);
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-6 p-6 h-full overflow-hidden">
      
      {/* Left Column: Upload & Query Controls */}
      <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-1">
        
        {/* Upload Zone */}
        <GlassCard className="p-5! rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-500 dark:text-stone-400 tracking-wider uppercase font-mono">
              <Database className="h-4 w-4 text-beige-600 dark:text-beige-400" />
              <span>Document Ingestion</span>
            </div>
            {availableDocs.length > 0 && (
              <span className="text-[10px] font-mono text-stone-400 dark:text-stone-500">
                {availableDocs.length} document{availableDocs.length === 1 ? '' : 's'} indexed
              </span>
            )}
          </div>
          <DocumentUpload onUploadSuccess={handleUploadSuccess} />
        </GlassCard>

        {/* Query Console */}
        <GlassCard className="p-5! rounded-2xl flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-500 dark:text-stone-400 tracking-wider uppercase font-mono">
              <Search className="h-4 w-4 text-beige-600 dark:text-beige-400" />
              <span>Query Knowledge Base</span>
            </div>
            
            {/* Clear KB Action */}
            {availableDocs.length > 0 && (
              <button
                type="button"
                onClick={handleClearKB}
                className="text-[11px] text-stone-400 hover:text-rose-500 dark:hover:text-rose-400 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg border border-transparent hover:border-rose-200 dark:hover:border-rose-800/40 hover:bg-rose-50/40 dark:hover:bg-rose-950/20 cursor-pointer"
                title="Wipe ChromaDB knowledge base"
              >
                <Trash2 className="h-3 w-3" />
                <span>Clear KB</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSearch} className="flex flex-col gap-4 mb-6">
            
            {/* Input and submit */}
            <div className="relative flex items-center">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={selectedSource && selectedSource !== 'all' ? `Search inside "${selectedSource}"...` : "Search matching document chunks across all documents..."}
                className="w-full bg-white/40 dark:bg-stone-800/40 border border-white/50 dark:border-stone-700 backdrop-blur-md rounded-xl pl-5 pr-12 py-3 text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-beige-400 dark:focus:border-stone-500 font-sans placeholder-stone-400 dark:placeholder-stone-500"
              />
              <button
                type="submit"
                disabled={!query.trim() || isLoading}
                className="absolute right-2.5 p-2 rounded-lg bg-beige-500 hover:bg-beige-400 text-white disabled:opacity-50 transition-all shadow-[0_2px_8px_rgba(168,152,120,0.2)] cursor-pointer"
              >
                {isLoading ? <Sparkles className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              </button>
            </div>

            {/* Custom per-query model & config selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Document Scoping Selector */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider font-mono flex items-center gap-1">
                    <FileText className="h-2.5 w-2.5 text-beige-600 dark:text-beige-400" />
                    <span>Document Scope</span>
                  </label>
                  {selectedSource !== 'all' && (
                    <span className="text-[8px] text-beige-600 dark:text-beige-400 font-mono font-bold">Scoped</span>
                  )}
                </div>
                <div className="relative flex items-center">
                  <select
                    value={selectedSource}
                    onChange={(e) => setSelectedSource(e.target.value)}
                    className={`w-full bg-white/40 dark:bg-stone-800/40 border ${selectedSource !== 'all' ? 'border-beige-400 dark:border-beige-500 font-medium' : 'border-white/50 dark:border-stone-700'} backdrop-blur-md text-stone-800 dark:text-stone-200 text-[11px] rounded-lg pl-2 pr-7 py-1.5 focus:outline-none focus:border-beige-400 dark:focus:border-stone-500 cursor-pointer appearance-none truncate`}
                  >
                    <option value="all" className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">
                      All Documents (Global)
                    </option>
                    {availableDocs.map((doc) => (
                      <option key={doc} value={doc} className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">
                        {doc}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 h-3 w-3 text-stone-500 dark:text-stone-400 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider font-mono">Provider</label>
                <div className="relative flex items-center">
                  <select
                    value={localProvider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    className="w-full bg-white/40 dark:bg-stone-800/40 border border-white/50 dark:border-stone-700 backdrop-blur-md text-stone-800 dark:text-stone-200 text-[11px] rounded-lg pl-2 pr-7 py-1.5 focus:outline-none focus:border-beige-400 dark:focus:border-stone-500 cursor-pointer appearance-none"
                  >
                    <option value="openai" className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">OpenAI</option>
                    <option value="anthropic" className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">Anthropic</option>
                    <option value="google" className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">Google Gemini</option>
                    <option value="groq" className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">Groq</option>
                    <option value="openrouter" className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">OpenRouter</option>
                    <option value="ollama" className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">Ollama (Local)</option>
                  </select>
                  <ChevronDown className="absolute right-2 h-3 w-3 text-stone-500 dark:text-stone-400 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider font-mono">Model Name</label>
                <input
                  type="text"
                  value={localModel}
                  onChange={(e) => setLocalModel(e.target.value)}
                  className="bg-white/40 dark:bg-stone-800/40 border border-white/50 dark:border-stone-700 backdrop-blur-md text-stone-800 dark:text-stone-200 text-[11px] rounded-lg px-2 py-1.5 focus:outline-none focus:border-beige-400 dark:focus:border-stone-500 font-mono"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider font-mono">Top-k Chunks</label>
                <div className="relative flex items-center">
                  <select
                    value={topK}
                    onChange={(e) => setTopK(e.target.value)}
                    className="w-full bg-white/40 dark:bg-stone-800/40 border border-white/50 dark:border-stone-700 backdrop-blur-md text-stone-800 dark:text-stone-200 text-[11px] rounded-lg pl-2 pr-7 py-1.5 focus:outline-none focus:border-beige-400 dark:focus:border-stone-500 cursor-pointer appearance-none"
                  >
                    <option value={2} className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">2 Chunks</option>
                    <option value={4} className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">4 Chunks</option>
                    <option value={6} className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">6 Chunks</option>
                    <option value={8} className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">8 Chunks</option>
                  </select>
                  <ChevronDown className="absolute right-2 h-3 w-3 text-stone-500 dark:text-stone-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </form>

          {/* Answer Display */}
          <div className="flex-1 flex flex-col">
            <div className="text-[11px] font-bold text-stone-500 dark:text-stone-400 tracking-wider uppercase font-mono mb-2 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-beige-600 dark:text-beige-400" />
              <span>LLM Generated Response</span>
            </div>
            <div className="flex-1 bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-700 rounded-xl p-4 overflow-y-auto text-xs text-stone-800 dark:text-stone-200 leading-relaxed font-sans select-text">
              {isLoading ? (
                <div className="flex items-center gap-2 text-stone-400 dark:text-stone-500 italic">
                  <Sparkles className="h-3.5 w-3.5 animate-spin" />
                  <span>Synthesizing retrieval answer...</span>
                </div>
              ) : answer ? (
                <MarkdownFormatter text={answer} />
              ) : (
                <span className="text-stone-400 dark:text-stone-500 italic">Submit a search query above to synthesize answers from indexed contexts.</span>
              )}
            </div>
          </div>

        </GlassCard>

      </div>

      {/* Right Column: Chunk Viewer */}
      <div className="w-full md:w-[380px] shrink-0 h-full overflow-hidden flex flex-col">
        <GlassCard className="h-full p-5! flex flex-col rounded-2xl">
          <ChunkViewer chunks={chunks} />
        </GlassCard>
      </div>

    </div>
  );
};

export default RAGPanel;

