import { Cpu, Clock, Layers, User, Wrench } from 'lucide-react';
import MarkdownFormatter from '../ui/MarkdownFormatter';
import type { ChatMessage } from '../../lib/types';

const TOOL_LABELS: Record<string, string> = {
  web_search: 'Web search',
  search_document: 'Documents',
  gmail_tool: 'Gmail',
  code_tool: 'Code pipeline',
};

export const MessageBubble = ({ message }: { message: ChatMessage }) => {
  const { role, content, model, tokens, latency, tools, streaming } = message;
  const isUser = role === 'user';

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div className={`max-w-[75%] flex flex-col gap-2`}>
        {/* Card Bubble */}
        <div
          className={`rounded-2xl px-5 py-3.5 backdrop-blur-md border text-sm leading-relaxed ${
            isUser
              ? 'bg-gradient-to-tr from-beige-150 to-beige-200/50 dark:from-stone-800 dark:to-stone-800/80 border-beige-200/60 dark:border-stone-700 text-stone-900 dark:text-stone-100 shadow-[0_4px_16px_rgba(168,152,120,0.06)] rounded-tr-none'
              : 'bg-white/90 dark:bg-stone-900/90 border-stone-200/60 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded-tl-none shadow-[0_4px_24px_rgba(0,0,0,0.04)]'
          }`}
        >
          {streaming && !content ? (
            <span className="inline-flex gap-1 py-1" aria-label="Assistant is typing">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
          ) : (
            <MarkdownFormatter text={content} />
          )}
        </div>

        {/* Info Badges */}
        <div className={`flex items-center gap-3 text-[10px] text-stone-500 dark:text-stone-400 font-mono select-none px-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
          {isUser ? (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3 text-stone-400 dark:text-stone-500" />
              <span>You</span>
            </div>
          ) : (
            <>
              {/* Model Used Badge */}
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-100/80 dark:bg-stone-800/80 border border-stone-200/40 dark:border-stone-700">
                <Cpu className="h-2.5 w-2.5 text-beige-600 dark:text-beige-400" />
                <span>{model || 'system'}</span>
              </div>
              
              {tools && tools.length > 0 && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 border border-amber-200/60 dark:border-amber-800/60" title="Tools used by the agent">
                  <Wrench className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" />
                  <span>{tools.map((t) => TOOL_LABELS[t] || t).join(', ')}</span>
                </div>
              )}

              {/* Token Count Badge */}
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-100/80 dark:bg-stone-800/80 border border-stone-200/40 dark:border-stone-700">
                <Layers className="h-2.5 w-2.5 text-beige-700 dark:text-beige-400" />
                <span>{tokens || 0} tokens</span>
              </div>

              {/* Latency Badge */}
              {!!latency && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-100/80 dark:bg-stone-800/80 border border-stone-200/40 dark:border-stone-700">
                  <Clock className="h-2.5 w-2.5 text-beige-600 dark:text-beige-400" />
                  <span>{latency}s</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
