import React from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, Route, Cpu, Network, Radio, Wifi, WifiOff } from 'lucide-react';
import { getDataSourceStatus } from '../data/restaurantRepository.js';

export function Navbar({
  routesList = [],
  selectedRouteId,
  onSelectRoute,
  liveRoutingEnabled,
  onToggleLiveRouting,
  activeRouteSource = 'Sample/Demo'
}) {
  const dbStatus = getDataSourceStatus();

  return (
    <header className="sticky top-0 z-50 bg-secondary/95 backdrop-blur-md border-b border-borderSubtle px-4 lg:px-6 py-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 max-w-7xl mx-auto">
        {/* Brand & Tagline */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shadow-glow-accent">
            <Compass className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight text-textMain">WayDine</span>
              <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/40">
                Pitstop Intelligence
              </span>
            </div>
            <p className="text-xs text-muted font-medium">
              "Your Journey. Your Direction. Your Perfect Pitstop."
            </p>
          </div>
        </div>

        {/* Route Selector & Mode Toggles */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Preset Route Dropdown */}
          <div className="flex items-center gap-1.5 bg-card px-3 py-1.5 rounded-lg border border-borderSubtle text-xs">
            <Route className="w-3.5 h-3.5 text-accent" />
            <select
              value={selectedRouteId}
              onChange={(e) => onSelectRoute(e.target.value)}
              className="bg-transparent text-textMain font-medium focus:outline-none cursor-pointer pr-2"
            >
              {routesList.map((r) => (
                <option key={r.id} value={r.id} className="bg-card text-textMain">
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Live OSRM Routing Toggle */}
          <button
            onClick={onToggleLiveRouting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              liveRoutingEnabled
                ? 'bg-accent/15 border-accent/40 text-accent shadow-glow-accent'
                : 'bg-card border-borderSubtle text-muted hover:text-textMain'
            }`}
            title="Toggle between live OpenStreetMap OSRM routing and offline precomputed corridor"
          >
            {liveRoutingEnabled ? <Wifi className="w-3.5 h-3.5 text-accent" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>OSRM: {liveRoutingEnabled ? 'Live Routing' : 'Offline'}</span>
          </button>

          {/* Provenance Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card/60 border border-borderSubtle text-[11px] font-mono">
            <Radio className="w-3 h-3 text-success animate-ping" />
            <span className="text-muted">Route:</span>
            <span className="text-textMain font-semibold">{activeRouteSource}</span>
            <span className="text-muted mx-0.5">•</span>
            <span className="text-muted">DB:</span>
            <span className="text-textMain font-semibold">{dbStatus.sourceName}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-card/60 p-1 rounded-xl border border-borderSubtle text-xs font-medium">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                isActive
                  ? 'bg-accent text-background font-semibold shadow-sm'
                  : 'text-muted hover:text-textMain hover:bg-white/5'
              }`
            }
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/engine-lab"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                isActive
                  ? 'bg-accent text-background font-semibold shadow-sm'
                  : 'text-muted hover:text-textMain hover:bg-white/5'
              }`
            }
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Engine Lab (Judges)</span>
          </NavLink>

          <NavLink
            to="/road-graph"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                isActive
                  ? 'bg-accent text-background font-semibold shadow-sm'
                  : 'text-muted hover:text-textMain hover:bg-white/5'
              }`
            }
          >
            <Network className="w-3.5 h-3.5" />
            <span>Road Graph</span>
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
