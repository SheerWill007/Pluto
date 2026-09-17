import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Mail, Lock, Eye, EyeOff, LogIn, Sparkles, Shield, Zap, User } from 'lucide-react';
import GlassCard from '../components/ui/GlassCard';
import PulseOrb from '../components/ui/PulseOrb';
import ParticleText from '../components/ui/ParticleText';
import ScrollExpand from '../components/ui/ScrollExpand';
import WebThreads from '../components/ui/WebThreads';
import { useAppStore } from '../store/useAppStore';

const floatingVariants = {
  animate: (i) => ({
    y: i % 2 === 0 ? [-8, 8, -8] : [8, -8, 8],
    rotate: i % 2 === 0 ? [-1, 1, -1] : [1, -1, 1],
    transition: {
      duration: 6 + i,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  })
};

// Cryptographic helpers for PKCE (RFC 7636)
const generateRandomString = (length) => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const values = new Uint8Array(length);
  window.crypto.getRandomValues(values);
  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length];
  }
  return result;
};

const sha256 = async (plain) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
};

const base64urlencode = (buffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const generateChallengeOfVerifier = async (verifier) => {
  const hashed = await sha256(verifier);
  return base64urlencode(hashed);
};

const featureCards = [
  { icon: Sparkles, label: 'Multi-Agent', desc: 'Collaborative autonomous nodes' },
  { icon: Shield, label: 'Secure', desc: 'Encrypted session storage' },
  { icon: Zap, label: 'Real-time', desc: 'Live agent topology map' },
];

const featureChips = [
  'Chat',
  'Document Intelligence',
  'Email Triage',
  'Code Generation'
];

export const Login = () => {
  const navigate = useNavigate();
  const login = useAppStore((s) => s.login);
  const loginWithGoogle = useAppStore((s) => s.loginWithGoogle);
  const signup = useAppStore((s) => s.signup);
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Read configured Google client_id and client_secret from localStorage or environment
  const [googleClientId, setGoogleClientId] = useState(
    localStorage.getItem('atlas_google_client_id') || import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
  );
  const [googleClientSecret, setGoogleClientSecret] = useState(
    localStorage.getItem('atlas_google_client_secret') || import.meta.env.VITE_GOOGLE_CLIENT_SECRET || ''
  );
  const cardGlowRef = useRef(null);

  const handleCardMouseMove = (e) => {
    if (!cardGlowRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cardGlowRef.current.style.setProperty('--x', `${x}px`);
    cardGlowRef.current.style.setProperty('--y', `${y}px`);
    cardGlowRef.current.style.opacity = '1';
  };

  const handleCardMouseLeave = () => {
    if (!cardGlowRef.current) return;
    cardGlowRef.current.style.opacity = '0';
  };

  // Check URL query parameters for auth code on mount (PKCE redirect callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setIsLoading(true);
      setError('');
      const verifier = sessionStorage.getItem('google_oauth_code_verifier');
      
      if (!verifier) {
        setError('OAuth verification code verifier is missing. Please try signing in again.');
        setIsLoading(false);
        return;
      }

      // Exchange Authorization Code for Access Token using PKCE verifier + client_secret
      const storedSecret = sessionStorage.getItem('google_oauth_client_secret') || googleClientSecret;
      const tokenParams = {
          client_id: googleClientId,
          client_secret: storedSecret,
          code_verifier: verifier,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: window.location.origin
      };
      fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(tokenParams)
      })
        .then((res) => {
          if (!res.ok) {
            return res.json().then((errInfo) => {
              throw new Error(errInfo.error_description || 'Failed to exchange authorization code');
            });
          }
          return res.json();
        })
        .then((tokens) => {
          const accessToken = tokens.access_token;
          // Fetch Google user profile details
          return fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`);
        })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to retrieve Google user profile');
          return res.json();
        })
        .then((data) => {
          loginWithGoogle({
            email: data.email.trim().toLowerCase(),
            name: data.name || 'Google User',
            picture: data.picture || ''
          });
          // Clean query parameters from URL and session storage
          window.history.replaceState(null, null, window.location.pathname);
          sessionStorage.removeItem('google_oauth_code_verifier');
          sessionStorage.removeItem('google_oauth_client_secret');
          navigate('/chat');
        })
        .catch((err) => {
          setError(`Google login failed: ${err.message}`);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [loginWithGoogle, googleClientId, googleClientSecret, navigate]);

  const handleGoogleLogin = async () => {
    if (!googleClientId.trim()) {
      setError('Please configure a valid Google Client ID.');
      return;
    }
    setError('');
    // Persist configured client ID
    localStorage.setItem('atlas_google_client_id', googleClientId.trim());
    localStorage.setItem('atlas_google_client_secret', googleClientSecret.trim());
    sessionStorage.setItem('google_oauth_client_secret', googleClientSecret.trim());

    // 1. Prefer Google Identity Services (GIS) popup flow (does not suffer from redirect_uri mismatch)
    if (window.google?.accounts?.oauth2) {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: googleClientId.trim(),
          scope: 'openid profile email',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              setError(`Google Sign-In: ${tokenResponse.error_description || tokenResponse.error}`);
              return;
            }
            try {
              setIsLoading(true);
              const userInfoRes = await fetch(
                `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${tokenResponse.access_token}`
              );
              if (!userInfoRes.ok) throw new Error('Failed to retrieve user profile from Google');
              const data = await userInfoRes.json();
              await loginWithGoogle({
                email: data.email.trim().toLowerCase(),
                name: data.name || 'Google User',
                picture: data.picture || ''
              });
              navigate('/chat');
            } catch (err) {
              setError(`Google login failed: ${err.message}`);
            } finally {
              setIsLoading(false);
            }
          }
        });
        tokenClient.requestAccessToken({ prompt: 'consent' });
        return;
      } catch (err) {
        console.warn('GIS popup initialization failed, falling back to redirect:', err);
      }
    }

    // 2. Fallback: Standard OAuth redirect flow
    try {
      // Generate PKCE code verifier and challenge
      const verifier = generateRandomString(64);
      sessionStorage.setItem('google_oauth_code_verifier', verifier);
      const challenge = await generateChallengeOfVerifier(verifier);

      const redirectUri = window.location.origin;
      // Construct auth url using response_type=code with PKCE parameters
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(googleClientId.trim())}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20profile%20email&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256`;
      
      // Redirect in the same tab
      window.location.href = googleAuthUrl;
    } catch (err) {
      setError(`Failed to initiate Google Login: ${err.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isSignUp) {
      if (!name.trim() || !email.trim() || !password.trim()) {
        setError('Please fill in all fields.');
        return;
      }
      setIsLoading(true);
      const res = await signup(name.trim(), email.trim(), password);
      if (!res.success) {
        setError(res.error || 'Registration failed.');
        setIsLoading(false);
      } else {
        navigate('/chat');
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setError('Please enter your email and password.');
        return;
      }
      setIsLoading(true);
      const res = await login(email.trim(), password, remember);
      if (!res.success) {
        setError(res.error || 'Invalid credentials.');
        setIsLoading(false);
      } else {
        navigate('/chat');
      }
    }
  };

  return (
    <div className="login-page-scrollable relative min-h-screen w-full bg-beige-100 dark:bg-stone-950 flex flex-col items-center justify-center p-6 font-sans z-10 gap-6">
      {/* Ambient floating glass panels */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          custom={0}
          variants={floatingVariants}
          animate="animate"
          className="absolute top-[12%] left-[8%] w-48 h-48 rounded-3xl bg-white/25 dark:bg-stone-800/25 border border-white/50 dark:border-stone-700 backdrop-blur-2xl shadow-[0_20px_60px_rgba(168,152,120,0.08)] hidden lg:block pointer-events-none"
        />
        <motion.div
          custom={1}
          variants={floatingVariants}
          animate="animate"
          className="absolute bottom-[18%] right-[10%] w-56 h-32 rounded-3xl bg-white/35 dark:bg-stone-800/35 border border-white/50 dark:border-stone-700 backdrop-blur-xl shadow-[0_20px_60px_rgba(28,25,23,0.05)] hidden lg:block pointer-events-none"
        />
        <motion.div
          custom={2}
          variants={floatingVariants}
          animate="animate"
          className="absolute top-[22%] right-[18%] w-28 h-28 rounded-full bg-gradient-to-br from-beige-200/30 to-beige-400/10 border border-beige-200/40 dark:border-stone-700 backdrop-blur-md shadow-[0_12px_40px_rgba(168,152,120,0.08)] hidden md:block pointer-events-none"
        />
        <motion.div
          custom={3}
          variants={floatingVariants}
          animate="animate"
          className="absolute bottom-[28%] left-[14%] w-36 h-36 rounded-2xl bg-white/30 dark:bg-stone-800/30 border border-stone-200/40 dark:border-stone-700 backdrop-blur-lg shadow-[0_16px_48px_rgba(28,25,23,0.04)] hidden md:block pointer-events-none"
        />
      </div>

      {/* ATLAS Title Header */}
      <div className="relative w-full max-w-3xl h-20 md:h-24 shrink-0 pointer-events-auto flex items-center justify-center">
        <ParticleText
          text="ATLAS"
          particleSize={2}
          density={4}
          color="#a89878"
          highlightColor="#e8dfd0"
          scatter={180}
          gatherDuration={1600}
          stagger={420}
          trigger="mount"
          fontSize="clamp(2.5rem, 9vw, 6rem)"
          fontWeight={800}
          glow
        />
      </div>

      {/* Full-width Woven Thread Line Divider */}
      <div className="relative -mx-6 w-[calc(100%+3rem)] h-12 md:h-14 shrink-0 pointer-events-none overflow-hidden [mask-image:linear-gradient(to_bottom,transparent_0%,black_20%,black_80%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_20%,black_80%,transparent_100%)]">
        <WebThreads
          color1="#A89878"
          color2="#8B7D6B"
          color3="#E8DFD0"
          speed={0.15}
          threadCount={6}
          frequency={4.5}
          spread={0.22}
          taper={1.0}
          position={0.5}
          fanMode="center"
          glow={0.03}
          falloff={0.65}
          thickness={1.1}
          brightness={0.7}
          opacity={0.7}
          mirror={true}
          shimmer={true}
          grain={false}
          grainIntensity={0.0}
          mouseInteraction={true}
          mouseStrength={0.35}
        />
      </div>

      <div className="relative z-10 w-full shrink-0">
        <ScrollExpand
          mediaType="gradient"
          gradientColors={['#c4b5a0', '#3a2f22']}
          titleContent="MULTI-AGENT SYSTEM"
          scrollHint="Scroll to sign in"
          scrollDistance={1}
          holdDistance={0.2}
          useWindowScroll
          lockExpanded={showLoginForm}
          onMouseMove={handleCardMouseMove}
          onMouseLeave={handleCardMouseLeave}
        >
          {/* Subtle dot-grid texture layered behind text content with idle ambient pulse */}
          <div 
            className="absolute inset-0 pointer-events-none z-0 scroll-expand__dot-grid-animated"
            style={{
              backgroundImage: 'radial-gradient(rgba(232, 223, 208, 0.3) 1.2px, transparent 1.2px)',
              backgroundSize: '24px 24px',
              backgroundPosition: 'center',
              maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 40%, rgba(0,0,0,0.5) 80%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 40%, rgba(0,0,0,0.5) 80%, transparent 100%)',
            }}
          />

          {/* Mouse-following radial glow spotlight */}
          <div 
            ref={cardGlowRef}
            className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-300 z-[1]"
            style={{
              background: 'radial-gradient(circle 320px at var(--x, 50%) var(--y, 50%), rgba(232, 223, 208, 0.28) 0%, rgba(210, 195, 175, 0.12) 40%, transparent 70%)',
            }}
          />

          <h2 className="relative z-10 text-2xl md:text-4xl font-extrabold text-white mb-3">
            Multi-Agent Orchestration, Simplified
          </h2>
          <p className="relative z-10 text-sm md:text-base text-white/80 max-w-xl mb-5 leading-relaxed">
            Atlas coordinates chat, document intelligence, email triage, and code 
            generation through a single agent workspace — built for speed, clarity, 
            and control.
          </p>

          {/* Feature chips row */}
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-2 md:gap-2.5 max-w-lg mb-6">
            {featureChips.map((chip) => (
              <span
                key={chip}
                className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/[0.18] border border-white/20 hover:border-white/45 text-white/90 hover:text-white text-xs font-medium tracking-wide shadow-sm hover:shadow-[0_0_12px_rgba(232,223,208,0.35)] transition-all duration-200 ease-out select-none cursor-default"
              >
                {chip}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setShowLoginForm(true);
              setTimeout(() => {
                const el = document.getElementById('login-form-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }, 50);
            }}
            className="relative z-10 px-6 py-3 rounded-xl bg-white text-stone-900 font-semibold text-sm hover:bg-white/90 transition-colors cursor-pointer"
          >
            Click here for Login
          </button>
        </ScrollExpand>
      </div>

      {showLoginForm && (
        <div id="login-form-section" className="relative z-10 w-full max-w-5xl flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16">
        {/* Feature cards — desktop side panel */}
        <motion.div
          initial={{ opacity: 0, x: -24, filter: 'blur(8px)' }}
          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="hidden lg:flex flex-col gap-4 w-56 shrink-0"
        >
          {featureCards.map(({ icon: Icon, label, desc }, i) => (
            <motion.div
              key={label}
              custom={i}
              variants={floatingVariants}
              animate="animate"
            >
              <GlassCard className="p-4! rounded-2xl bg-white/50 dark:bg-stone-900/60 backdrop-blur-xl border-white/60 dark:border-stone-700">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-beige-150 dark:bg-stone-800 border border-beige-200 dark:border-stone-700 shrink-0">
                    <Icon className="h-4 w-4 text-beige-600 dark:text-beige-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-800 dark:text-stone-200 tracking-wide">{label}</p>
                    <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>

        {/* Main login card */}
        <motion.div
          initial={{ opacity: 0, y: 20, filter: 'blur(12px)', scale: 0.97 }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
          transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
          className="w-full max-w-md"
        >
          <GlassCard className="p-8! rounded-3xl bg-white/25 dark:bg-stone-900/70 backdrop-blur-2xl border-white/55 dark:border-stone-700 shadow-[0_24px_64px_rgba(168,152,120,0.12)]">
            {/* Brand header */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="p-4 rounded-2xl bg-gradient-to-tr from-beige-400 to-beige-600 shadow-[0_8px_24px_rgba(168,152,120,0.25)] mb-5">
                <Cpu className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-2xl font-extrabold text-stone-900 dark:text-stone-100 tracking-wide">
                Atlas Agent Console
              </h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-2 leading-relaxed max-w-xs">
                {isSignUp ? 'Create a new account' : 'Sign in to access your multi-agent orchestration workspace'}
              </p>
              <div className="flex items-center gap-1.5 mt-4 px-3 py-1 rounded-full bg-white/35 dark:bg-stone-800/50 border border-white/50 dark:border-stone-700">
                <PulseOrb status="idle" />
                <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 font-mono uppercase tracking-wider">
                  Secure Access
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Name (Sign Up only) */}
              {isSignUp && (
                <div className="flex flex-col gap-1.5 animate-fadeIn">
                  <label className="text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider font-mono">
                    Full Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full bg-white/70 dark:bg-stone-800/70 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 placeholder:text-stone-400 dark:placeholder:text-stone-500 text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-beige-400 dark:focus:border-stone-500 backdrop-blur-md transition-colors"
                    />
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 dark:text-stone-500" />
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider font-mono">
                  Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                    className="w-full bg-white/70 dark:bg-stone-800/70 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 placeholder:text-stone-400 dark:placeholder:text-stone-500 text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-beige-400 dark:focus:border-stone-500 backdrop-blur-md transition-colors"
                  />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 dark:text-stone-500" />
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider font-mono">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isSignUp ? "Create a password" : "Enter your password"}
                    autoComplete="current-password"
                    className="w-full bg-white/70 dark:bg-stone-800/70 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 placeholder:text-stone-400 dark:placeholder:text-stone-500 text-sm rounded-xl pl-10 pr-10 py-2.5 focus:outline-none focus:border-beige-400 dark:focus:border-stone-500 backdrop-blur-md transition-colors"
                  />
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 dark:text-stone-500" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me (Sign In only) */}
              {!isSignUp && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-beige-600 focus:ring-beige-400/30 cursor-pointer"
                  />
                  <span className="text-xs text-stone-600 dark:text-stone-300">Remember this device</span>
                </label>
              )}

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 rounded-xl px-3 py-2 font-medium"
                >
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center justify-center gap-2.5 w-full py-3 mt-1 rounded-xl bg-gradient-to-r from-beige-400 to-beige-600 hover:from-beige-300 hover:to-beige-500 text-white font-semibold text-sm transition-all disabled:opacity-60 shadow-[0_4px_16px_rgba(168,152,120,0.25)] cursor-pointer"
              >
                {isLoading ? (
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                <span>{isLoading ? (isSignUp ? 'Creating Account...' : 'Signing in…') : (isSignUp ? 'Create Account' : 'Sign In')}</span>
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-stone-200/60 dark:border-stone-700"></div>
                <span className="flex-shrink mx-4 text-[10px] text-stone-400 dark:text-stone-500 font-bold uppercase tracking-wider font-mono">or</span>
                <div className="flex-grow border-t border-stone-200/60 dark:border-stone-700"></div>
              </div>

              {/* Native same-tab Google Sign-In / Gmail Sign-Up button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="flex items-center justify-center gap-2.5 w-full py-3 mt-1 rounded-xl border border-stone-200/80 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 font-semibold text-sm transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)] cursor-pointer"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.23 2.68 1.21 6.62l4.056 3.145z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M16.04 15.345c-1.077.737-2.43 1.173-4.04 1.173-3.69 0-6.8-2.482-7.918-5.836L1.05 13.918C3.073 17.882 7.18 20.6 12 20.6c3.136 0 5.99-.982 8.04-2.818l-4-3.436z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.49 12.273c0-.827-.073-1.627-.21-2.4H12v4.545h6.482C18.2 15.373 17.11 16.327 16.04 17.064l4 3.436C22.38 18.273 23.49 15.545 23.49 12.273z"
                  />
                  <path
                    fill="#34A853"
                    d="M4.082 10.682a7.03 7.03 0 0 1 0-2.364L1.027 5.173A11.974 11.974 0 0 0 0 12c0 2.455.373 4.8 1.027 7.018l3.055-3.136z"
                  />
                </svg>
                <span>{isSignUp ? 'Sign up with Gmail' : 'Sign in with Google'}</span>
              </button>

              {/* Continue as Guest button */}
              <button
                type="button"
                onClick={() => {
                  // Skip authentication and continue as guest
                  useAppStore.getState().loginAsGuest();
                  navigate('/chat');
                }}
                className="flex items-center justify-center gap-2.5 w-full py-2.5 mt-1 rounded-xl border border-stone-200/60 dark:border-stone-700 bg-white/40 dark:bg-stone-800/40 hover:bg-white/60 dark:hover:bg-stone-800/70 text-stone-600 dark:text-stone-300 font-medium text-sm transition-all shadow-[0_2px_8px_rgba(0,0,0,0.01)] cursor-pointer backdrop-blur-sm"
              >
                <Sparkles className="h-4 w-4" />
                <span>Continue as Guest</span>
              </button>
            </form>

            <div className="mt-6 text-center text-xs select-none border-t border-stone-100 dark:border-stone-800 pt-4">
              <span className="text-stone-500 dark:text-stone-400 font-sans">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              </span>{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                }}
                className="font-bold text-beige-600 dark:text-beige-400 hover:text-beige-500 dark:hover:text-beige-300 hover:underline cursor-pointer font-sans"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </div>
          </GlassCard>
        </motion.div>

        {/* Mobile feature pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex lg:hidden flex-wrap justify-center gap-2 max-w-md"
        >
          {featureCards.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/60 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-700 backdrop-blur-md text-[10px] font-bold text-stone-600 dark:text-stone-300"
            >
              <Icon className="h-3 w-3 text-beige-600 dark:text-beige-400" />
              {label}
            </div>
          ))}
        </motion.div>
      </div>
      )}
    </div>
  );
};

export default Login;
