import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Eye, EyeOff, Lock, Mail, Sparkles, User } from 'lucide-react';
import { useAppStore, type GoogleCredential } from '../../store/useAppStore';
import { errorMessage } from '../../lib/api';

// --- PKCE helpers (RFC 7636) for the redirect sign-in fallback ----------------------

const randomString = (length: number) => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (v) => charset[v % charset.length]).join('');
};

const base64url = (buffer: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const challengeFor = async (verifier: string) =>
  base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));

const GoogleIcon = () => (
  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.23 2.68 1.21 6.62l4.056 3.145z" />
    <path fill="#FBBC05" d="M16.04 15.345c-1.077.737-2.43 1.173-4.04 1.173-3.69 0-6.8-2.482-7.918-5.836L1.05 13.918C3.073 17.882 7.18 20.6 12 20.6c3.136 0 5.99-.982 8.04-2.818l-4-3.436z" />
    <path fill="#4285F4" d="M23.49 12.273c0-.827-.073-1.627-.21-2.4H12v4.545h6.482C18.2 15.373 17.11 16.327 16.04 17.064l4 3.436C22.38 18.273 23.49 15.545 23.49 12.273z" />
    <path fill="#34A853" d="M4.082 10.682a7.03 7.03 0 0 1 0-2.364L1.027 5.173A11.974 11.974 0 0 0 0 12c0 2.455.373 4.8 1.027 7.018l3.055-3.136z" />
  </svg>
);

