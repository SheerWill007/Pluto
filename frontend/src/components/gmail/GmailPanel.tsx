import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore, llmFields } from '../../store/useAppStore';
import { useAgentStore } from '../../store/useAgentStore';
import EmailList from './EmailList';
import SummaryCard from './SummaryCard';
import { apiFetch, errorMessage } from '../../lib/api';
import GlassCard from '../ui/GlassCard';
import { Mail, LogIn, RefreshCw, LogOut } from 'lucide-react';

interface Email {
  id: string;
  subject: string;
  sender: string;
  date: string;
  snippet: string;
  body?: string;
}

const CONNECT_POLL_MS = 3000;
const CONNECT_TIMEOUT_MS = 120_000;
const SUMMARY_TIMEOUT_MS = 120_000;

/** Delays a fast-changing value (e.g. a search box) so we don't refetch on every keystroke. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export const GmailPanel = () => {
  const user = useAppStore((s) => s.user);
  const { setNodeActive, clearActiveNodes } = useAgentStore();
  const isGuest = user?.auth_provider === 'guest';

  const [connected, setConnected] = useState(false);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeEmail, setActiveEmail] = useState<Email | null>(null);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const [labelFilter, setLabelFilter] = useState('INBOX');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounced(searchQuery, 400);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };
  useEffect(() => stopPolling, []);

  const checkGmailStatus = useCallback(async () => {
    if (!user?.token || isGuest) return false;
    try {
      const data = await apiFetch<{ connected: boolean }>('/gmail/status');
      setConnected(!!data.connected);
      return !!data.connected;
    } catch {
      setConnected(false);
      return false;
    }
  }, [user?.token, isGuest]);

  const fetchEmailsList = useCallback(async () => {
    if (!user?.token || isGuest) return;
    setIsLoading(true);
    setNodeActive('gmail_agent', true);
    try {
      const data = await apiFetch<Email[]>('/gmail/list', {
        query: { max_results: 12, label: labelFilter, q: debouncedSearch.trim() || undefined },
      });
      setEmails(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load emails.'));
    } finally {
      setIsLoading(false);
      setTimeout(() => clearActiveNodes(), 1500);
    }
  }, [user?.token, isGuest, labelFilter, debouncedSearch, setNodeActive, clearActiveNodes]);

  useEffect(() => {
    (async () => {
      if (await checkGmailStatus()) fetchEmailsList();
    })();
  }, [checkGmailStatus, fetchEmailsList]);

  const handleConnect = async () => {
    setIsLoading(true);
    setError('');
    setNodeActive('gmail_agent', true);
    try {
      const data = await apiFetch<{ auth_url: string }>('/gmail/connect');
      window.open(data.auth_url, '_blank', 'noopener');
      setIsConnecting(true);

      // Poll until the OAuth callback has stored the token, or give up after a while
      const started = Date.now();
      stopPolling();
      pollRef.current = setInterval(async () => {
        if (await checkGmailStatus()) {
          stopPolling();
          setIsConnecting(false);
          fetchEmailsList();
        } else if (Date.now() - started > CONNECT_TIMEOUT_MS) {
          stopPolling();
        }
      }, CONNECT_POLL_MS);
    } catch (err) {
      setError(errorMessage(err, 'Failed to start the Gmail connection.'));
    } finally {
      setIsLoading(false);
      setTimeout(() => clearActiveNodes(), 1000);
    }
  };

  const handleManualRefreshAfterConnect = async () => {
    if (await checkGmailStatus()) {
      stopPolling();
      setIsConnecting(false);
      fetchEmailsList();
    }
  };

  const handleDisconnect = async () => {
    try {
      await apiFetch('/gmail/disconnect', { method: 'POST' });
      setConnected(false);
      setEmails([]);
      setActiveEmail(null);
      setSummary('');
    } catch (err) {
      setError(`Failed to disconnect: ${errorMessage(err)}`);
    }
  };

  const summarize = async (emailIds: string[]) => {
    setIsSummarizing(true);
    setNodeActive('gmail_agent', true);
    setNodeActive('orchestrator', true);
    setSummary('');
    try {
      const data = await apiFetch<{ summary: string }>('/gmail/summarize', {
        json: { email_ids: emailIds, ...llmFields() },
        timeoutMs: SUMMARY_TIMEOUT_MS,
      });
      setSummary(data.summary);
    } catch (err) {
      setSummary(`Summary failed: ${errorMessage(err)}`);
    } finally {
      setIsSummarizing(false);
      setTimeout(() => clearActiveNodes(), 1500);
    }
  };

  const handleSummarizeSingle = (msgId: string) => summarize([msgId]);

  const handleBulkSummarize = async () => {
    if (selectedIds.length === 0) return;
    setActiveEmail(null); // show the combined digest instead of a single email
    await summarize(selectedIds);
  };

  const handleEmailClick = (email: Email) => {
    setActiveEmail(email);
    setSummary('');
  };

  if (isGuest) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 h-full">
        <GlassCard className="max-w-md w-full p-8! text-center flex flex-col items-center rounded-3xl">
          <Mail className="h-10 w-10 text-beige-600 dark:text-beige-400 mb-4" />
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-2">Gmail requires an account</h2>
          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
            Guest sessions are temporary, so they can&apos;t be linked to a mailbox. Sign in or create an account to connect Gmail.
          </p>
        </GlassCard>
      </div>
    );
  }

  // If not authenticated, show OAuth flow landing page
  if (!connected) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 h-full">
        <GlassCard className="max-w-md w-full p-8! text-center flex flex-col items-center rounded-3xl border-stone-200 dark:border-stone-700 bg-white/70 dark:bg-stone-900/70">
          <div className="p-4 rounded-full bg-beige-150 dark:bg-stone-800 mb-6 border border-beige-200 dark:border-stone-700">
            <Mail className="h-10 w-10 text-beige-600 dark:text-beige-400" />
          </div>

          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-2 font-sans tracking-wide">
            Gmail Agent Integration
          </h2>
          
          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed mb-6 font-sans">
            Connect your Google Workspace or Gmail account to securely view, summarize, and manage your emails with AI.
          </p>

          <button
            onClick={handleConnect}
            disabled={isLoading || isConnecting}
            className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl bg-gradient-to-r from-beige-400 to-beige-600 hover:from-beige-300 hover:to-beige-500 text-white font-semibold text-xs transition-all disabled:opacity-50 shadow-[0_4px_16px_rgba(168,152,120,0.2)]"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            <span>Connect Gmail Account</span>
          </button>

          {error && (
            <p role="alert" className="mt-4 w-full text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-2">{error}</p>
          )}

          {isConnecting && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex flex-col gap-2 w-full text-center">
              <p>A new tab was opened for Google sign-in. Complete the consent flow there, then click:</p>
              <button
                onClick={handleManualRefreshAfterConnect}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-xs self-center transition-colors"
              >
                I've connected, refresh
              </button>
            </div>
          )}
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-6 p-6 h-full min-h-0 overflow-hidden">
      
      {/* Left Column: Email Rows list */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <GlassCard className="h-full p-5! flex flex-col rounded-2xl">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-500 dark:text-stone-400 tracking-wider uppercase font-mono">
              <Mail className="h-4 w-4 text-beige-600 dark:text-beige-400" />
              <span>Inbox Navigator</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={fetchEmailsList}
                disabled={isLoading}
                className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                title="Refresh Inbox"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleDisconnect}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-stone-400 dark:text-stone-500 hover:text-red-600 dark:hover:text-red-400 text-xs font-medium transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800"
                title="Disconnect Gmail"
              >
                <LogOut className="h-3 w-3" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="mb-3 shrink-0 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-2">{error}</p>
          )}

          <EmailList 
            emails={emails}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            onEmailClick={handleEmailClick}
            onBulkSummarize={handleBulkSummarize}
            isLoading={isSummarizing}
            labelFilter={labelFilter}
            setLabelFilter={setLabelFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        </GlassCard>
      </div>

      {/* Right Column: Digest Summary Sidebar */}
      <div className="w-full md:w-[380px] shrink-0 h-full min-h-0 overflow-hidden flex flex-col">
        <SummaryCard 
          email={activeEmail}
          summary={summary}
          onSummarize={handleSummarizeSingle}
          isLoading={isSummarizing}
        />
      </div>

    </div>
  );
};

export default GmailPanel;
