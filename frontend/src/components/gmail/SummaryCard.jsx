import React from 'react';
import { Mail, Clock, Calendar, Sparkles, BookOpen, User } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import MarkdownFormatter from '../ui/MarkdownFormatter';

export const SummaryCard = ({ email, summary, onSummarize, isLoading }) => {
  if (!email && !summary) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-stone-400 dark:text-stone-500 font-sans p-6 text-center select-none border border-stone-200/50 dark:border-stone-700 rounded-2xl bg-stone-50/50 dark:bg-stone-900/40">
        <Mail className="h-8 w-8 mb-2 opacity-30 animate-pulse" />
        <span className="text-xs font-semibold">Select an email to view</span>
        <span className="text-[10px] opacity-60">Or perform a bulk summary on selected checkmarked items</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pr-1">
      {/* Active Email Card details */}
      {email && (
        <GlassCard className="p-4! border-stone-200/50 dark:border-stone-700 shrink-0 bg-white/80 dark:bg-stone-900/80">
          <div className="flex items-center gap-2 mb-3 border-b border-stone-100 dark:border-stone-800 pb-2 text-stone-500 dark:text-stone-400 font-mono text-[10px] font-bold tracking-wider uppercase">
            <Mail className="h-3.5 w-3.5 text-beige-600 dark:text-beige-400" />
            <span>Email Header Details</span>
          </div>

          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-start gap-2">
              <User className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-stone-400 dark:text-stone-500">From:</span>{' '}
                <span className="font-semibold text-stone-800 dark:text-stone-200">{email.sender}</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-stone-400 dark:text-stone-500">Date:</span>{' '}
                <span className="text-stone-600 dark:text-stone-300 font-mono">{email.date}</span>
              </div>
            </div>

            <div className="mt-2">
              <h3 className="font-bold text-stone-900 dark:text-stone-100 text-sm">{email.subject}</h3>
            </div>
            
            <div className="mt-3 bg-stone-50 dark:bg-stone-800/60 p-3 rounded-lg border border-stone-200/60 dark:border-stone-700">
              <p className="text-stone-600 dark:text-stone-300 leading-relaxed max-h-40 overflow-y-auto text-[11px]">
                {email.body || email.snippet}
              </p>
            </div>

            {/* Summarize current email button */}
            {!summary && (
              <button
                onClick={() => onSummarize(email.id)}
                disabled={isLoading}
                className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-beige-500 hover:bg-beige-400 text-white font-semibold text-xs transition-all disabled:opacity-50 shadow-[0_4px_12px_rgba(168,152,120,0.25)]"
              >
                {isLoading ? (
                  <>
                    <Clock className="h-3.5 w-3.5 animate-spin" />
                    <span>Summarizing Email...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Summarize This Email</span>
                  </>
                )}
              </button>
            )}
          </div>
        </GlassCard>
      )}

      {/* AI Summary digest block */}
      {(summary || isLoading) && (
        <GlassCard className="p-4! border-stone-200/50 dark:border-stone-700 flex-1 min-h-0 flex flex-col bg-white/80 dark:bg-stone-900/80"  contentClassName="flex-1 min-h-0 flex flex-col p-4!">
          <div className="flex items-center gap-2 mb-3 border-b border-stone-100 dark:border-stone-800 pb-2 text-beige-600 dark:text-beige-400 font-mono text-[10px] font-bold tracking-wider uppercase">
            <BookOpen className="h-3.5 w-3.5 text-beige-600 dark:text-beige-400" />
            <span>AI Email Digest</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto text-xs text-stone-700 dark:text-stone-300 leading-relaxed font-sans select-text">
            {isLoading ? (
              <div className="flex items-center gap-2 text-stone-400 dark:text-stone-500 italic p-2">
                <Sparkles className="h-3.5 w-3.5 animate-spin text-beige-600 dark:text-beige-400" />
                <span>Running Gmail Agent summary...</span>
              </div>
            ) : (
              <div className="p-1">
                <MarkdownFormatter text={summary} />
              </div>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
};

export default SummaryCard;
