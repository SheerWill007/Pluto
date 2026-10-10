import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Slide from './Slide';
import { SLIDES } from './slides';

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown', ' ']);
const PREV_KEYS = new Set(['ArrowLeft', 'ArrowUp']);
const SWIPE_THRESHOLD_PX = 50;

/**
 * Full-screen presentation deck. Every slide stays mounted (so background videos
 * preload); only opacity changes, and the black background means transitions fade
 * through black, never white.
 */
export function SlideDeck() {
  const [active, setActive] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const total = SLIDES.length;

  const goTo = useCallback((index: number) => setActive(Math.max(0, Math.min(total - 1, index))), [total]);
  const next = useCallback(() => setActive((i) => Math.min(total - 1, i + 1)), [total]);
  const prev = useCallback(() => setActive((i) => Math.max(0, i - 1)), []);

  // The app's page background is beige; paint the canvas black while the deck is shown so
  // overscroll bounce (macOS/iOS) can never flash a light color behind it
  useEffect(() => {
    const root = document.documentElement;
    const previous = { bg: document.body.style.backgroundColor, overscroll: root.style.overscrollBehavior };
    document.body.style.backgroundColor = '#000';
    root.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.backgroundColor = previous.bg;
      root.style.overscrollBehavior = previous.overscroll;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (NEXT_KEYS.has(e.key)) {
        e.preventDefault(); // stop Space/arrows from scrolling or activating a focused control
        next();
      } else if (PREV_KEYS.has(e.key)) {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [next, prev]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx <= -SWIPE_THRESHOLD_PX) next();
    else if (dx >= SWIPE_THRESHOLD_PX) prev();
  };

  return (
    <section
      className="relative h-dvh w-full overflow-hidden bg-black font-['Aeonik',sans-serif] text-white"
      aria-roledescription="carousel"
      aria-label="Pluto overview"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {SLIDES.map((slide, i) => (
        <Slide key={slide.id} slide={slide} index={i} total={total} isActive={i === active} />
      ))}

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 sm:px-12 md:px-20">
        <span className="text-sm font-medium tracking-[0.3em] text-white">PLUTO</span>
        <div className="pointer-events-auto flex items-center gap-6">
          <span className="text-xs tabular-nums text-white/50" aria-hidden="true">
            {String(active + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
          <Link to="/login" className="text-sm text-white/80 transition-colors hover:text-white">
            Sign in
          </Link>
        </div>
      </header>

      <nav className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2" aria-label="Slides">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}: ${slide.eyebrow}`}
            aria-current={i === active ? 'true' : undefined}
            className={`cursor-pointer rounded-full transition-all duration-300 ${
              i === active ? 'h-2 w-6 bg-white' : 'h-2 w-2 bg-white/40 hover:bg-white/60'
            }`}
          />
        ))}
      </nav>

      <p className="sr-only" aria-live="polite">
        Slide {active + 1} of {total}: {SLIDES[active].title}
      </p>
    </section>
  );
}

export default SlideDeck;
