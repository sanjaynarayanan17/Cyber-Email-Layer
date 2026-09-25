import { useState } from 'react';
import { Shield, Mail, Lock, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password);
        setSuccessMsg('Account created! You can now sign in.');
        setMode('signin');
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('Invalid login credentials')) {
        setError('Incorrect email or password. Please try again.');
      } else if (msg.includes('already registered')) {
        setError('An account with this email already exists. Try signing in instead.');
      } else if (msg.includes('Password should be at least')) {
        setError('Password must be at least 6 characters long.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-teal-500/5 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-teal-600/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="card p-8">
          {/* Logo */}
          <div className="mb-6 flex flex-col items-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600">
              <Shield size={28} className="text-slate-950" />
            </div>
            <h1 className="text-xl font-bold text-slate-100">SentinelMail</h1>
            <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">
              Email Threat Intelligence
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-6 flex gap-1 rounded-lg bg-slate-800/50 p-1">
            <button
              onClick={() => { setMode('signin'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                mode === 'signin' ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                mode === 'signup' ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Create Account
            </button>
          </div>

          <h2 className="mb-1.5 text-lg font-semibold text-slate-200">
            {mode === 'signin' ? 'Sign in to your account' : 'Create a new account'}
          </h2>
          <p className="mb-6 text-sm text-slate-500">
            {mode === 'signin'
              ? 'Enter your email and password to access the platform.'
              : 'Sign up to start analyzing emails and tracking threats.'}
          </p>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-950/20 p-3 text-sm text-red-400">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3 text-sm text-emerald-400">
              <Shield size={16} className="shrink-0" />
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-600">
          SentinelMail — Email Threat Detection, GeoLocation & Forensic Intelligence
        </p>
      </div>
    </div>
  );
}
