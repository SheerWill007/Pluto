import { Suspense, lazy, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut } from 'lucide-react';
import ChatPanel from '../components/chat/ChatPanel';
import RAGPanel from '../components/rag/RAGPanel';
import GmailPanel from '../components/gmail/GmailPanel';
import CodingPanel from '../components/coding/CodingPanel';
import ControlBar from '../components/layout/ControlBar';
import VortexCanvas from '../components/cosmos/VortexCanvas';
import PillNav from '../components/cosmos/PillNav';
import CursorDot from '../components/cosmos/CursorDot';
import { useAgentStatus } from '../hooks/useAgentStatus';
import { useAppStore } from '../store/useAppStore';

// three.js + react-three-fiber are by far the heaviest dependencies; load them on demand
const AgentTopologyCanvas = lazy(() => import('../components/topology/AgentTopologyCanvas'));

const SECTIONS = [
  { id: 'chat', label: 'Chat' },
  { id: 'rag', label: 'Knowledge' },
  { id: 'gmail', label: 'Gmail' },
  { id: 'coding', label: 'Code' },
  { id: 'topology', label: 'Topology' },
];

/** Panels stay mounted so in-flight requests and drafts survive switching tabs. */
function Section({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <motion.div
      initial={false}
      animate={active ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 12, filter: 'blur(8px)' }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 flex flex-col"
      style={{ pointerEvents: active ? 'auto' : 'none', visibility: active ? 'visible' : 'hidden' }}
      aria-hidden={!active}
    >
      {children}
    </motion.div>
  );
}

export const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const activeSection = location.pathname.replace('/', '') || 'chat';
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);

  // Poll component health from the backend
  useAgentStatus(3000);

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-[#03050a] font-sans text-stone-200">
      <CursorDot />
      <div className="absolute inset-0">
        <VortexCanvas className="absolute inset-0" zoom={0.75} centerY={0.38} orbit={0.06} brightness={0.75} maxDpr={0.75} reactToScroll={false} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/55 to-black/80" />
      </div>

      <header className="relative z-20 flex flex-col items-center gap-3 px-4 pt-4">
        <PillNav
          activeId={activeSection}
          onLogoClick={() => navigate('/chat')}
          items={SECTIONS.map((s) => ({ id: s.id, label: s.label, onClick: () => navigate(`/${s.id}`) }))}
          action={
            <div className="flex items-center gap-1.5">
              {user?.picture && (
                <img src={user.picture} alt="" className="h-7 w-7 rounded-full border border-white/15" referrerPolicy="no-referrer" />
              )}
              <button
                type="button"
                onClick={() => logout()}
                title={user?.email ? `Sign out (${user.email})` : 'Sign out'}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <span className="hidden sm:inline">{user?.auth_provider === 'guest' ? 'Guest' : 'Sign out'}</span>
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          }
        />
        <ControlBar />
      </header>

      <main className="glass-panel relative z-10 mx-3 mb-3 mt-3 min-h-0 flex-1 overflow-hidden rounded-[30px] shadow-[0_30px_120px_-30px_rgba(0,0,0,0.9)] sm:mx-6 sm:mb-6">
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-beige-300/40 to-transparent" />
        <Section active={activeSection === 'chat'}>
          <ChatPanel />
        </Section>
        <Section active={activeSection === 'rag'}>
          <RAGPanel />
        </Section>
        <Section active={activeSection === 'gmail'}>
          <GmailPanel />
        </Section>
        <Section active={activeSection === 'coding'}>
          <CodingPanel />
        </Section>
        <AnimatePresence>
          {activeSection === 'topology' && (
            <motion.div
              key="topology"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col"
            >
              <Suspense fallback={<div className="flex flex-1 items-center justify-center font-mono text-xs text-stone-400">Loading topology…</div>}>
                <AgentTopologyCanvas onClose={() => navigate('/chat')} />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Dashboard;
