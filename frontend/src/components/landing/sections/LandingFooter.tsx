import { ArrowUpRight } from "@phosphor-icons/react";

export function LandingFooter() {
  return (
    <footer
      id="footer"
      className="px-6 py-14 md:px-10 md:py-16"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.05)",
        backgroundColor: "var(--background)",
      }}
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-10">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-start">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <div
              className="flex items-center gap-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.32em]"
              style={{ color: "var(--foreground)" }}
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  backgroundColor: "var(--accent)",
                  boxShadow: "0 0 12px rgba(212,162,47,0.9)",
                }}
              />
              Stark / Industries
            </div>
            <p
              className="max-w-[38ch] font-sans text-sm leading-relaxed"
              style={{ color: "#a1a1aa" }}
            >
              &copy; Stark Industries &mdash; 10880 Malibu Point, 90265.
              Registered trademark of the Office of Howard &amp; Anthony E.
              Stark.
            </p>
          </div>

          {/* Suit archive nav */}
          <nav className="grid grid-cols-2 gap-x-10 gap-y-3 md:grid-cols-3">
            {[
              ["Mark I", "Cave, Afghanistan"],
              ["Mark III", "Monaco Circuit"],
              ["Mark VII", "Stark Tower"],
              ["Mark XLIV", "Hulkbuster"],
              ["Mark L", "Titan"],
              ["Mark LXXXV", "Endgame"],
            ].map(([name, note]) => (
              <a key={name} href="#" className="group flex flex-col gap-1">
                <span
                  className="font-sans text-[13px] font-medium transition-colors group-hover:text-[var(--accent)]"
                  style={{ color: "var(--foreground)" }}
                >
                  {name}
                  <ArrowUpRight
                    size={11}
                    weight="bold"
                    className="ml-1 inline-block align-baseline opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </span>
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.24em]"
                  style={{ color: "#52525b" }}
                >
                  {note}
                </span>
              </a>
            ))}
          </nav>
        </div>

        {/* Legal line */}
        <div
          className="flex flex-col gap-2 pt-6 font-mono text-[10px] uppercase tracking-[0.28em] md:flex-row md:items-center md:justify-between"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.05)",
            color: "#52525b",
          }}
        >
          <span>
            Build 2026.04.21 &nbsp;&middot;&nbsp; Mark LXXXV &nbsp;&middot;&nbsp; J.A.R.V.I.S. Online
          </span>
          <span>Proof of concept &mdash; fan art, no commercial use</span>
        </div>
      </div>
    </footer>
  );
}
