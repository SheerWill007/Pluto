import { useCallback, useEffect, useRef, useState } from "react";
import { EyebrowBadge } from "../ui/EyebrowBadge";
import { HudFrame } from "../ui/HudFrame";
import { DIALOGUES, FRAME_COUNT, HERO_TEXT_FADE_END, framePath } from "../../../lib/hero";

export function Hero() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const heroTextRef = useRef<HTMLDivElement | null>(null);
  const bigLeftTextRef = useRef<HTMLDivElement | null>(null);
  const progressFillRef = useRef<HTMLDivElement | null>(null);
  const powerReadoutRef = useRef<HTMLSpanElement | null>(null);

  const framesRef = useRef<HTMLImageElement[]>([]);
  const tickingRef = useRef(false);
  const loadedRef = useRef(false);
  const lastFrameRef = useRef(-1);
  const prevVisibleIdsRef = useRef("");

  const [, setLoadProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [visibleCards, setVisibleCards] = useState<Set<string>>(new Set());

  // Preload all frames
  useEffect(() => {
    let cancelled = false;
    let loadedCount = 0;
    const imgs: HTMLImageElement[] = [];

    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = new Image();
      img.src = framePath(i);
      img.onload = () => {
        if (cancelled) return;
        loadedCount++;
        setLoadProgress(loadedCount / FRAME_COUNT);
        if (loadedCount === FRAME_COUNT) {
          loadedRef.current = true;
          setLoaded(true);
        }
      };
      img.onerror = () => {
        if (cancelled) return;
        loadedCount++;
        setLoadProgress(loadedCount / FRAME_COUNT);
        if (loadedCount === FRAME_COUNT) {
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
          FRAME_COUNT - 1,
          Math.floor(progress * FRAME_COUNT)
        );
        if (frameIndex !== lastFrameRef.current) {
          lastFrameRef.current = frameIndex;
          drawFrame(frameIndex);
        }

        if (heroTextRef.current) {
          const opacity = Math.max(0, 1 - progress / HERO_TEXT_FADE_END);
          heroTextRef.current.style.opacity = String(opacity);
          heroTextRef.current.style.transform = `translateY(${(1 - opacity) * 12}px)`;
        }

        if (bigLeftTextRef.current) {
          const op = Math.min(1, Math.max(0, (progress - 0.1) / 0.08));
          bigLeftTextRef.current.style.opacity = String(op);
          bigLeftTextRef.current.style.transform = `translateY(${(1 - op) * 14}px)`;
        }

        if (progressFillRef.current) {
          progressFillRef.current.style.transform = `scaleX(${progress})`;
        }

        if (powerReadoutRef.current) {
          const pwr = 87.3 + Math.sin(progress * Math.PI * 2) * 6.7;
          powerReadoutRef.current.textContent = pwr.toFixed(1) + "%";
        }

        const newVisible = new Set<string>();
        for (const d of DIALOGUES) {
          if (progress >= d.show && progress <= d.hide) newVisible.add(d.id);
        }
        const newIds = [...newVisible].sort().join(",");
        if (newIds !== prevVisibleIdsRef.current) {
          prevVisibleIdsRef.current = newIds;
          setVisibleCards(newVisible);
        }
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [drawFrame]);

  return (
    <section ref={sectionRef} className="scroll-animation relative">
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
              "radial-gradient(120% 80% at 50% 10%, transparent 30%, rgba(10,10,11,0.45) 70%, rgba(10,10,11,0.85) 100%)",
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

        {/* Hero text */}
        <div
          ref={heroTextRef}
          className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-start gap-5 px-6 pb-24 md:px-12 md:pb-28"
          style={{ transition: "opacity 80ms linear" }}
        >
          <EyebrowBadge>MARK LXXXV // STARK INDUSTRIES // ONLINE</EyebrowBadge>
          <h1
            className="max-w-[14ch] font-sans text-5xl font-semibold leading-[0.95] tracking-tighter md:text-7xl lg:text-8xl"
            style={{ color: "var(--foreground)" }}
          >
            I am
            <br />
            <span style={{ color: "var(--accent)" }}>Iron Man.</span>
          </h1>
          <p className="max-w-[42ch] font-sans text-sm leading-relaxed md:text-base" style={{ color: "#a1a1aa" }}>
            Mark LXXXV nanotech suit. Arc reactor calibrated. Scroll to run a full
            system diagnostic — J.A.R.V.I.S. is holding on the line.
          </p>
        </div>

        {/* Big left text (mid-scroll) */}
        <div
          ref={bigLeftTextRef}
          className="pointer-events-none absolute bottom-24 left-6 z-10 hidden max-w-[58%] flex-col gap-5 md:flex md:bottom-28 md:left-12"
          style={{ opacity: 0, transition: "opacity 80ms linear" }}
        >
          <span
            className="inline-flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.3em]"
            style={{ color: "var(--accent)" }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              aria-hidden
              style={{ backgroundColor: "var(--accent)", boxShadow: "0 0 10px rgba(212,162,47,0.85)" }}
            />
            Protocol &mdash; Mk LXXXV
          </span>
          <h2
            className="font-sans font-semibold leading-[0.88] tracking-tighter"
            style={{
              color: "var(--foreground)",
              fontSize: "clamp(4rem,9.5vw,9rem)",
            }}
          >
            Build
            <br />
            with <span style={{ color: "var(--accent)" }}>Pluto</span>
          </h2>
          <p className="max-w-[36ch] font-mono text-[11px] uppercase tracking-[0.22em]" style={{ color: "#a1a1aa" }}>
            Agents &amp; intelligence, engineered like the Mark LXXXV.
          </p>
        </div>

        {/* Top-left label */}
        <div className="pointer-events-none absolute left-6 top-20 z-10 flex items-center gap-2 md:left-10 md:top-24">
          <div className="h-px w-8" style={{ backgroundColor: "rgba(212,162,47,0.6)" }} />
          <span className="font-mono text-[10px] uppercase tracking-[0.32em]" style={{ color: "#a1a1aa" }}>
            Telemetry Link &mdash; Live
          </span>
        </div>

        {/* Top-right arc reactor readout */}
        <div className="pointer-events-none absolute right-6 top-20 z-10 flex items-center gap-3 md:right-10 md:top-24">
          <span className="font-mono text-[10px] uppercase tracking-[0.32em]" style={{ color: "#a1a1aa" }}>
            Arc Reactor
          </span>
          <span
            ref={powerReadoutRef}
            className="font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: "var(--accent)" }}
          >
            87.3%
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
            <span>SEQ 001 / {FRAME_COUNT}</span>
            <span>J.A.R.V.I.S. // DIAGNOSTIC</span>
            <span>Scroll ↓</span>
          </div>
        </div>

        {/* Dialogue quote cards (desktop) */}
        {DIALOGUES.map((d) => {
          const visible = visibleCards.has(d.id);
          const position =
            d.id === "d1"
              ? "top-[22%] right-6 md:right-12"
              : d.id === "d2"
              ? "top-1/2 -translate-y-1/2 right-6 md:right-12"
              : "bottom-24 right-6 md:bottom-28 md:right-12";
          return (
            <div
              key={d.id}
              className={`pointer-events-none absolute ${position} z-20 hidden w-[420px] max-w-[90vw] md:block`}
            >
              <figure
                className={`card-surface pointer-events-auto p-6 transition-all duration-[400ms] ease-out ${
                  visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
                }`}
              >
                <blockquote
                  className="font-sans text-xl font-medium leading-snug tracking-tight"
                  style={{ color: "var(--foreground)" }}
                >
                  &ldquo;{d.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-4 flex items-center justify-between">
                  <span className="font-sans text-sm" style={{ color: "#d4d4d8" }}>{d.speaker}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.24em]" style={{ color: "var(--accent)" }}>
                    {d.film}
                  </span>
                </figcaption>
              </figure>
            </div>
          );
        })}

        {/* Mobile dialogue cards */}
        <div className="pointer-events-none absolute inset-x-0 top-[38%] z-20 flex flex-col gap-3 px-6 md:hidden">
          {DIALOGUES.map((d) => {
            const visible = visibleCards.has(d.id);
            return (
              <figure
                key={d.id}
                className={`card-surface p-4 transition-all duration-[400ms] ease-out ${
                  visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
              >
                <blockquote
                  className="font-sans text-sm font-medium leading-snug"
                  style={{ color: "var(--foreground)" }}
                >
                  &ldquo;{d.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-2 flex items-center justify-between">
                  <span className="font-sans text-xs" style={{ color: "#d4d4d8" }}>{d.speaker}</span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>
                    {d.film}
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
