import React from 'react';

export const MarkdownFormatter = ({ text = '' }) => {
  if (!text) return null;

  // Helper to parse inline styles: bold (**text**), inline code (`code`), links ([text](url))
  const parseInline = (line) => {
    // Regex matches bold (**bold**), inline code (`code`), and links ([text](url))
    const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
    const tokens = line.split(regex);
    
    return tokens.map((token, i) => {
      if (token.startsWith('**') && token.endsWith('**')) {
        return <strong key={i} className="font-bold text-stone-900 dark:text-stone-100">{token.slice(2, -2)}</strong>;
      }
      if (token.startsWith('`') && token.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.5 mx-0.5 rounded bg-amber-500/10 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono text-[10.5px] font-semibold border border-amber-500/10 dark:border-amber-500/20">
            {token.slice(1, -1)}
          </code>
        );
      }
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        return (
          <a
            key={i}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 underline font-medium transition-colors"
          >
            {linkMatch[1]}
          </a>
        );
      }
      return token;
    });
  };

  // Split content by block-level code boxes: ```
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2.5 font-sans text-stone-800 dark:text-stone-200 text-xs">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          // Code Block
          const lines = part.split('\n');
          const firstLine = lines[0].replace('```', '').trim();
          const language = firstLine || 'code';
          const codeContent = lines.slice(1, -1).join('\n');

          return (
            <div key={index} className="my-3.5 rounded-xl border border-stone-200/60 dark:border-stone-700 overflow-hidden bg-stone-900 text-stone-100 shadow-[0_4px_12px_rgba(0,0,0,0.08)] font-mono text-[11px]">
              <div className="flex items-center justify-between px-4 py-2 bg-stone-850 border-b border-stone-800/80 text-[10px] text-stone-400 font-bold uppercase tracking-wider shrink-0 select-none">
                <span>{language}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(codeContent)}
                  className="hover:text-white transition-colors text-[9px] px-2 py-0.5 rounded bg-stone-800 border border-stone-700/50 hover:bg-stone-700 cursor-pointer"
                >
                  Copy
                </button>
              </div>
              <pre className="p-4 overflow-x-auto leading-relaxed select-text bg-stone-950/40">
                <code>{codeContent}</code>
              </pre>
            </div>
          );
        } else {
          // Standard text block. Split into lines
          const lines = part.split('\n');
          const elements = [];
          let currentList = [];

          const flushList = (key) => {
            if (currentList.length > 0) {
              elements.push(
                <ul key={key} className="list-disc pl-5 my-2 space-y-1 text-stone-700 dark:text-stone-300">
                  {currentList.map((li, idx) => (
                    <li key={idx} className="leading-relaxed">{parseInline(li)}</li>
                  ))}
                </ul>
              );
              currentList = [];
            }
          };

          lines.forEach((line, lineIdx) => {
            const trimmed = line.trim();

            // Headers (# Title)
            if (trimmed.startsWith('#')) {
              flushList(`list-${lineIdx}`);
              const level = (trimmed.match(/^#+/) || ['#'])[0].length;
              const textContent = trimmed.replace(/^#+\s*/, '');
              const sizeClass = level === 1 ? 'text-sm font-bold mt-4 mb-2' : level === 2 ? 'text-xs font-bold mt-3 mb-1.5' : 'text-[11px] font-bold mt-2.5 mb-1';
              elements.push(
                <h4 key={`h-${lineIdx}`} className={`${sizeClass} text-stone-900 dark:text-stone-100 font-sans uppercase tracking-wide`}>
                  {parseInline(textContent)}
                </h4>
              );
            }
            // Bullet list items (- item)
            else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
              const textContent = trimmed.substring(2);
              currentList.push(textContent);
            }
            // Numbered list items (1. item)
            else if (/^\d+\.\s+/.test(trimmed)) {
              flushList(`list-${lineIdx}`);
              const textContent = trimmed.replace(/^\d+\.\s+/, '');
              elements.push(
                <div key={`ol-${lineIdx}`} className="flex items-start gap-2 my-1.5 pl-2 leading-relaxed text-stone-700 dark:text-stone-300">
                  <span className="font-bold text-amber-600 dark:text-amber-400 font-mono text-[10px] mt-0.5 shrink-0 select-none">
                    {trimmed.match(/^\d+/)[0]}.
                  </span>
                  <div>{parseInline(textContent)}</div>
                </div>
              );
            }
            // Empty line
            else if (trimmed === '') {
              flushList(`list-${lineIdx}`);
            }
            // Blockquotes (> block)
            else if (trimmed.startsWith('>')) {
              flushList(`list-${lineIdx}`);
              const textContent = trimmed.replace(/^>\s*/, '');
              elements.push(
                <blockquote key={`bq-${lineIdx}`} className="pl-3 border-l-2 border-amber-500/40 text-stone-500 dark:text-stone-400 italic my-2 bg-amber-500/5 dark:bg-amber-500/10 py-1.5 px-2 rounded-r-md">
                  {parseInline(textContent)}
                </blockquote>
              );
            }
            // Paragraph line
            else {
              flushList(`list-${lineIdx}`);
              elements.push(
                <p key={`p-${lineIdx}`} className="leading-relaxed mb-1.5 text-stone-700 dark:text-stone-300">
                  {parseInline(line)}
                </p>
              );
            }
          });

          // Flush any final list items
          flushList(`list-final`);
          return elements;
        }
      })}
    </div>
  );
};

export default MarkdownFormatter;
