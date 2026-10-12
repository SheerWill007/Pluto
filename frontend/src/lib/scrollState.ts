/**
 * Scroll signals shared between Lenis and the WebGL backgrounds. Written by the Lenis
 * scroll listener, read every animation frame by the canvases -- a plain mutable object
 * avoids re-rendering React on every scroll tick.
 */
export const scrollState = {
  /** Page scroll position in pixels */
  y: 0,
  /** Lenis velocity (pixels per frame, signed) */
  velocity: 0,
  /** 0..1 progress through the hero "dive" (set by the landing page) */
  dive: 0,
};
