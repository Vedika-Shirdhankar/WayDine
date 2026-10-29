import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';

/**
 * /404 – Not Found page shown when no route matches.
 */
export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Large compass icon */}
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-3xl bg-accent/10 border border-accent/30 flex items-center justify-center shadow-glow-accent">
            <Compass className="w-14 h-14 text-accent animate-pulse" />
          </div>
        </div>

        {/* 404 number */}
        <div>
          <p className="text-8xl font-extrabold text-accent leading-none tracking-tight">
            404
          </p>
          <h1 className="mt-3 text-2xl font-extrabold text-textMain">
            Page Not Found
          </h1>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            The route to this page doesn't exist in our road graph.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3 rounded-xl bg-accent hover:bg-accentHover text-background text-sm font-extrabold flex items-center justify-center gap-2 shadow-glow-accent transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
            aria-label="Back to Dashboard"
          >
            Back to Dashboard
          </button>

          <Link
            to="/"
            className="w-full py-3 rounded-xl bg-secondary border border-borderSubtle text-muted hover:text-textMain text-sm font-semibold flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
          >
            Go to Home
          </Link>
        </div>

        <p className="text-[10px] text-muted">
          WayDine · Smart Pitstop Intelligence
        </p>
      </div>
    </div>
  );
}
