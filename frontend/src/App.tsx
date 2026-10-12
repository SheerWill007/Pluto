import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import ErrorBoundary from './components/ErrorBoundary';

// Route-level code splitting
const Landing = lazy(() => import('./pages/Landing'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#03050a]" aria-busy="true">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-beige-300" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export const DASHBOARD_ROUTES = ['/chat', '/rag', '/gmail', '/coding', '/topology'];

function AppRoutes() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const { pathname } = useLocation();

  // The landing page renders at "/" itself (rather than redirecting) so the Google
  // redirect sign-in callback keeps its ?code=...&state=... query string.
  const landing = isAuthenticated ? <Navigate to="/chat" replace /> : <Landing />;

  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={landing} />
          <Route path="/login" element={landing} />
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
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
