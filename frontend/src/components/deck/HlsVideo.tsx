import { useEffect, useRef } from 'react';

interface HlsVideoProps {
  /** Mux playback ID (the part before `.m3u8` in https://stream.mux.com/<id>.m3u8) */
  playbackId: string;
  /** Only the active slide's video plays; the rest stay buffered and paused */
  active: boolean;
  className?: string;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Muted, looping background video streamed from Mux over HLS.
 * Plays through hls.js wherever Media Source Extensions exist; browsers without MSE
 * (older iOS) fall back to native HLS.
 */
export function HlsVideo({ playbackId, active, className = '' }: HlsVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const src = `https://stream.mux.com/${playbackId}.m3u8`;

  // Read by the async hls.js setup, which may finish after `active` has changed
  const activeRef = useRef(active);

  // Attach the stream once on mount so it preloads while the slide is still hidden
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const playIfActive = () => {
      if (activeRef.current && !prefersReducedMotion()) video.play().catch(() => {});
    };

    // Browsers without Media Source Extensions (older iOS) can only play HLS natively.
    // Everything else uses hls.js: canPlayType() answers "maybe" in some Chromium builds
    // that then fail to play, so it isn't a reliable signal on its own.
    const hasMse = 'MediaSource' in window || 'ManagedMediaSource' in window;
    if (!hasMse) {
      if (!video.canPlayType('application/vnd.apple.mpegurl')) return;
      video.src = src;
      return () => {
        video.removeAttribute('src');
        video.load();
      };
    }

    // hls.js is ~500 kB, so it's fetched only when a video actually needs it
    let hls: import('hls.js').default | null = null;
    let cancelled = false;
    import('hls.js').then(({ default: Hls, Events, ErrorTypes }) => {
      if (cancelled || !Hls.isSupported()) return;
      hls = new Hls({
        capLevelToPlayerSize: true, // don't fetch 4K renditions for a small viewport
        maxBufferLength: 10, // keep background preloading light on bandwidth
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      // play() called before the async attach finished was a no-op; retry once ready
      hls.on(Events.MANIFEST_PARSED, playIfActive);
      hls.on(Events.ERROR, (_event, data) => {
        if (!data.fatal || !hls) return;
        if (data.type === ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (data.type === ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else hls.destroy();
      });
    });
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [src]);

  useEffect(() => {
    activeRef.current = active;
    const video = videoRef.current;
    if (!video) return;
    if (active && !prefersReducedMotion()) {
      // Autoplay can be refused (e.g. power-saving mode); the poster frame stays visible
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [active]);

  return (
    <video
      ref={videoRef}
      className={className}
      poster={`https://image.mux.com/${playbackId}/thumbnail.webp?time=0`}
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
    />
  );
}

export default HlsVideo;
