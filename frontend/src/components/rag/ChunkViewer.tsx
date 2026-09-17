import React from 'react';
import { Layers, FileText, Bookmark } from 'lucide-react';
import GlassCard from '../ui/GlassCard';

export const ChunkViewer = ({ chunks }) => {
  if (!chunks || chunks.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-stone-400 dark:text-stone-500 font-sans p-6 text-center select-none border border-stone-200/50 dark:border-stone-700 rounded-2xl bg-stone-50/50 dark:bg-stone-900/40">
        <Bookmark className="h-8 w-8 mb-2 opacity-30" />
        <span className="text-xs font-semibold">No chunks retrieved yet</span>
        <span className="text-[10px] opacity-60">Submit a query to inspect vector database contexts</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1">
      <div className="flex items-center gap-2 text-xs font-extrabold text-beige-600 dark:text-beige-400 tracking-wider font-sans uppercase mb-1">
        <Layers className="h-4 w-4" />
        <span>Retrieved Context Chunks ({chunks.length})</span>
      </div>

      <div className="flex flex-col gap-4">
        {chunks.map((chunk, idx) => {
          let scoreText = 'N/A';
          if (chunk.score !== null && chunk.score !== undefined) {
            const scoreVal = parseFloat(chunk.score);
            scoreText = scoreVal.toFixed(3);
          }

          const fileSource = chunk.source ? chunk.source.split('/').pop() : 'Unknown doc';

          return (
            <GlassCard key={idx} className="p-4! border-stone-200/40 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600 transition-all bg-white/80 dark:bg-stone-900/80">
              {/* Chunk Header Info */}
              <div className="flex items-center justify-between text-[11px] font-mono text-stone-500 dark:text-stone-400 border-b border-stone-100 dark:border-stone-800 pb-2 mb-2">
                <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                  <FileText className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500 shrink-0" />
                  <span className="truncate font-semibold text-stone-700 dark:text-stone-200" title={chunk.source}>
                    {fileSource}
                  </span>
                </div>
                
                <div className="flex items-center gap-1 bg-beige-150 dark:bg-stone-800 text-beige-700 dark:text-beige-300 px-2 py-0.5 rounded-full border border-beige-200/50 dark:border-stone-700">
                  <span>Score:</span>
                  <span className="font-bold">{scoreText}</span>
                </div>
              </div>

              {/* Chunk Content Text */}
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed font-sans select-text whitespace-pre-wrap">
                {chunk.content}
              </p>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
};

export default ChunkViewer;
