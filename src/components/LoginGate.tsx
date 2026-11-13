import { useState, type FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { ArrowRight, Coffee, Eye, EyeOff, Lock, Mail, Sparkles } from 'lucide-react';
import { auth, googleProvider } from '../firebase.ts';

interface LoginGateProps {
  onStartDemo: () => void;
}

export function LoginGate({ onStartDemo }: LoginGateProps) {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [providerHelp, setProviderHelp] = useState(false);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setProviderHelp(false);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setErrorMsg('Google sign-in popup was closed before completing.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to sign in with Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setProviderHelp(false);

    if (!email.trim() || password.length < 6) {
      setErrorMsg('Enter a valid email address and a password with at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (authMode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (fullName.trim()) {
          await updateProfile(cred.user, { displayName: fullName.trim() });
        }
        await sendEmailVerification(cred.user).catch(() => {});
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setProviderHelp(true);
        setErrorMsg(
          'Email/Password sign-in is not enabled in this Firebase project yet. Enable it in Firebase Console or use Google Sign-In / Instant Demo below.'
        );
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setErrorMsg('Incorrect email or password. Please check your credentials and try again.');
      } else if (code === 'auth/email-already-in-use') {
        setErrorMsg('An account with this email already exists. Switch to Sign In above.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-6xl bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch shadow-sm">
        {/* Left: Auth & Onboarding Gate */}
        <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-8">
              <span className="font-display text-lg font-bold tracking-tight text-slate-900">
                MarketMind AI
              </span>
              <span className="text-xs text-slate-500">India D2C &amp; SMB Intelligence</span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug text-balance">
              Autonomous growth decisions backed by real Indian SMB outcomes
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-lg">
              Keep your brand margins, CAC, and competitors strictly private while learning from verified, anonymized D2C wins across Bharat in five regional languages.
            </p>

            {/* Instant Demo CTA */}
            <div className="mt-6 p-4 rounded-lg border border-blue-200 bg-blue-50/70">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    Explore immediately with live pre-loaded data
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    RoastCraft India Coffee · ₹850 AOV · 62% Margin
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onStartDemo}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  <Coffee className="h-4 w-4" />
                  <span>Try Instant Demo (RoastCraft India Coffee)</span>
                </button>
              </div>
            </div>

            <div className="relative my-6 flex items-center">
              <div className="flex-grow border-t border-slate-200" />
              <span className="mx-3 text-xs font-medium text-slate-400">
                Or sign in to save your Business DNA
              </span>
              <div className="flex-grow border-t border-slate-200" />
            </div>

            {/* 1-Click Google Sign-In */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-8.97Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Email & Password Login / Sign-Up Toggle */}
            <div className="mt-6">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setErrorMsg(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    authMode === 'signin'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Email Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setErrorMsg(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    authMode === 'signup'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Create Account
                </button>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-3">
                {authMode === 'signup' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Founder Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Ananya Deshmukh"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Work Email
                  </label>
                  <div className="relative">
                    <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="founder@yourbrand.in"
                      className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {errorMsg && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800 space-y-1.5">
                    <p>{errorMsg}</p>
                    {providerHelp && (
                      <p className="text-slate-700">
                        To enable Email/Password: open{' '}
                        <strong>Firebase Console → Authentication → Sign-in method</strong> and enable{' '}
                        <strong>Email/Password</strong>.
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  <span>
                    {loading
                      ? 'Please wait...'
                      : authMode === 'signin'
                        ? 'Sign In with Email'
                        : 'Create Founder Account'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>English</span>
            <span aria-hidden="true">·</span>
            <span>हिंदी</span>
            <span aria-hidden="true">·</span>
            <span>తెలుగు</span>
            <span aria-hidden="true">·</span>
            <span>தமிழ்</span>
            <span aria-hidden="true">·</span>
            <span>मराठी</span>
          </div>
        </div>

        {/* Right: Visual Showcase */}
        <div className="lg:col-span-6 relative min-h-[340px] lg:min-h-full bg-slate-900 flex flex-col justify-end overflow-hidden">
          <img
            src="/src/assets/images/login_d2c_studio_1794558548520.jpg"
            alt="Indian D2C founder workspace with specialty craft coffee pouches and analytics laptop"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent" />
          <div className="relative z-10 p-6 sm:p-10 text-white space-y-5">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-blue-200">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Two-Tier Founder Memory Architecture</span>
            </div>

            <div className="space-y-4">
              <div className="border-t border-white/15 pt-4">
                <h2 className="font-display text-lg font-semibold text-white">
                  Private Business DNA
                </h2>
                <p className="text-sm text-slate-200 mt-1">
                  Your brand AOV, gross margins, ad budget, and competitor moves stay strictly isolated under your verified account.
                </p>
              </div>
              <div className="border-t border-white/15 pt-4">
                <h2 className="font-display text-lg font-semibold text-white">
                  Collective SMB Playbook Network
                </h2>
                <p className="text-sm text-slate-200 mt-1">
                  Verified D2C experiments shared anonymously across categories—never exposing brand names or private financials.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
