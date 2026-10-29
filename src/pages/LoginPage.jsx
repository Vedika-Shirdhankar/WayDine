import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Zap, ArrowRight, CheckCircle2, AlertCircle, LogOut, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';

/**
 * /login – Authentication page with Supabase Auth and Guest mode support.
 * - Logged-in users save to Supabase.
 * - Guests save to browser localStorage.
 * - On login, offers to import local guest history into the user's account.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const { user, signIn, signUp, signOut, isConfigured, guestHistoryCount, importGuestHistory } = useAuth();
  const { addToast } = useToast();

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [importing, setImporting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (mode === 'signin') {
        await signIn(email, password);
        addToast('Welcome back! Signed in successfully.', 'success');
      } else {
        await signUp(email, password, fullName);
        addToast('Account created successfully! Check your email if verification is required.', 'success');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await importGuestHistory();
      addToast(`Imported ${res.imported} pitstop(s) to your Supabase account!`, 'success');
    } catch (err) {
      setErrorMsg('Failed to import guest history: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto shadow-glow-accent">
            <Compass className="w-7 h-7 text-accent animate-pulse" />
          </div>
          <h1 className="text-2xl font-extrabold text-textMain">WayDine</h1>
          <p className="text-xs text-muted italic">"Your Journey. Your Direction. Your Perfect Pitstop."</p>
        </div>

        {/* Auth card */}
        <div className="bg-card border border-borderSubtle rounded-2xl p-6 space-y-4 shadow-2xl">
          <h2 className="text-sm font-bold text-textMain text-center">
            {user ? 'Account' : (mode === 'signin' ? 'Sign In' : 'Create Account')}
          </h2>

          {user ? (
            /* Logged In View */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-secondary/80 border border-success/30 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-textMain">Signed In via Supabase</h3>
                  <p className="text-[11px] text-muted">{user?.email}</p>
                  <p className="text-[10px] text-muted">
                    Preferences and pitstop history are now synced directly to your Supabase cloud database.
                  </p>
                </div>
              </div>

              {guestHistoryCount > 0 && (
                <div className="p-3.5 rounded-xl bg-accent/10 border border-accent/40 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-accent">
                    <Download className="w-4 h-4" />
                    <span>Import Guest History</span>
                  </div>
                  <p className="text-[11px] text-textMain">
                    You have <strong>{guestHistoryCount}</strong> pitstop(s) saved from offline guest mode on this device.
                    Would you like to import them to your account?
                  </p>
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="w-full py-2 px-3 rounded-lg bg-accent hover:bg-accentHover text-background text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-glow-accent disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {importing ? 'Importing...' : `Import ${guestHistoryCount} Pitstop(s) Now`}
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-accentHover text-background text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-glow-accent transition-all"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={signOut}
                  className="py-2.5 px-4 rounded-xl bg-secondary hover:bg-white/10 text-muted hover:text-textMain border border-borderSubtle text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : isConfigured ? (
            /* Supabase Active Form */
            <div className="space-y-4">
              {/* Toggle Sign In / Sign Up */}
              <div className="flex rounded-xl bg-secondary p-1 border border-borderSubtle">
                <button
                  type="button"
                  onClick={() => { setMode('signin'); setErrorMsg(''); }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    mode === 'signin' ? 'bg-accent text-background shadow-sm' : 'text-muted hover:text-textMain'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setErrorMsg(''); }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    mode === 'signup' ? 'bg-accent text-background shadow-sm' : 'text-muted hover:text-textMain'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-[11px] text-danger flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === 'signup' && (
                  <div>
                    <label className="text-[11px] text-muted font-medium block mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Piyusha Sharma"
                      className="w-full bg-secondary border border-borderSubtle rounded-xl px-3 py-2 text-xs text-textMain placeholder-muted/50 focus:outline-none focus:border-accent"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[11px] text-muted font-medium block mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-secondary border border-borderSubtle rounded-xl px-3 py-2 text-xs text-textMain placeholder-muted/50 focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-muted font-medium block mb-1">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-secondary border border-borderSubtle rounded-xl px-3 py-2 text-xs text-textMain placeholder-muted/50 focus:outline-none focus:border-accent"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-accent hover:bg-accentHover text-background text-xs font-extrabold flex items-center justify-center gap-2 shadow-glow-accent transition-all disabled:opacity-50"
                >
                  {loading ? 'Please wait...' : (mode === 'signin' ? 'Sign In to Supabase' : 'Create Account')}
                </button>
              </form>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-borderSubtle"></div>
                <span className="flex-shrink mx-2 text-[10px] text-muted uppercase tracking-wider">or</span>
                <div className="flex-grow border-t border-borderSubtle"></div>
              </div>

              {/* Continue as Guest */}
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="w-full py-2.5 rounded-xl bg-secondary hover:bg-white/10 border border-borderSubtle text-textMain text-xs font-bold flex items-center justify-center gap-2 transition-all"
              >
                <Zap className="w-3.5 h-3.5 text-accent fill-current" />
                <span>Continue as Guest (Offline / Demo)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            /* Unconfigured / Guest Only View */
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-secondary/80 border border-borderSubtle text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-textMain">
                  <Zap className="w-4 h-4 text-accent" />
                  <span>Guest Mode Active</span>
                </div>
                <p className="text-[11px] text-muted">
                  Supabase credentials are not configured in your <code>.env</code> file. WayDine runs 100% locally with sample data.
                </p>
                <span className="text-[10px] text-muted block">
                  The demo is currently running on the high-fidelity Mumbai → Pune local dataset.
                </span>
              </div>

              {/* Continue as Guest */}
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-3 rounded-xl bg-accent hover:bg-accentHover text-background text-xs font-extrabold flex items-center justify-center gap-2 shadow-glow-accent transition-all"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>Continue as Guest (Demo Mode)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted text-center">
          {isConfigured
            ? 'Supabase Cloud Backend Active • Row Level Security Enforced'
            : 'Zero API keys required • Deterministic Highway Graph Algorithms'}
        </p>
      </div>
    </div>
  );
}
