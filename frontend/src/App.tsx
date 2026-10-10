import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import { useLenis } from './hooks/useLenis';
import ErrorBoundary from './components/ErrorBoundary';

// Route-level code splitting: the three.js landing page, the auth page, and the
// dashboard are separate chunks, so each visitor only downloads what they open.
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const GlowCursor = lazy(() => import('./components/ui/GlowCursor'));

function RouteEnhancements() {
  useLenis();

  return (
    <Suspense fallback={null}>
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
    </Suspense>
  );
}

function AppShell() {
  const { pathname } = useLocation();
  return pathname === '/' ? null : <RouteEnhancements />;
}

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F2EB] dark:bg-stone-950" aria-busy="true">
      <span className="h-6 w-6 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

const DASHBOARD_ROUTES = ['/chat', '/rag', '/gmail', '/coding'];

function AppRoutes() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const { pathname } = useLocation();

  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={isAuthenticated ? <Navigate to="/chat" replace /> : <Login />} />
          {DASHBOARD_ROUTES.map((path) => (
            <Route
              key={path}
              path={path}
              element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />}
            />
          ))}
          <Route path="*" element={<Navigate to={isAuthenticated ? '/chat' : '/'} replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

function App() {
  const fetchBackendConfig = useAppStore((s) => s.fetchBackendConfig);

  React.useEffect(() => {
    fetchBackendConfig();
  }, [fetchBackendConfig]);

  return (
    <BrowserRouter>
      <AppShell />
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
