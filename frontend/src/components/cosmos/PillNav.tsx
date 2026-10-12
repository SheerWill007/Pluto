import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

export interface PillNavItem {
  id: string;
  label: string;
  onClick: () => void;
}

interface PillNavProps {
  items: PillNavItem[];
  activeId?: string;
  /** Rendered after the divider, e.g. "Sign in" or the account menu */
  action?: ReactNode;
  onLogoClick?: () => void;
  className?: string;
}

/** The monogram: a serif "P" inside an ice-blue ring. */
export function PlutoMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="relative grid place-items-center rounded-full border border-beige-400/70 bg-black shadow-[0_0_18px_-4px_rgba(124,182,234,0.8),inset_0_0_10px_rgba(124,182,234,0.25)]"
      style={{ width: size, height: size }}
    >
      <span className="font-display italic text-white leading-none" style={{ fontSize: size * 0.52 }}>P</span>
    </span>
  );
}

/** Floating capsule navigation, as in the hero reference: mark · links | action. */
export function PillNav({ items, activeId, action, onLogoClick, className = '' }: PillNavProps) {
  return (
    <nav
      aria-label="Primary"
      className={`flex max-w-[calc(100vw-1.5rem)] items-center gap-1 rounded-full border border-white/10 bg-black/75 p-1.5 pr-2 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl ${className}`}
    >
      <button type="button" onClick={onLogoClick} aria-label="Pluto home" className="mr-1 shrink-0 rounded-full">
        <PlutoMark />
      </button>
      <ul className="flex min-w-0 items-center overflow-x-auto [scrollbar-width:none]">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id} className="relative shrink-0">
              <button
                type="button"
                onClick={item.onClick}
                aria-current={active ? 'page' : undefined}
                className={`relative z-10 whitespace-nowrap rounded-full px-2.5 py-2 text-[12px] font-medium transition-colors sm:px-4 sm:text-[13px] ${
                  active ? 'text-white' : 'text-white/55 hover:text-white/90'
                }`}
              >
                {item.label}
              </button>
              {active && (
                <motion.span
                  layoutId="pill-nav-active"
                  className="absolute inset-0 rounded-full bg-white/[0.08]"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
            </li>
          );
        })}
      </ul>
      {action && (
        <>
          <span className="mx-1.5 h-5 w-px shrink-0 bg-white/15" aria-hidden="true" />
          <div className="shrink-0">{action}</div>
        </>
      )}
    </nav>
  );
}

export default PillNav;
