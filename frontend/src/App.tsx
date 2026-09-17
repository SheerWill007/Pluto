import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import GlowCursor from './components/ui/GlowCursor';
import { useAppStore } from './store/useAppStore';
import { useLenis } from './hooks/useLenis';

function App() {
  useLenis();
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const fetchBackendConfig = useAppStore((s) => s.fetchBackendConfig);

  React.useEffect(() => {
    fetchBackendConfig();
  }, [fetchBackendConfig]);

  return (
    <BrowserRouter>
      {/* Glow Cursor Effect */}
      <GlowCursor 
        color="#A89878" 
        secondaryColor="#8B7D6B" 
        trailLength={5} 
        trailWidth={3} 
        glowIntensity={0} 
        glowSpread={0} 
        hotspot={0} 
        brightness={1.0} 
        blendMode="normal" 
        idleFade 
      />

      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/chat" replace /> : <Login />} />
        <Route path="/chat" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="/rag" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="/gmail" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="/coding" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to={isAuthenticated ? "/chat" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
