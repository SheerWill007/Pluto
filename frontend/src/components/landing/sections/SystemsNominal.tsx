import { ArrowUpRight } from "@phosphor-icons/react";
import { EyebrowBadge } from "../ui/EyebrowBadge";
import { AnimatedItem, AnimatedSection } from "../ui/AnimatedSection";
import { useNavigate } from "react-router-dom";

const telemetry = [
  { label: "Suit Integrity", value: "99.2%", note: "Nanoparticle lattice" },
  { label: "Arc Output", value: "3.4 GJ/s", note: "Cold-fused, Vibranium core" },
  { label: "Flight Ceiling", value: "72.8 km", note: "Stratospheric assist" },
  { label: "Response Time", value: "0.018 s", note: "Neural link, J.A.R.V.I.S." },
];

export function SystemsNominal() {
  const navigate = useNavigate();

  return (
    <section
      id="systems"
      className="relative px-6 pb-28 pt-24 md:px-10 md:pb-40 md:pt-32"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.05)",
        backgroundColor: "var(--background)",
      }}
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-16 md:grid md:grid-cols-[5fr_4fr] md:gap-20">
        <AnimatedSection className="flex flex-col gap-8">
          <AnimatedItem>
            <EyebrowBadge>J.A.R.V.I.S. // SYSTEMS NOMINAL</EyebrowBadge>
          </AnimatedItem>
          <AnimatedItem>
            <h2
              className="max-w-[16ch] font-sans text-4xl font-semibold leading-[0.98] tracking-tighter md:text-6xl"
              style={{ color: "var(--foreground)" }}
            >
              &ldquo;And I&hellip; am&hellip;{" "}
              <span style={{ color: "var(--accent)" }}>Iron Man.</span>&rdquo;
            </h2>
          </AnimatedItem>
          <AnimatedItem>
            <p
              className="max-w-[48ch] font-sans text-base leading-relaxed md:text-lg"
              style={{ color: "#a1a1aa" }}
            >
              A snap heard around the universe. The Mark LXXXV was engineered in
              six hours and retired in seconds &mdash; its final moment, the
              reason any of us are still here. Every readout below is what
              J.A.R.V.I.S. logged in the last frame before the blast.
            </p>
          </AnimatedItem>
          <AnimatedItem>
            <button
              onClick={() => navigate("/login")}
              className="group inline-flex items-center gap-2 self-start rounded-full border border-white/[0.15] bg-white/[0.04] px-5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.22em] backdrop-blur-md transition-all duration-200 hover:bg-white/[0.08] active:translate-y-[1px] cursor-pointer"
              style={{ color: "var(--foreground)" }}
            >
              Launch Pluto
              <ArrowUpRight
                size={14}
                weight="bold"
                className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </button>
          </AnimatedItem>
        </AnimatedSection>

        <AnimatedSection
          className="flex flex-col divide-y font-mono md:mt-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.08)" }}
        >
          {telemetry.map((row) => (
            <AnimatedItem key={row.label}>
              <div
                className="flex items-baseline justify-between gap-6 py-5"
                style={{ borderColor: "rgba(255,255,255,0.08)" }}
              >
                <div className="flex flex-col gap-1">
                  <span
                    className="text-[10px] uppercase tracking-[0.28em]"
                    style={{ color: "#52525b" }}
                  >
                    {row.label}
                  </span>
                  <span className="font-sans text-[13px]" style={{ color: "#a1a1aa" }}>
                    {row.note}
                  </span>
                </div>
                <span
                  className="text-2xl font-semibold tracking-tight md:text-3xl"
                  style={{ color: "var(--foreground)" }}
                >
                  {row.value}
                </span>
              </div>
            </AnimatedItem>
          ))}
        </AnimatedSection>
      </div>
    </section>
  );
}
