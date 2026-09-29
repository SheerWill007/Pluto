import { LandingNavbar } from "../components/landing/ui/LandingNavbar";
import { Hero } from "../components/landing/sections/Hero";
import { CinematicReveal } from "../components/landing/sections/CinematicReveal";
import { SystemsNominal } from "../components/landing/sections/SystemsNominal";
import { LandingFooter } from "../components/landing/sections/LandingFooter";
import { SmoothScrollProvider } from "../components/landing/providers/SmoothScrollProvider";

export function LandingPage() {
  return (
    <SmoothScrollProvider>
      <div className="landing-page grain">
        <LandingNavbar />
        <main>
          <Hero />
          <CinematicReveal />
          <SystemsNominal />
        </main>
        <LandingFooter />
      </div>
    </SmoothScrollProvider>
  );
}

export default LandingPage;
