import { useCallback, useEffect, useRef, useState } from "react";
import { EyebrowBadge } from "../ui/EyebrowBadge";
import { HudFrame } from "../ui/HudFrame";
import { BEATS, CINE_FRAME_COUNT, cineFramePath } from "@/lib/cinematic";

export function CinematicReveal() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const h2InevitableRef = useRef<HTMLHeadingElement | null>(null);
  const h2IronManRef = useRef<HTMLHeadingElement | null>(null);
  const outroRef = useRef<HTMLDivElement | null>(null);
  const progressFillRef = useRef<HTMLDivElement | null>(null);
  const seqReadoutRef = useRef<HTMLSpanElement | null>(null);

  const framesRef = useRef<HTMLImageElement[]>([]);
  const tickingRef = useRef(false);
  const loadedRef = useRef(false);
  const lastFrameRef = useRef(-1);
  const prevVisibleIdsRef = useRef("");

  const [, setLoadProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [visibleBeats, setVisibleBeats] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let loadedCount = 0;
    const imgs: HTMLImageElement[] = [];

    for (let i = 1; i <= CINE_FRAME_COUNT; i++) {
      const img = new Image();
      img.src = cineFramePath(i);
      img.onload = () => {
        if (cancelled) return;
        loadedCount++;
        setLoadProgress(loadedCount / CINE_FRAME_COUNT);
        if (loadedCount === CINE_FRAME_COUNT) {
          loadedRef.current = true;
          setLoaded(true);
        }
      };
      img.onerror = () => {
        if (cancelled) return;
        loadedCount++;
        setLoadProgress(loadedCount / CINE_FRAME_COUNT);
        if (loadedCount === CINE_FRAME_COUNT) {
          loadedRef.current = true;
          setLoaded(true);
        }
      };
      imgs.push(img);
    }
    framesRef.current = imgs;
    return () => { cancelled = true; };
  }, []);

  const drawFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    const img = framesRef.current[index];
    if (!canvas || !img || !img.complete || !img.naturalWidth) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = cw / ch;

    let drawW: number;
    let drawH: number;
    if (canvasRatio > imgRatio) {
      drawW = cw;
      drawH = cw / imgRatio;
    } else {
      drawH = ch;
      drawW = ch * imgRatio;
    }

    if (window.innerWidth <= 768) {
      drawW *= 1.3;
      drawH *= 1.3;
    }

    const drawX = (cw - drawW) / 2;
    const drawY = (ch - drawH) / 2;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    drawFrame(lastFrameRef.current >= 0 ? lastFrameRef.current : 0);
  }, [drawFrame]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  useEffect(() => {
    if (!loaded) return;
    drawFrame(0);
    lastFrameRef.current = 0;
  }, [loaded, drawFrame]);

  useEffect(() => {
    const handleScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;

      requestAnimationFrame(() => {
        tickingRef.current = false;
        const section = sectionRef.current;
        if (!section || !loadedRef.current) return;

        const rect = section.getBoundingClientRect();
        const scrollable = section.offsetHeight - window.innerHeight;
        const progress =
          scrollable <= 0
            ? 0
            : Math.min(1, Math.max(0, -rect.top / scrollable));

        const frameIndex = Math.min(
          CINE_FRAME_COUNT - 1,
          Math.floor(progress * CINE_FRAME_COUNT)
        );
        if (frameIndex !== lastFrameRef.current) {
          lastFrameRef.current = frameIndex;
          drawFrame(frameIndex);
        }

        if (h2InevitableRef.current) {
          const op = Math.min(1, Math.max(0, (0.52 - progress) / 0.1));
          h2InevitableRef.current.style.opacity = String(op);
        }

        if (h2IronManRef.current) {
          const op = Math.min(1, Math.max(0, (progress - 0.48) / 0.1));
          h2IronManRef.current.style.opacity = String(op);
        }

        if (outroRef.current) {
          const op = Math.min(1, Math.max(0, (progress - 0.86) / 0.06));
          outroRef.current.style.opacity = String(op);
          outroRef.current.style.transform = `translateY(${(1 - op) * 14}px)`;
        }

        if (progressFillRef.current) {
          progressFillRef.current.style.transform = `scaleX(${progress})`;
        }

        if (seqReadoutRef.current) {
          const n = Math.min(CINE_FRAME_COUNT, frameIndex + 1);
          seqReadoutRef.current.textContent =
            `SEQ ${String(n).padStart(3, "0")} / ${CINE_FRAME_COUNT}`;
        }

        const newVisible = new Set<string>();
        for (const b of BEATS) {
          if (progress >= b.show && progress <= b.hide) newVisible.add(b.id);
        }
        const newIds = [...newVisible].sort().join(",");
        if (newIds !== prevVisibleIdsRef.current) {
          prevVisibleIdsRef.current = newIds;
          setVisibleBeats(newVisible);
        }
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [drawFrame]);

  return (
    <section
      ref={sectionRef}
      id="cinematic"
      className="scroll-animation relative"
      style={{ borderTop: "1px solid rgba(255,255,255,0.05)", backgroundColor: "var(--background)" }}
    >
      <div
        className="sticky top-0 min-h-[100dvh] w-full overflow-hidden"
        style={{
          height: "100dvh",
          backgroundColor: "var(--background)",
          willChange: "transform",
          transform: "translateZ(0)",
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ willChange: "contents", transform: "translateZ(0)" }}
        />

        {/* Vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 90%, transparent 30%, rgba(10,10,11,0.45) 70%, rgba(10,10,11,0.85) 100%)",
          }}
        />

        {/* HUD corners */}
        <div className="pointer-events-none absolute left-6 top-24 md:left-10 md:top-28" style={{ color: "var(--accent)" }}>
          <HudFrame corner="tl" size={26} />
        </div>
        <div className="pointer-events-none absolute right-6 top-24 md:right-10 md:top-28" style={{ color: "var(--accent)" }}>
          <HudFrame corner="tr" size={26} />
        </div>
        <div className="pointer-events-none absolute bottom-14 left-6 md:bottom-16 md:left-10" style={{ color: "var(--accent)" }}>
          <HudFrame corner="bl" size={26} />
        </div>
        <div className="pointer-events-none absolute bottom-14 right-6 md:bottom-16 md:right-10" style={{ color: "var(--accent)" }}>
          <HudFrame corner="br" size={26} />
        </div>

        {/* Crossfade heading */}
        <div className="pointer-events-none absolute right-6 top-28 z-10 flex max-w-[46ch] flex-col items-end gap-5 text-right md:right-12 md:top-32">
          <EyebrowBadge>TITAN II // FINAL FRAME</EyebrowBadge>
          <div className="relative self-stretch">
            <h2
              ref={h2InevitableRef}
              className="font-sans text-4xl font-semibold leading-[0.98] tracking-tighter md:text-6xl lg:text-7xl"
              style={{ color: "var(--foreground)", transition: "opacity 240ms ease-out" }}
            >
              I am
              <br />
              <span style={{ color: "var(--accent)" }}>Inevitable.</span>
            </h2>
            <h2
              ref={h2IronManRef}
              className="absolute inset-0 font-sans text-4xl font-semibold leading-[0.98] tracking-tighter md:text-6xl lg:text-7xl"
              style={{ opacity: 0, color: "var(--foreground)", transition: "opacity 240ms ease-out" }}
            >
              And I am
              <br />
              <span style={{ color: "var(--accent)" }}>Iron Man.</span>
            </h2>
          </div>
          <p className="max-w-[42ch] font-sans text-sm leading-relaxed md:text-base" style={{ color: "#a1a1aa" }}>
            Endgame &mdash; the snap heard across the universe. J.A.R.V.I.S. held the last frame so we could rebuild from it.
          </p>
        </div>

        {/* Top-left label */}
        <div className="pointer-events-none absolute left-6 top-20 z-10 flex items-center gap-2 md:left-10 md:top-24">
          <div className="h-px w-8" style={{ backgroundColor: "rgba(212,162,47,0.6)" }} />
          <span className="font-mono text-[10px] uppercase tracking-[0.32em]" style={{ color: "#a1a1aa" }}>
            Flight Log &mdash; Archived
          </span>
        </div>

        {/* Top-right sequence readout */}
        <div className="pointer-events-none absolute right-6 top-20 z-10 flex items-center gap-3 md:right-10 md:top-24">
          <span
            ref={seqReadoutRef}
            className="font-mono text-[10px] uppercase tracking-[0.28em]"
            style={{ color: "var(--accent)" }}
          >
            SEQ 001 / {CINE_FRAME_COUNT}
          </span>
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "var(--accent)", boxShadow: "0 0 10px rgba(212,162,47,0.85)" }}
          />
        </div>

        {/* Progress bar */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
          <div className="mx-6 mb-3 h-px md:mx-10" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
            <div
              ref={progressFillRef}
              className="h-full origin-left"
              style={{
                backgroundColor: "var(--accent)",
                transform: "scaleX(0)",
                transition: "transform 80ms linear",
              }}
            />
          </div>
          <div
            className="mx-6 flex items-center justify-between pb-4 font-mono text-[10px] uppercase tracking-[0.28em] md:mx-10"
            style={{ color: "#52525b" }}
          >
            <span>MARK III // ARCHIVE</span>
            <span>J.A.R.V.I.S. // PLAYBACK</span>
            <span>Scroll ↓</span>
          </div>
        </div>

        {/* Beat quote cards (left side, desktop) */}
        {BEATS.map((b, i) => {
          const visible = visibleBeats.has(b.id);
          const position =
            i === 0
              ? "top-[22%] left-6 md:left-12"
              : i === 1
              ? "top-1/2 -translate-y-1/2 left-6 md:left-12"
              : "bottom-24 left-6 md:bottom-28 md:left-12";
          return (
            <div
              key={b.id}
              className={`pointer-events-none absolute ${position} z-20 hidden w-[420px] max-w-[90vw] md:block`}
            >
              <figure
                className={`card-surface pointer-events-auto p-6 transition-all duration-[400ms] ease-out ${
                  visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
                }`}
              >
                <div
                  className="mb-3 font-mono text-[10px] uppercase tracking-[0.28em]"
                  style={{ color: "var(--accent)" }}
                >
                  {b.label}
                </div>
                <blockquote
                  className="font-sans text-xl font-medium leading-snug tracking-tight"
                  style={{ color: "var(--foreground)" }}
                >
                  &ldquo;{b.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-4 flex items-center justify-between">
                  <span className="font-sans text-sm" style={{ color: "#d4d4d8" }}>{b.speaker}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.24em]" style={{ color: "var(--accent)" }}>
                    {b.film}
                  </span>
                </figcaption>
              </figure>
            </div>
          );
        })}

        {/* Outro / CTA */}
        <div
          ref={outroRef}
          className="pointer-events-none absolute inset-x-0 bottom-20 z-10 flex flex-col items-center gap-4 px-6 md:bottom-24"
          style={{ opacity: 0, transition: "opacity 200ms ease-out" }}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.28em]" style={{ color: "#a1a1aa" }}>
            System diagnostic complete
          </p>
        </div>
      </div>
    </section>
  );
}
