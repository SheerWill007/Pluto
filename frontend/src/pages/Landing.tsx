import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  motion,
  transform,
  useMotionTemplate,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from 'framer-motion';
import { ArrowUpRight, BookOpen, Bot, Code2, Globe, Mail, ShieldCheck, ExternalLink } from 'lucide-react';
import VortexCanvas from '../components/cosmos/VortexCanvas';
import PillNav from '../components/cosmos/PillNav';
import CursorDot from '../components/cosmos/CursorDot';
import AuthCard from '../components/auth/AuthCard';
import { scrollToTarget, useLenis } from '../hooks/useLenis';
import { scrollState } from '../lib/scrollState';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * useTransform over a range, mapped in JS. Array ranges derived from useScroll get
 * offloaded to native scroll timelines by framer-motion 12, which mis-maps our sticky,
 * target-relative offsets (opacity stayed at 1); a function transformer opts out.
 */
function useRange(value: MotionValue<number>, input: number[], output: number[]) {
  return useTransform(value, transform(input, output));
}

const AGENTS = [
  {
    icon: Bot,
    name: 'Orchestrator',
    tool: 'langgraph',
    body: 'A tool-calling loop that reads your request, decides which agents to wake, and streams its answer token by token.',
  },
  {
    icon: Globe,
    name: 'Web research',
    tool: 'web_search',
    body: 'Live DuckDuckGo search for news, releases and anything newer than the model’s training data.',
  },
  {
    icon: BookOpen,
    name: 'Knowledge',
    tool: 'search_document',
    body: 'Ingests PDF, DOCX, Markdown and CSV into your private vector store, then answers with cited sources.',
  },
  {
    icon: Mail,
    name: 'Inbox triage',
    tool: 'gmail_tool',
    body: 'Reads your linked Gmail, summarises threads, surfaces action items and flags likely spam.',
  },
  {
    icon: Code2,
    name: 'Code generator',
    tool: 'code_tool',
    body: 'Pulls relevant project context from your documents and writes production-shaped code for the task.',
  },
  {
    icon: ShieldCheck,
    name: 'Code critic',
    tool: 'review loop',
    body: 'Traces edge cases, security and correctness, and sends work back to the generator until it passes.',
  },
];

const STEPS = [
  { title: 'Ask', body: 'Type a question, upload a document, or point Pluto at your inbox.' },
  { title: 'Plan', body: 'The orchestrator decides whether it can answer directly or needs an agent.' },
  { title: 'Act', body: 'Agents search the web, your documents or Gmail; the topology map lights up live.' },
  { title: 'Review', body: 'Generated code is audited by the critic and regenerated until it is approved.' },
  { title: 'Answer', body: 'A streamed, sourced response, remembered for the rest of the conversation.' },
];

const MANIFESTO =
  'Pluto doesn’t guess. It plans, calls the right agent, checks the work, and streams every step back to you — on Gemini, OpenAI, Claude, Groq, OpenRouter or a local Ollama model.';

const CAPABILITIES = ['Streaming answers', 'Cited retrieval', 'Inbox digests', 'Reviewed code', 'Six LLM providers', 'Per-user isolation'];

// ---------------------------------------------------------------------------------

