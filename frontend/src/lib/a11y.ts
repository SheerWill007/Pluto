import type { KeyboardEvent } from 'react';

/**
 * Props that make a non-button element (e.g. a list row that contains its own nested
 * buttons, so it can't itself be a <button>) behave like a button for keyboard and
 * screen-reader users.
 */
export const clickableProps = (onActivate: () => void, opts: { selected?: boolean; label?: string } = {}) => ({
  role: 'button' as const,
  tabIndex: 0,
  'aria-pressed': opts.selected,
  'aria-label': opts.label,
  onClick: onActivate,
  onKeyDown: (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return; // let nested controls handle their own keys
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate();
    }
  },
});
