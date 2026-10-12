import { useEffect } from 'react';
import Lenis from 'lenis';
import { scrollState } from '../lib/scrollState';

let instance: Lenis | null = null;

/** The active Lenis instance (null when smooth scrolling isn't mounted). */
export const getLenis = () => instance;

/** Smoothly scrolls to a selector, element, or pixel offset; falls back to native scrolling. */
export function scrollToTarget(target: string | HTMLElement | number, offset = 0) {
  if (instance) {
    instance.scrollTo(target, { offset, duration: 1.6 });
    return;
  }
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (typeof el === 'number') window.scrollTo({ top: el + offset, behavior: 'smooth' });
  else if (el instanceof HTMLElement) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: 'smooth' });
}

/**
 * Smooth (inertial) page scrolling. Lenis drives the native scroll position, so
 * framer-motion's useScroll and IntersectionObservers keep working unchanged.
 */
export const useLenis = () => {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      duration: 1.25,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
    });
    instance = lenis;

    const onScroll = (l: Lenis) => {
      scrollState.y = l.scroll;
      scrollState.velocity = l.velocity;
    };
    lenis.on('scroll', onScroll);

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      // Let velocity decay to zero once scrolling stops (Lenis stops emitting events)
      if (!lenis.isScrolling) scrollState.velocity *= 0.9;
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      if (instance === lenis) instance = null;
      scrollState.velocity = 0;
    };
  }, []);
};
