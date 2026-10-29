import React from 'react';
import { NavLink } from 'react-router-dom';
import { Radio, Zap, Layers, BarChart2, ShieldCheck, Compass } from 'lucide-react';
import { useJourneyEngine } from '../context/JourneyContext.jsx';

export function Header() {
  const { dataSourceTag, loadDemoJourney, compareList, isLoading } = useJourneyEngine();

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
        {/* Data Source Provenance Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-borderSubtle text-[11px] font-mono">
          <Radio className="w-3 h-3 text-success animate-pulse" />
          <span className="text-muted">Source:</span>
          <span className={`font-semibold ${dataSourceTag.includes('Live') ? 'text-accent' : 'text-textMain'}`}>
            {dataSourceTag}
          </span>
        </div>

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
