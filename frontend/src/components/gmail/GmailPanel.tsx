import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useAgentStore } from '../../store/useAgentStore';
import EmailList from './EmailList';
import SummaryCard from './SummaryCard';
import { API_URL } from '../../lib/api';
import GlassCard from '../ui/GlassCard';
import { Mail, Sparkles, LogIn, RefreshCw, Check, LogOut } from 'lucide-react';

export const GmailPanel = () => {
  const { apiKey, activeProvider, modelName, user } = useAppStore();
  const { setNodeActive, clearActiveNodes } = useAgentStore();

  const [connected, setConnected] = useState(false);
  const [emails, setEmails] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  
  const [activeEmail, setActiveEmail] = useState(null);
  const [summary, setSummary] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const [labelFilter, setLabelFilter] = useState('INBOX');
  const [searchQuery, setSearchQuery] = useState('');

  const checkGmailStatus = async () => {
    if (!user?.token) return false;
    try {
      const response = await fetch(`${API_URL}/api/v1/gmail/status`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        const isConn = !!data.connected;
        setConnected(isConn);
        return isConn;
      }
      setConnected(false);
      return false;
    } catch (err) {
      console.error('Error checking Gmail status:', err);
      setConnected(false);
      return false;
    }
  };

  const fetchEmailsList = async () => {
    if (!user?.token) return;
    setIsLoading(true);
    setNodeActive('gmail_agent', true);

    try {
      // Build query string params
      let url = `${API_URL}/api/v1/gmail/list?max_results=12&label=${labelFilter}`;
      if (searchQuery.trim()) {
        url += `&q=${encodeURIComponent(searchQuery.trim())}`;
      }

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setEmails(data);
        } else {
          console.warn('Gmail list returned non-array:', data);
        }
      }
    } catch (error) {
      console.warn('Error fetching emails list:', error);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        clearActiveNodes();
      }, 1500);
    }
  };

  // Check Gmail connection status on mount and load emails if connected
  useEffect(() => {
    const init = async () => {
      const isConn = await checkGmailStatus();
      if (isConn) {
        fetchEmailsList();
      }
    };
    init();
  }, [labelFilter, searchQuery, user?.token]);

  const handleConnect = async () => {
    setIsLoading(true);
    setNodeActive('gmail_agent', true);

    try {
      const response = await fetch(`${API_URL}/api/v1/gmail/connect`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to initiate Gmail connection.');
      }

      const data = await response.json();
      if (data.auth_url) {
        window.open(data.auth_url, '_blank');
        setIsConnecting(true);

        // Automatically poll /api/v1/gmail/status every 3 seconds for up to 30 seconds
        let elapsed = 0;
        const pollInterval = setInterval(async () => {
          elapsed += 3;
          const isConn = await checkGmailStatus();
          if (isConn) {
            clearInterval(pollInterval);
            setIsConnecting(false);
            fetchEmailsList();
          } else if (elapsed >= 30) {
            clearInterval(pollInterval);
            setIsConnecting(false);
          }
        }, 3000);
      }
    } catch (error) {
      alert(`Gmail connection error: ${error.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        clearActiveNodes();
      }, 1000);
    }
  };

  const handleManualRefreshAfterConnect = async () => {
    const isConn = await checkGmailStatus();
    if (isConn) {
      setIsConnecting(false);
      fetchEmailsList();
    }
  };

  const handleDisconnect = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/gmail/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        }
      });
      if (response.ok) {
        setConnected(false);
        setEmails([]);
        setActiveEmail(null);
        setSummary('');
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(`Failed to disconnect: ${errData.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error disconnecting Gmail:', err);
      alert(`Failed to disconnect: ${err.message}`);
    }
  };

  // Summarize single email
  const handleSummarizeSingle = async (msgId) => {
    setIsSummarizing(true);
    setNodeActive('gmail_agent', true);
    setNodeActive('orchestrator', true);
    setSummary('');

    try {
      const response = await fetch(`${API_URL}/api/v1/gmail/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({
          email_ids: [msgId],
          provider: activeProvider,
          model: modelName,
          api_key: (apiKey && apiKey.trim()) ? apiKey.trim() : null
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Summarize query failed.');
      }
      const data = await response.json();
      setSummary(data.summary);
    } catch (error) {
      console.error(error);
      setSummary(`Summary failed: ${error.message}`);
    } finally {
      setIsSummarizing(false);
      setTimeout(() => {
        clearActiveNodes();
      }, 1500);
    }
  };

  // Bulk summarize multiple selected checkmarked emails
  const handleBulkSummarize = async () => {
    if (selectedIds.length === 0) return;
    
    setIsSummarizing(true);
    setNodeActive('gmail_agent', true);
    setNodeActive('orchestrator', true);
    setActiveEmail(null); // Clear selected single email to show general bulk summary
    setSummary('');

    try {
      const response = await fetch(`${API_URL}/api/v1/gmail/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({
          email_ids: selectedIds,
          provider: activeProvider,
          model: modelName,
          api_key: (apiKey && apiKey.trim()) ? apiKey.trim() : null
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Bulk summarize request failed.');
      }
      const data = await response.json();
      setSummary(data.summary);
    } catch (error) {
      console.error(error);
      setSummary(`Bulk summary failed: ${error.message}`);
    } finally {
      setIsSummarizing(false);
      setTimeout(() => {
        clearActiveNodes();
      }, 1500);
    }
  };

  const handleEmailClick = (email) => {
    setActiveEmail(email);
    setSummary(''); // Clear previous summary so they can generate for this new one
  };

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
