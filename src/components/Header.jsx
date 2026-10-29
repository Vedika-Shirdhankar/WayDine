import React from 'react';
import { NavLink } from 'react-router-dom';
import { Radio, Zap, BarChart2, Database, User, Download, X } from 'lucide-react';
import { useJourneyEngine } from '../context/JourneyContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getDataSourceStatus } from '../data/restaurantRepository.js';

export function Header() {
  const { dataSourceTag, loadDemoJourney, compareList, isLoading } = useJourneyEngine();
  const { user, showImportPrompt, guestHistoryCount, importGuestHistory, dismissImportPrompt } = useAuth();
  const dbStatus = getDataSourceStatus();

  return (
    <header className="bg-secondary/90 backdrop-blur-md border-b border-borderSubtle px-4 lg:px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base tracking-tight text-textMain hidden sm:inline">
              WayDine
            </span>
            <span className="text-[11px] text-muted italic hidden md:inline">
              "Your Journey. Your Direction. Your Perfect Pitstop."
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Supabase / Local Seed Database Provenance Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-all ${
            dbStatus.isRemote
              ? 'bg-accent/15 border-accent/40 text-accent font-bold shadow-glow-accent'
              : 'bg-card border-borderSubtle text-textMain'
          }`}
          title={`Active persistence layer: ${dbStatus.badgeText}`}
        >
          <Database className={`w-3 h-3 ${dbStatus.isRemote ? 'text-accent animate-pulse' : 'text-muted'}`} />
          <span>{dbStatus.badgeText}</span>
        </div>

        {/* Route Source Badge (hidden on small screens) */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-borderSubtle text-[11px] font-mono">
          <Radio className="w-3 h-3 text-success animate-pulse" />
          <span className="text-muted">Route:</span>
          <span className={`font-semibold ${dataSourceTag.includes('Live') ? 'text-accent' : 'text-textMain'}`}>
            {dataSourceTag}
          </span>
        </div>

        {/* Quick Import Guest History Banner */}
        {user && showImportPrompt && guestHistoryCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-accent text-background font-bold text-xs shadow-glow-accent animate-pulse">
            <button
              onClick={importGuestHistory}
              className="flex items-center gap-1 hover:underline"
              title="Import guest history into your account"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Import Guest History ({guestHistoryCount})</span>
            </button>
            <button
              onClick={dismissImportPrompt}
              className="ml-1 p-0.5 hover:bg-black/20 rounded"
              title="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Quick Demo Button */}
        <button
          onClick={loadDemoJourney}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 text-xs font-bold transition-all shadow-glow-accent cursor-pointer disabled:opacity-50"
          title="Instantly loads the Mumbai to Pune Expressway benchmark dataset"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span className="hidden sm:inline">Load Demo Journey</span>
          <span className="sm:hidden">Demo</span>
        </button>

        {/* User Account Pill */}
        <NavLink
          to="/login"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
            user
              ? 'bg-accent/15 border-accent/40 text-accent font-bold shadow-glow-accent'
              : 'bg-card hover:bg-cardHover border-borderSubtle text-textMain'
          }`}
          title={user ? `Signed in as ${user.email}` : 'Sign in or switch to guest mode'}
        >
          <User className={`w-3.5 h-3.5 ${user ? 'text-accent' : 'text-muted'}`} />
          <span className="hidden sm:inline max-w-[130px] truncate">
            {user ? (user.user_metadata?.full_name || user.email?.split('@')[0]) : 'Guest'}
          </span>
        </NavLink>

        {/* Compare list pill */}
        {compareList.length > 0 && (
          <NavLink
            to="/analytics"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-card hover:bg-cardHover border border-borderSubtle text-xs font-semibold text-textMain transition-colors"
          >
            <BarChart2 className="w-3.5 h-3.5 text-accent" />
            <span>Compare ({compareList.length})</span>
          </NavLink>
        )}
      </div>
    </header>
  );
}
