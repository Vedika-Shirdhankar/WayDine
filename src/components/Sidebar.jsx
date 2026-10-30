import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Compass,
  Utensils,
  BarChart2,
  Sliders,
  Car,
  Settings,
  Network,
  GitBranch,
  ChevronRight
} from 'lucide-react';
import { useJourneyEngine } from '../context/JourneyContext.jsx';
import { GraphMiniVisualizer } from './GraphMiniVisualizer.jsx';

export function Sidebar() {
  const { compareList, selectedRecommendation, graphSnapshot, vehicleHeading, dataSourceTag } = useJourneyEngine();
  const [graphOpen, setGraphOpen] = useState(false);

  const navItems = [
    { to: '/dashboard',   label: 'Dashboard',         icon: Compass },
    { to: '/pitstops',    label: 'Explore Pitstops',  icon: Utensils },
    { to: '/simulator',   label: 'Simulator',          icon: Car },
    { to: '/analytics',   label: 'Compare & Analytics', icon: BarChart2,
      badge: compareList.length > 0 ? compareList.length : null },
    { to: '/preferences', label: 'Preferences',       icon: Sliders },
    { to: '/settings',    label: 'Settings',           icon: Settings },
    { to: '/dijkstra',    label: 'Dijkstra Lab',       icon: Network }
  ];

  const hasGraph = graphSnapshot && graphSnapshot.nodes?.length > 0;
  const topRec   = selectedRecommendation;
  const accessClass = topRec?.detourResult?.accessibilityClass || topRec?.restaurant?.accessClass;
  const accessColor = accessClass === 'GREEN'  ? 'text-success'  :
                      accessClass === 'YELLOW' ? 'text-warning'  :
                      accessClass === 'RED'    ? 'text-danger'   : 'text-muted';

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-secondary border-r border-borderSubtle min-h-screen p-4 justify-between shrink-0">
        <div className="space-y-6">
          {/* Logo & Tagline */}
          <Link to="/" className="flex items-center gap-3 px-2 py-1 group transition-opacity hover:opacity-90">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/40 flex items-center justify-center text-accent shadow-glow-accent group-hover:scale-105 transition-transform">
              <Compass className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-textMain">WayDine</span>
                <span className="text-[9px] uppercase font-mono font-bold px-1.5 py-0.2 rounded bg-accent/20 text-accent border border-accent/30">
                  Nav v2
                </span>
              </div>
              <p className="text-[10px] text-muted font-medium">Smart Pitstop Intelligence</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav aria-label="Desktop navigation" className="space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold px-3 mb-2">
              Navigation
            </div>
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-accent text-background shadow-glow-accent'
                        : 'text-muted hover:text-textMain hover:bg-card/70'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold bg-background text-accent">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom section */}
        <div className="space-y-3">

          {/* ── Dijkstra Graph Visualizer trigger ── */}
          <div className="rounded-xl border border-borderSubtle overflow-hidden">
            <div className="px-3 py-2 bg-card/40 border-b border-borderSubtle flex items-center gap-2">
              <GitBranch className="w-3 h-3 text-purple-400 shrink-0" />
              <span className="text-[10px] font-mono font-bold text-muted uppercase tracking-wider">Graph & Dijkstra</span>
            </div>

            {/* Mini status row */}
            <div className="px-3 py-2 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-muted">Nodes</span>
                <span className="text-textMain font-bold">{graphSnapshot?.nodes?.length ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-muted">Edges</span>
                <span className="text-textMain font-bold">{graphSnapshot?.edges?.length ?? '—'}</span>
              </div>
              {vehicleHeading && (
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-muted">Heading</span>
                  <span className="text-cyan-400 font-bold">{vehicleHeading.degrees}° {vehicleHeading.compass}</span>
                </div>
              )}
              {accessClass && (
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-muted">Top pick</span>
                  <span className={`font-bold ${accessColor}`}>{accessClass}</span>
                </div>
              )}
            </div>

            {/* Click-to-open button */}
            <button
              id="graph-visualizer-trigger"
              onClick={() => setGraphOpen(true)}
              disabled={!hasGraph}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-bold font-mono transition-all border-t border-borderSubtle group ${
                hasGraph
                  ? 'text-purple-300 hover:bg-purple-500/10 hover:text-purple-200 cursor-pointer'
                  : 'text-muted/40 cursor-not-allowed'
              }`}
              title={hasGraph ? 'Open live Dijkstra graph visualizer' : 'Run a journey first to build the graph'}
            >
              <div className="flex items-center gap-2">
                <Network className="w-3.5 h-3.5 shrink-0" />
                <span>{hasGraph ? 'Visualize Dijkstra' : 'Run journey first'}</span>
              </div>
              {hasGraph && (
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              )}
            </button>
          </div>

          {/* Engine status footer */}
          <div className="p-3 rounded-xl bg-card border border-borderSubtle text-[11px] space-y-1">
            <div className="flex items-center justify-between text-muted font-mono text-[10px]">
              <span>System Engine</span>
              <span className="text-success font-bold">100% Deterministic</span>
            </div>
            <p className="text-[10px] text-muted leading-tight">
              Graph traversal & turn-penalized highway optimization.
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav aria-label="Mobile navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-secondary/95 backdrop-blur-md border-t border-borderSubtle flex items-center justify-around p-2">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-medium transition-all ${
                  isActive ? 'text-accent' : 'text-muted hover:text-textMain'
                }`
              }
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.badge && (
                  <span className="absolute -top-1 -right-2 px-1 rounded-full text-[9px] font-mono font-bold bg-accent text-background">
                    {item.badge}
                  </span>
                )}
              </div>
              <span>{item.label.split(' ')[0]}</span>
            </NavLink>
          );
        })}
        {/* Mobile graph button */}
        {hasGraph && (
          <button
            onClick={() => setGraphOpen(true)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-medium text-purple-400"
          >
            <Network className="w-5 h-5" />
            <span>Graph</span>
          </button>
        )}
      </nav>

      {/* Full-screen Dijkstra visualizer overlay */}
      {graphOpen && <GraphMiniVisualizer onClose={() => setGraphOpen(false)} />}
    </>
  );
}