export function AuthCard() {
  const navigate = useNavigate();
  const login = useAppStore((s) => s.login);
  const signup = useAppStore((s) => s.signup);
  const loginWithGoogle = useAppStore((s) => s.loginWithGoogle);
  const loginAsGuest = useAppStore((s) => s.loginAsGuest);
  const authConfig = useAppStore((s) => s.authConfig);
  const fetchAuthConfig = useAppStore((s) => s.fetchAuthConfig);
  const sessionExpired = useAppStore((s) => s.sessionExpired);

  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // The Google client ID is public; the client secret never reaches the browser
  const googleClientId = (authConfig?.google_client_id || import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const allowGuest = authConfig?.allow_guest ?? true;

  useEffect(() => {
    if (!authConfig) fetchAuthConfig();
  }, [authConfig, fetchAuthConfig]);

  const finishGoogleLogin = async (credential: GoogleCredential) => {
    setIsLoading(true);
    const res = await loginWithGoogle(credential);
    setIsLoading(false);
    if (res.success) navigate('/chat');
    else setError(`Google sign-in failed: ${res.error}`);
  };

  // Redirect-flow callback: hand the authorization code to the server for exchange
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    const verifier = sessionStorage.getItem('google_oauth_code_verifier');
    const expectedState = sessionStorage.getItem('google_oauth_state');
    sessionStorage.removeItem('google_oauth_code_verifier');
    sessionStorage.removeItem('google_oauth_state');
    window.history.replaceState(null, '', window.location.pathname);

    if (!verifier || !expectedState || params.get('state') !== expectedState) {
      setError('Google sign-in could not be verified. Please try again.');
      return;
    }
    finishGoogleLogin({ code, code_verifier: verifier, redirect_uri: window.location.origin });
    // Runs once on mount by design
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleLogin = async () => {
    if (!googleClientId) {
      setError('Google sign-in is not configured on this server.');
      return;
    }
    setError('');

    // 1. Prefer the Google Identity Services popup
    if (window.google?.accounts?.oauth2) {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'openid profile email',
          callback: (tokenResponse) => {
            if (tokenResponse.error) {
              setError(`Google Sign-In: ${tokenResponse.error_description || tokenResponse.error}`);
              return;
            }
            // The server verifies this token with Google and reads the identity itself
            finishGoogleLogin({ access_token: tokenResponse.access_token });
          },
        });
        tokenClient.requestAccessToken({ prompt: 'consent' });
        return;
      } catch (err) {
        console.warn('GIS popup initialization failed, falling back to redirect:', err);
      }
    }

    // 2. Fallback: authorization-code redirect with PKCE and a CSRF state value
    try {
      const verifier = randomString(64);
      const state = randomString(32);
      sessionStorage.setItem('google_oauth_code_verifier', verifier);
      sessionStorage.setItem('google_oauth_state', state);
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({
        client_id: googleClientId,
        redirect_uri: window.location.origin,
        response_type: 'code',
        scope: 'openid profile email',
        code_challenge: await challengeFor(verifier),
        code_challenge_method: 'S256',
        state,
      }).toString();
      window.location.href = url.toString();
    } catch (err) {
      setError(`Failed to initiate Google Login: ${errorMessage(err)}`);
    }
  };

  const handleGuest = async () => {
    setError('');
    setIsLoading(true);
    const res = await loginAsGuest();
    setIsLoading(false);
    if (res.success) navigate('/chat');
    else setError(res.error);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (isSignUp && !name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setIsLoading(true);
    const res = isSignUp
      ? await signup(name.trim(), email.trim(), password)
      : await login(email.trim(), password, remember);
    setIsLoading(false);
    if (res.success) navigate('/chat');
    else setError(res.error || (isSignUp ? 'Registration failed.' : 'Invalid credentials.'));
  };

  return (
    <div className="glass-panel relative w-full max-w-md overflow-hidden rounded-[28px] p-7 shadow-[0_40px_120px_-40px_rgba(79,149,214,0.45)] sm:p-9">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-beige-500/25 blur-3xl" />

      {/* Mode switch */}
      <div className="relative mb-7 grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.03] p-1 text-[13px] font-medium">
        {(['Sign in', 'Create account'] as const).map((label, i) => {
          const active = (i === 1) === isSignUp;
          return (
            <button
              key={label}
              type="button"
              onClick={() => {
                setIsSignUp(i === 1);
                setError('');
              }}
              className={`relative rounded-full py-2 transition-colors ${active ? 'text-black' : 'text-white/60 hover:text-white'}`}
            >
              {active && (
                <motion.span layoutId="auth-mode" className="absolute inset-0 rounded-full bg-white" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />
              )}
              <span className="relative">{label}</span>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="relative flex flex-col gap-3.5" noValidate>
        <AnimatePresence initial={false}>
          {isSignUp && (
            <motion.label
              key="name"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="relative block overflow-hidden"
            >
              <span className="sr-only">Full name</span>
              <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                autoComplete="name"
                className="field pl-11"
              />
            </motion.label>
          )}
        </AnimatePresence>

        <label className="relative block">
          <span className="sr-only">Email</span>
          <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            className="field pl-11"
          />
        </label>

        <label className="relative block">
          <span className="sr-only">Password</span>
          <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignUp ? 'Create a password (8+ characters)' : 'Password'}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            className="field pl-11 pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-white/40 transition-colors hover:text-white"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </label>

        {!isSignUp && (
          <label className="flex select-none items-center gap-2.5 px-1 text-xs text-white/55">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-3.5 w-3.5 accent-beige-400"
            />
            Remember this device
          </label>
        )}

        {sessionExpired && !error && (
          <p role="status" className="rounded-2xl border border-beige-400/25 bg-beige-500/10 px-4 py-2.5 text-xs text-beige-200">
            Your session expired. Please sign in again.
          </p>
        )}
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200"
          >
            {error}
          </motion.p>
        )}

        <button type="submit" disabled={isLoading} className="pill-primary mt-1 w-full">
          {isLoading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
          ) : (
            <ArrowUpRight className="h-4 w-4" />
          )}
          {isLoading ? 'One moment…' : isSignUp ? 'Create account' : 'Sign in'}
        </button>

        <div className="my-1 flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-white/30">
          <span className="h-px flex-1 bg-white/10" />
          or
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading || !googleClientId}
          title={googleClientId ? undefined : 'Google sign-in is not configured on this server'}
          className="pill-ghost w-full disabled:cursor-not-allowed disabled:opacity-45"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {allowGuest && (
          <button type="button" onClick={handleGuest} disabled={isLoading} className="pill-ghost w-full disabled:opacity-50">
            <Sparkles className="h-4 w-4 text-beige-300" />
            Continue as guest
          </button>
        )}
      </form>
    </div>
  );
}

export default AuthCard;
