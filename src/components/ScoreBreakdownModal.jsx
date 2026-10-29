import React from 'react';
import { X, CheckCircle, ShieldCheck, AlertTriangle, HelpCircle, Calculator, Compass, Clock, MapPin, CornerDownRight } from 'lucide-react';

export function ScoreBreakdownModal({ recommendation, onClose }) {
  if (!recommendation) return null;

  const { restaurant, detourMetrics, foodSuitability, finalScore, scoreBreakdown, rank, rationale } = recommendation;
  const detourMinutes = (detourMetrics.detourDurationSeconds / 60).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-borderStrong rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-borderSubtle pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-accent/20 text-accent border border-accent/40">
                Rank #{rank} Pitstop
              </span>
              <span className="text-xs font-mono text-muted bg-secondary px-2 py-0.5 rounded">
                Source: {restaurant.source}
              </span>
            </div>
            <h3 className="text-xl font-black text-textMain mt-1">{restaurant.name}</h3>
            <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-accent" />
              <span>{restaurant.address}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-secondary text-muted hover:text-textMain border border-borderSubtle hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Executive Rationale */}
        <div className="p-3.5 rounded-xl bg-secondary border border-borderSubtle text-xs text-textMain leading-relaxed">
          <span className="font-bold text-accent">Ranking Verdict: </span>
          {rationale}
        </div>

        {/* Deterministic Scoring Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs uppercase font-mono font-bold text-muted flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-accent" />
              <span>Multi-Criteria Deterministic Scoring Breakdown</span>
            </h4>
            <div className="text-sm font-mono font-black text-accent">
              Final Score: {finalScore} / 100
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
            <div className="bg-secondary p-2.5 rounded-xl border border-borderSubtle">
              <div className="text-[10px] text-muted font-mono">Detour (35%)</div>
              <div className="text-base font-black font-mono text-textMain mt-0.5">{scoreBreakdown.detourScore}</div>
              <div className="text-[10px] text-accent font-mono font-semibold">+{detourMinutes}m extra</div>
            </div>
            <div className="bg-secondary p-2.5 rounded-xl border border-borderSubtle">
              <div className="text-[10px] text-muted font-mono">Access (25%)</div>
              <div className="text-base font-black font-mono text-textMain mt-0.5">{scoreBreakdown.accessScore}</div>
              <div className="text-[10px] text-success font-mono font-semibold">{restaurant.accessClass}</div>
            </div>
            <div className="bg-secondary p-2.5 rounded-xl border border-borderSubtle">
              <div className="text-[10px] text-muted font-mono">Rating (15%)</div>
              <div className="text-base font-black font-mono text-textMain mt-0.5">{scoreBreakdown.ratingScore}</div>
              <div className="text-[10px] text-warning font-mono font-semibold">{restaurant.rating} ★</div>
            </div>
            <div className="bg-secondary p-2.5 rounded-xl border border-borderSubtle">
              <div className="text-[10px] text-muted font-mono">Food ETA (15%)</div>
              <div className="text-base font-black font-mono text-textMain mt-0.5">{scoreBreakdown.foodEtaScore}</div>
              <div className="text-[10px] text-accent font-mono font-semibold">{foodSuitability.isOpenAtEta ? 'Open' : 'Closed'}</div>
            </div>
            <div className="bg-secondary p-2.5 rounded-xl border border-borderSubtle col-span-2 sm:col-span-1">
              <div className="text-[10px] text-muted font-mono">Pref (10%)</div>
              <div className="text-base font-black font-mono text-textMain mt-0.5">{scoreBreakdown.preferenceScore}</div>
              <div className="text-[10px] text-muted font-mono font-semibold">{restaurant.hasDriveThru ? 'DriveThru' : 'Dine-In'}</div>
            </div>
          </div>
        </div>

        {/* 3 Hackathon Tasks Technical Proofs */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs uppercase font-mono font-bold text-muted">
            Algorithm Verification (Three Hackathon Tasks)
          </h4>

          {/* Task 1 Proof */}
          <div className="p-3 rounded-xl bg-secondary/80 border border-borderSubtle text-xs space-y-1">
            <div className="flex items-center justify-between font-bold text-textMain">
              <span>Task 1: Corridor & Directional Filter</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                restaurant.accessClass === 'GREEN' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
              }`}>
                {restaurant.accessClass} Verified
              </span>
            </div>
            <p className="text-muted text-[11px] leading-relaxed">
              {restaurant.accessReason || 'Corridor verified.'}
            </p>
            <div className="flex gap-4 text-[10px] font-mono text-muted pt-1">
              <span>Side of travel: <strong className="text-textMain">{restaurant.roadSide}</strong></span>
              <span>Corridor lateral dist: <strong className="text-textMain">{restaurant.distanceFromRouteMeters}m</strong></span>
            </div>
          </div>

          {/* Task 2 Proof */}
          <div className="p-3 rounded-xl bg-secondary/80 border border-borderSubtle text-xs space-y-1">
            <div className="flex items-center justify-between font-bold text-textMain">
              <span>Task 2: Road Network Detour & Turn Minimization</span>
              <span className="font-mono text-accent">+{detourMinutes} min extra</span>
            </div>
            <p className="text-muted text-[11px]">
              Round-trip detour distance: <strong>{(detourMetrics.detourDistanceMeters / 1000).toFixed(2)} km</strong> • Maneuvers: <strong>{detourMetrics.turnCount} turns</strong>, <strong>{detourMetrics.uTurnCount} U-turns</strong>.
            </p>
            {detourMetrics.uTurnCount > 0 && (
              <p className="text-danger text-[11px] font-mono">
                ⚠️ Severe penalty applied: {detourMetrics.uTurnCount} U-turn across median barrier adds {detourMetrics.uTurnPenaltySeconds}s penalty.
              </p>
            )}
          </div>

          {/* Task 3 Proof */}
          <div className="p-3 rounded-xl bg-secondary/80 border border-borderSubtle text-xs space-y-1">
            <div className="flex items-center justify-between font-bold text-textMain">
              <span>Task 3: ETA-Based Food Window Recommendation</span>
              <span className="font-mono text-success">ETA {foodSuitability.projectedEta}</span>
            </div>
            <p className="text-muted text-[11px]">
              {foodSuitability.statusMessage}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] text-muted">Active menu categories at arrival:</span>
              {foodSuitability.availableCategoriesAtEta.map(cat => (
                <span key={cat} className="text-[10px] font-mono bg-card px-1.5 py-0.5 rounded text-accent border border-borderSubtle">
                  {cat}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-borderSubtle">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-accent hover:bg-accentHover text-background font-bold text-xs rounded-xl shadow-glow-accent transition-all"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
