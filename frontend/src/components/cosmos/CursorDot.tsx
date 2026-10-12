import { useEffect, useRef } from 'react';

/**
 * A small white dot that trails the pointer and swells over interactive elements.
 * The native cursor stays visible; this is an accent, not a replacement. Disabled on
 * touch devices and for reduced-motion users.
 */
export function CursorDot() {
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    if (!dot) return;
    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) {
      dot.style.display = 'none';
      return;
    }

    const pos = { x: -100, y: -100, tx: -100, ty: -100, scale: 1, tscale: 1 };
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      pos.tx = e.clientX;
      pos.ty = e.clientY;
      const target = e.target as Element | null;
      pos.tscale = target?.closest('a, button, [role="button"], input, textarea, select, label') ? 2.6 : 1;
      dot.style.opacity = '1';
    };
    const onLeave = () => {
      dot.style.opacity = '0';
    };

    const tick = () => {
      pos.x += (pos.tx - pos.x) * 0.2;
      pos.y += (pos.ty - pos.y) * 0.2;
      pos.scale += (pos.tscale - pos.scale) * 0.15;
      dot.style.transform = `translate3d(${pos.x - 4}px, ${pos.y - 4}px, 0) scale(${pos.scale})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div
      ref={dotRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[100] h-2 w-2 rounded-full bg-white opacity-0 mix-blend-difference transition-opacity duration-300"
    />
  );
}

export default CursorDot;
