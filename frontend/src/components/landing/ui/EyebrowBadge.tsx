type Props = { children: React.ReactNode; className?: string };

export function EyebrowBadge({ children, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.22em] backdrop-blur-md ${className}`}
      style={{
        color: "var(--accent)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 24px -8px rgba(212,162,47,0.25)",
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{
          backgroundColor: "var(--accent)",
          boxShadow: "0 0 10px rgba(212,162,47,0.85)",
        }}
      />
      {children}
    </span>
  );
}
