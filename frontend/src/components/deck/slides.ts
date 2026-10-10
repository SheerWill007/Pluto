export interface SlideContent {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  /** Short supporting points shown under the body */
  points?: string[];
  /**
   * Mux playback ID for the background video. Leave undefined to use the gradient
   * backdrop instead -- paste IDs from your Mux dashboard (Assets -> Playback IDs).
   */
  playbackId?: string;
  /** Fallback backdrop when there's no video (also shown while the first frame loads) */
  gradient: string;
  cta?: { label: string; to: string };
}

export const SLIDES: SlideContent[] = [
  {
    id: 'intro',
    eyebrow: 'Pluto',
    title: 'Multi-agent orchestration, simplified.',
    body: 'One workspace where specialized AI agents chat, research, read your documents, triage your inbox, and write code — on the model of your choice.',
    gradient: 'radial-gradient(120% 90% at 70% 20%, #3a2f22 0%, #151210 55%, #000 100%)',
  },
  {
    id: 'orchestrator',
    eyebrow: 'Orchestrator',
    title: 'Answers that stream in real time.',
    body: 'A LangGraph agent decides when to search the web, query your knowledge base, read Gmail, or run the code pipeline — and shows each tool as it works.',
    points: ['Token-by-token streaming', 'Live agent topology', 'Gemini · OpenAI · Claude · Groq · Ollama'],
    gradient: 'radial-gradient(110% 80% at 20% 30%, #2c2a24 0%, #12110f 60%, #000 100%)',
  },
  {
    id: 'documents',
    eyebrow: 'Document intelligence',
    title: 'Ask your files anything.',
    body: 'Upload PDFs, docs, and notes. Pluto retrieves the most relevant passages and answers with citations back to the source.',
    points: ['Cited answers with relevance scores', 'Private to your account', 'PDF · DOCX · Markdown · CSV · JSON'],
    gradient: 'radial-gradient(120% 90% at 80% 70%, #26302c 0%, #0f1312 60%, #000 100%)',
  },
  {
    id: 'inbox',
    eyebrow: 'Email triage',
    title: 'Your inbox, summarized.',
    body: 'Connect Gmail to get concise digests, action items, and spam signals for the messages that matter — without leaving the console.',
    points: ['One-click digests', 'Action items surfaced', 'Read-only, encrypted tokens'],
    gradient: 'radial-gradient(110% 80% at 30% 75%, #30262c 0%, #130f12 60%, #000 100%)',
  },
  {
    id: 'launch',
    eyebrow: 'Built for teams',
    title: 'Code that reviews itself.',
    body: 'A generator and a critic iterate until the code passes review. Behind it: verified sign-in, per-user isolation, audit logs, and metrics.',
    points: ['Generate → critique → refine', 'Secure by default', 'Self-hosted with Docker'],
    gradient: 'radial-gradient(120% 90% at 50% 20%, #3a2f22 0%, #151210 55%, #000 100%)',
    cta: { label: 'Launch console', to: '/login' },
  },
];
