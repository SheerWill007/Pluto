import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';
import SectionWrapper from '../components/layout/SectionWrapper';
import ChatPanel from '../components/chat/ChatPanel';
import RAGPanel from '../components/rag/RAGPanel';
import GmailPanel from '../components/gmail/GmailPanel';
import CodingPanel from '../components/coding/CodingPanel';
import AgentTopologyCanvas from '../components/topology/AgentTopologyCanvas';
import { useAppStore } from '../store/useAppStore';
import { useAgentStatus } from '../hooks/useAgentStatus';

export const Dashboard = () => {
  const location = useLocation();
  const activeSection = location.pathname.replace('/', '') || 'chat';
  const [showTopology, setShowTopology] = useState(true);

  // Initialize status polling from FastAPI backend
  useAgentStatus(3000);

  return (
    <div className="flex h-screen w-screen bg-[#F5F2EB] dark:bg-stone-950 text-stone-900 dark:text-stone-100 min-h-0 overflow-hidden font-sans">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main Column */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        {/* Topbar credentials & tools selector */}
        <Topbar showTopology={showTopology} setShowTopology={setShowTopology} />

        {/* Dashboard Grid workspace */}
        <div className="flex-1 flex h-full min-h-0 overflow-hidden">
          {showTopology ? (
            <div className="flex-grow h-full min-h-0 overflow-hidden z-10 flex flex-col">
              <AgentTopologyCanvas onClose={() => setShowTopology(false)} />
            </div>
          ) : (
            <main className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-transparent z-10 relative">
              <SectionWrapper isActive={activeSection === 'chat'}>
                <ChatPanel />
              </SectionWrapper>
              <SectionWrapper isActive={activeSection === 'rag'}>
                <RAGPanel />
              </SectionWrapper>
              <SectionWrapper isActive={activeSection === 'gmail'}>
                <GmailPanel />
              </SectionWrapper>
              <SectionWrapper isActive={activeSection === 'coding'}>
                <CodingPanel />
              </SectionWrapper>
            </main>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