function SplitTitle({ text }: { text: string }) {
  return (
    <span aria-label={text} className="inline-flex">
      {text.split('').map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          className="inline-block"
          initial={{ y: '110%', opacity: 0, rotate: 6 }}
          animate={{ y: '0%', opacity: 1, rotate: 0 }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.25 + i * 0.06 }}
        >
          {ch === ' ' ? ' ' : ch}
        </motion.span>
      ))}
    </span>
  );
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  // The framed card opens up to full-bleed as you dive into the vortex
  const insetX = useRange(scrollYProgress, [0, 0.55], [7, 0]);
  const insetY = useRange(scrollYProgress, [0, 0.55], [10, 0]);
  const radius = useRange(scrollYProgress, [0, 0.55], [36, 0]);
  const clipPath = useMotionTemplate`inset(${insetY}% ${insetX}% ${insetY}% ${insetX}% round ${radius}px)`;

  const contentY = useRange(scrollYProgress, [0, 0.5], [0, -140]);
  const contentOpacity = useRange(scrollYProgress, [0, 0.38], [1, 0]);
  const contentBlur = useRange(scrollYProgress, [0, 0.38], [0, 10]);
  const contentFilter = useMotionTemplate`blur(${contentBlur}px)`;
  const titleScale = useRange(scrollYProgress, [0, 0.5], [1, 1.12]);
  const cardFade = useRange(scrollYProgress, [0.7, 1], [1, 0.25]);
  const rimOpacity = useRange(scrollYProgress, [0, 0.4], [1, 0]);

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    scrollState.dive = Math.min(1, Math.max(0, v / 0.85));
  });
  useEffect(() => () => {
    scrollState.dive = 0;
  }, []);

  return (
    <section ref={ref} id="home" className="relative h-[230vh]">
      <div className="sticky top-0 h-screen overflow-hidden">
        <motion.div style={{ clipPath, opacity: cardFade }} className="absolute inset-0 will-change-[clip-path]">
          <VortexCanvas className="absolute inset-0" zoom={1.05} centerY={0.3} orbit={0.08} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/80" />
        </motion.div>

        {/* Thin rim around the card while it is framed */}
        <motion.div
          style={{ clipPath, opacity: rimOpacity }}
          className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
        />

        <motion.div
          style={{ y: contentY, opacity: contentOpacity, filter: contentFilter }}
          className="relative z-10 flex h-full flex-col items-center justify-center px-6 pb-16 pt-24 text-center"
        >
          <motion.p
            className="eyebrow mb-6"
            initial={{ opacity: 0, letterSpacing: '0.8em' }}
            animate={{ opacity: 1, letterSpacing: '0.38em' }}
            transition={{ duration: 1.6, ease: EASE }}
          >
            Multi-agent system &nbsp;’26
          </motion.p>

          <motion.h1
            style={{ scale: titleScale }}
            className="font-display overflow-hidden pb-3 text-[clamp(4.5rem,15vw,12.5rem)] italic leading-[0.9] text-white drop-shadow-[0_8px_40px_rgba(0,0,0,0.6)]"
          >
            <SplitTitle text="Pluto" />
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE, delay: 0.9 }}
            className="mt-5 text-lg text-white/70 sm:text-2xl"
          >
            <span className="mr-2.5 inline-block h-2.5 w-2.5 rounded-full bg-white align-middle shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
            An <span className="font-display text-[1.25em] italic text-white">Orchestrator</span> lives in your workspace.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE, delay: 1.05 }}
            className="mt-7 max-w-xl text-[15px] leading-relaxed text-white/50 sm:text-base"
          >
            Web research, document intelligence, inbox triage and reviewed code — one agent loop that
            decides which tool to call, and shows you as it does.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE, delay: 1.2 }}
            className="mt-11 flex flex-wrap items-center justify-center gap-4"
          >
            <button type="button" className="pill-primary" onClick={() => scrollToTarget('#agents')}>
              See agents
            </button>
            <button type="button" className="pill-ghost" onClick={() => scrollToTarget('#access')}>
              Sign in…
            </button>
          </motion.div>
        </motion.div>

        <motion.div
          style={{ opacity: contentOpacity }}
          className="pointer-events-none absolute bottom-[10%] left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-3 [@media(min-height:760px)]:flex"
        >
          <span className="eyebrow text-[10px]">Scroll</span>
          <span className="block h-12 w-px bg-white/50 [animation:scroll-cue_2.2s_ease-in-out_infinite]" />
        </motion.div>
      </div>
    </section>
  );
}

