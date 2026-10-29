import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, Zap, Lock, ArrowRight, Info } from 'lucide-react';

/**
 * /login – auth page with guest mode support.
 * Supabase login form is shown only when VITE_SUPABASE_URL is defined.
 * All features work without login — data is stored in localStorage.
 */
export function LoginPage() {
  const navigate = useNavigate();

  function GuestOnly() {
    return (
      <div className="space-y-4">
        {/* Guest mode info box */}
        <div className="p-3 rounded-xl bg-secondary border border-accent/30 text-[11px] text-muted flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
          <span>
            No account needed. All features work without login. Data is stored in your browser's localStorage.
          </span>
        </div>

        {/* Placeholder note */}
        <div className="p-3 rounded-xl bg-secondary border border-borderSubtle text-[11px] text-muted flex items-start gap-2">
          <Lock className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
          <span>
            Authentication is a placeholder for the hackathon demo. No login is required — the app works fully
            offline with the built-in Mumbai → Pune seed data.
          </span>
        </div>

        {/* Continue as Guest */}
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full py-3 rounded-xl bg-accent hover:bg-accentHover text-background text-xs font-extrabold flex items-center justify-center gap-2 shadow-glow-accent transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
          aria-label="Continue as Guest – go to Dashboard"
        >
          <Zap className="w-4 h-4 fill-current" />
          Continue as Guest (Demo Mode)
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  function SupabaseForm() {
    return (
      <div className="space-y-4">
        {/* Guest mode info box */}
        <div className="p-3 rounded-xl bg-secondary border border-accent/30 text-[11px] text-muted flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
          <span>
            No account needed. All features work without login. Data is stored in your browser's localStorage.
          </span>
        </div>

        {/* Email & Password fields */}
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-muted font-medium block mb-1">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              disabled
              className="w-full bg-secondary border border-borderSubtle rounded-xl px-3 py-2 text-xs text-textMain placeholder-muted/50 opacity-60 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted font-medium block mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              disabled
              className="w-full bg-secondary border border-borderSubtle rounded-xl px-3 py-2 text-xs text-textMain placeholder-muted/50 opacity-60 cursor-not-allowed"
            />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-secondary border border-borderSubtle text-[11px] text-muted flex items-start gap-2">
          <Lock className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
          <span>
            Authentication is a placeholder for the hackathon demo. No login is required — the app works fully
            offline with the built-in Mumbai → Pune seed data.
          </span>
        </div>

        {/* Continue as Guest – prominent */}
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full py-3 rounded-xl bg-accent hover:bg-accentHover text-background text-xs font-extrabold flex items-center justify-center gap-2 shadow-glow-accent transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
          aria-label="Continue as Guest – go to Dashboard"
        >
          <Zap className="w-4 h-4 fill-current" />
          Continue as Guest (Demo Mode)
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

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
          <h2 className="text-sm font-bold text-textMain text-center">Sign In</h2>

          {import.meta.env.VITE_SUPABASE_URL ? <SupabaseForm /> : <GuestOnly />}
        </div>

        <p className="text-[10px] text-muted text-center">
          No data leaves your browser. Engine: 100% deterministic graph algorithms.
        </p>
      </div>
    </div>
  );
}
