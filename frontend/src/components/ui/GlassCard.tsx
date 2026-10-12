import { useRef, type HTMLAttributes, type MouseEvent, type ReactNode } from 'react';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
}

/** Frosted dark panel with a soft ice-blue glow that follows the pointer. */
export const GlassCard = ({ children, className = '', contentClassName = '', ...props }: GlassCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Writes CSS variables directly instead of setting state, so hovering never re-renders the card's children
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--gx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--gy', `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`group/glass relative min-h-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl transition-colors duration-300 hover:border-white/[0.12] ${className}`}
      {...props}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 z-20 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-0 transition-opacity duration-500 group-hover/glass:opacity-100"
        style={{ background: 'radial-gradient(260px circle at var(--gx, 50%) var(--gy, 50%), rgba(124,182,234,0.09), transparent 70%)' }}
      />
      <div className={`relative z-10 h-full w-full min-h-0 ${contentClassName || 'p-6'}`}>{children}</div>
    </div>
  );
};

export default GlassCard;
