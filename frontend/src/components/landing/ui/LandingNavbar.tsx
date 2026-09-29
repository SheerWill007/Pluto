import { useEffect, useState } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-40 transition-[background-color,backdrop-filter,border-color] duration-300"
      style={
        scrolled
          ? {
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              backgroundColor: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(24px) saturate(150%)",
              WebkitBackdropFilter: "blur(24px) saturate(150%)",
            }
          : {
              borderBottom: "1px solid transparent",
              backgroundColor: "transparent",
            }
      }
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4 md:px-8 md:py-5">
        {/* Logo */}
        <a
          href="#"
          className="flex items-center gap-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.32em]"
          style={{ color: "var(--foreground)" }}
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            aria-hidden="true"
            style={{
              backgroundColor: "var(--accent)",
              boxShadow: "0 0 12px rgba(212,162,47,0.9)",
            }}
          />
          Stark / Industries
        </a>

        {/* Nav links */}
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#systems"
            className="font-mono text-[11px] uppercase tracking-[0.24em] transition-colors hover:text-white"
            style={{ color: "var(--muted)" }}
          >
            Systems
          </a>
          <a
            href="#footer"
            className="font-mono text-[11px] uppercase tracking-[0.24em] transition-colors hover:text-white"
            style={{ color: "var(--muted)" }}
          >
            Archive
          </a>
        </nav>

        {/* CTA */}
        <button
          onClick={() => navigate("/login")}
          className="group inline-flex items-center gap-1.5 rounded-full border border-white/[0.15] bg-white/[0.05] px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.22em] backdrop-blur-md transition-all duration-200 hover:bg-white/[0.1] active:translate-y-[1px] cursor-pointer"
          style={{ color: "var(--foreground)" }}
        >
          Launch App
          <ArrowUpRight
            size={14}
            weight="bold"
            className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </button>
      </div>
    </header>
  );
}
