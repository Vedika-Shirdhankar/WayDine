import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Compass,
  MapPin,
  Utensils,
  BarChart2,
  Sliders,
  Car,
  Settings,
  SplitSquareVertical,
  Network
} from 'lucide-react';
import { useJourneyEngine } from '../context/JourneyContext.jsx';

export function Sidebar() {
  const { compareList } = useJourneyEngine();

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: Compass },
    { to: '/pitstops', label: 'Explore Pitstops', icon: Utensils },
    { to: '/simulator', label: 'Simulator', icon: Car },
    { to: '/analytics', label: 'Compare & Analytics', icon: BarChart2, badge: compareList.length > 0 ? compareList.length : null },
    { to: '/preferences', label: 'Preferences', icon: Sliders },
    { to: '/settings', label: 'Settings', icon: Settings },
    { to: '/dijkstra', label: 'Dijkstra Lab', icon: Network }
  ];

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

        {/* Footer info */}
        <div className="p-3 rounded-xl bg-card border border-borderSubtle text-[11px] space-y-1">
          <div className="flex items-center justify-between text-muted font-mono text-[10px]">
            <span>System Engine</span>
            <span className="text-success font-bold">100% Deterministic</span>
          </div>
          <p className="text-[10px] text-muted leading-tight">
            Graph traversal & turn-penalized highway optimization.
          </p>
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
      </nav>
    </>
  );
}