function VelocityMarquee() {
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smooth = useSpring(velocity, { damping: 40, stiffness: 300 });
  const skew = useTransform(smooth, [-2500, 0, 2500], [-8, 0, 8], { clamp: true });
  const items = [...CAPABILITIES, ...CAPABILITIES];

  return (
    <div className="relative overflow-hidden border-y border-white/[0.06] bg-black/50 py-7 backdrop-blur-sm">
      <motion.div style={{ skewX: skew }} className="flex w-max [animation:marquee_38s_linear_infinite]">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
            {items.map((item, i) => (
              <span key={`${copy}-${i}`} className="flex items-center">
                <span className="font-display px-8 text-4xl italic text-white/85 sm:text-5xl">{item}</span>
                <span className="text-beige-400/70">✦</span>
              </span>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function SectionHeading({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div className="mb-16 max-w-3xl">
      <motion.p
        className="eyebrow mb-5"
        initial={{ opacity: 0, x: -16 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-15%' }}
        transition={{ duration: 0.9, ease: EASE }}
      >
        {eyebrow}
      </motion.p>
      <motion.h2
        className="font-display text-[clamp(2.8rem,7vw,5.5rem)] leading-[0.95] text-white"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-15%' }}
        transition={{ duration: 1.1, ease: EASE }}
      >
        {children}
      </motion.h2>
    </div>
  );
}

function AgentCard({ agent, index, drift }: { agent: (typeof AGENTS)[number]; index: number; drift: MotionValue<number> }) {
  const Icon = agent.icon;
  return (
    <motion.div style={{ y: drift }}>
      <motion.article
        initial={{ opacity: 0, y: 60, filter: 'blur(8px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: true, margin: '-10%' }}
        transition={{ duration: 1, ease: EASE, delay: (index % 3) * 0.12 }}
        className="group relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-7 backdrop-blur-md transition-colors duration-500 hover:border-beige-400/40"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-beige-500/0 blur-3xl transition-colors duration-700 group-hover:bg-beige-500/25" />
        <div className="mb-14 flex items-start justify-between">
          <span className="font-mono text-xs text-white/35">{String(index + 1).padStart(2, '0')}</span>
          <span className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-black/60 text-beige-300 transition-transform duration-500 group-hover:rotate-[-12deg] group-hover:scale-110">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        </div>
        <h3 className="font-display mb-3 text-[2.1rem] italic leading-none text-white">{agent.name}</h3>
        <p className="mb-6 text-sm leading-relaxed text-white/55">{agent.body}</p>
        <span className="inline-flex rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] text-beige-300/80">
          {agent.tool}
        </span>
      </motion.article>
    </motion.div>
  );
}

function AgentsSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  // Columns drift at different speeds for depth
  const drifts = [
    useRange(scrollYProgress, [0, 1], [60, -60]),
    useRange(scrollYProgress, [0, 1], [130, -130]),
    useRange(scrollYProgress, [0, 1], [30, -30]),
  ];

  return (
    <section ref={ref} id="agents" className="relative px-6 py-36 sm:px-10 lg:px-20">
      <SectionHeading eyebrow="The crew">
        Six agents, <span className="italic text-beige-200">one orbit.</span>
      </SectionHeading>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {AGENTS.map((agent, i) => (
          <AgentCard key={agent.name} agent={agent} index={i} drift={drifts[i % 3]} />
        ))}
      </div>
    </section>
  );
}

function Word({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useRange(progress, range, [0.12, 1]);
  const y = useRange(progress, range, [8, 0]);
  return (
    <motion.span style={{ opacity, y }} className="mr-[0.28em] inline-block">
      {children}
    </motion.span>
  );
}

function Manifesto() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.45'] });
  const words = MANIFESTO.split(' ');
  return (
    <section className="relative px-6 py-32 sm:px-10 lg:px-20">
      <div ref={ref} className="mx-auto max-w-5xl">
        <p className="font-display text-[clamp(2rem,4.6vw,3.9rem)] leading-[1.12] text-white">
          {words.map((word, i) => (
            <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
              {word}
            </Word>
          ))}
        </p>
      </div>
    </section>
  );
}

function WorkflowSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.7', 'end 0.6'] });
  const line = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  return (
    <section id="workflow" className="relative px-6 py-36 sm:px-10 lg:px-20">
      <SectionHeading eyebrow="How it moves">
        From question <span className="italic text-beige-200">to answer.</span>
      </SectionHeading>

      <div ref={ref} className="relative ml-2 max-w-3xl sm:ml-8">
        <div className="absolute bottom-2 left-[7px] top-2 w-px bg-white/10" />
        <motion.div
          style={{ scaleY: line }}
          className="absolute bottom-2 left-[7px] top-2 w-px origin-top bg-gradient-to-b from-beige-200 via-beige-400 to-beige-600 shadow-[0_0_14px_rgba(124,182,234,0.9)]"
        />
        <ol className="flex flex-col gap-20">
          {STEPS.map((step, i) => (
            <motion.li
              key={step.title}
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-25%' }}
              transition={{ duration: 0.9, ease: EASE }}
              className="relative pl-14"
            >
              <span className="absolute left-0 top-3 grid h-[15px] w-[15px] place-items-center rounded-full border border-beige-300/70 bg-black">
                <span className="h-[5px] w-[5px] rounded-full bg-beige-200" />
              </span>
              <span className="font-mono text-xs text-white/35">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="font-display mt-1 text-5xl italic text-white sm:text-6xl">{step.title}</h3>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/55">{step.body}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function AccessSection() {
  return (
    <section id="access" className="relative px-6 py-36 sm:px-10 lg:px-20">
      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <SectionHeading eyebrow="Access">
            Step inside <span className="italic text-beige-200">the orbit.</span>
          </SectionHeading>
          <motion.ul
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-15%' }}
            variants={{ show: { transition: { staggerChildren: 0.12 } } }}
            className="-mt-6 flex flex-col gap-4 text-[15px] text-white/60"
          >
            {[
              'Your conversations, facts and documents are scoped to your account.',
              'Bring your own provider key, or use the server’s — keys are never stored.',
              'Guests can try everything except Gmail, which needs a real account.',
            ].map((line) => (
              <motion.li
                key={line}
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } } }}
                className="flex gap-3"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-beige-300" />
                {line}
              </motion.li>
            ))}
          </motion.ul>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 1.1, ease: EASE }}
          className="flex justify-center lg:justify-end"
        >
          <AuthCard />
        </motion.div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------

const NAV_SECTIONS = [
  { id: 'home', label: 'Home' },
  { id: 'agents', label: 'Agents' },
  { id: 'workflow', label: 'Workflow' },
];

export function Landing() {
  useLenis();
  const [activeId, setActiveId] = useState('home');

  // Highlight the nav item for whichever section is in the middle of the viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        });
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    [...NAV_SECTIONS.map((s) => s.id), 'access'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#03050a] text-white">
      <CursorDot />

      {/* Deep-space backdrop: the same vortex, pulled back and dimmed */}
      <div className="fixed inset-0">
        <VortexCanvas className="absolute inset-0" zoom={1.6} centerY={0.12} orbit={0.04} brightness={1.1} maxDpr={0.75} />
        <div className="absolute inset-0 bg-black/15" />
      </div>

      <header className="fixed inset-x-0 top-5 z-50 flex justify-center px-4">
        <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 1, ease: EASE, delay: 0.2 }}>
          <PillNav
            activeId={activeId}
            onLogoClick={() => scrollToTarget(0)}
            items={NAV_SECTIONS.map((s) => ({
              id: s.id,
              label: s.label,
              onClick: () => scrollToTarget(s.id === 'home' ? 0 : `#${s.id}`),
            }))}
            action={
              <button
                type="button"
                onClick={() => scrollToTarget('#access')}
                className={`flex items-center gap-1 rounded-full px-3 py-2 text-[13px] font-medium transition-colors sm:px-4 ${
                  activeId === 'access' ? 'bg-white text-black' : 'text-white hover:bg-white/10'
                }`}
              >
                Sign in <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            }
          />
        </motion.div>
      </header>

      <main className="relative">
        <Hero />
        <div className="relative bg-gradient-to-b from-black/70 via-black/55 to-black/80">
          <VelocityMarquee />
          <AgentsSection />
          <Manifesto />
          <WorkflowSection />
          <AccessSection />
          <footer className="flex flex-col items-center justify-between gap-6 border-t border-white/[0.06] px-6 py-10 text-xs text-white/35 sm:px-10 lg:px-20">
            <span className="font-display text-xl italic text-white/70">Pluto</span>
            
            {/* Social Media Icons */}
            <div className="flex items-center gap-6">
              <a
                href="https://github.com/SheerWill007/Pluto"
                target="_blank"
                rel="noopener noreferrer"
                className="group transition-colors hover:text-white/70"
                aria-label="GitHub Repository"
              >
                <svg className="h-5 w-5 transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
              <a
                href="https://willx.tech/"
                target="_blank"
                rel="noopener noreferrer"
                className="group transition-colors hover:text-white/70"
                aria-label="Portfolio"
              >
                <ExternalLink className="h-5 w-5 transition-transform group-hover:scale-110" />
              </a>
              <a
                href="https://www.linkedin.com/in/willxtech"
                target="_blank"
                rel="noopener noreferrer"
                className="group transition-colors hover:text-white/70"
                aria-label="LinkedIn Profile"
              >
                <svg className="h-5 w-5 transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>

            <span>Multi-agent workspace · © {new Date().getFullYear()}</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default Landing;
