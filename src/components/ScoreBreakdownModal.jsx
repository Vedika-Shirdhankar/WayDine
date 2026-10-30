import React from 'react';
import { X, CheckCircle, ShieldCheck, AlertTriangle, Calculator, Compass, Clock, MapPin, Navigation, Utensils, Star, Heart } from 'lucide-react';

function ScoreBar({ value, color = 'accent' }) {
  return (
    <div className="w-full bg-secondary/60 rounded-full h-1.5 mt-1">
      <div
        className={`h-1.5 rounded-full bg-${color} transition-all duration-700`}
        style={{ width: `${Math.max(4, value)}%` }}
      />
    </div>
  );
}

export function ScoreBreakdownModal({ recommendation, onClose }) {
  if (!recommendation) return null;

  const { restaurant, detourMetrics, foodSuitability, finalScore, scoreBreakdown, rank, rationale } = recommendation;
  const detourMinutes = ((detourMetrics?.detourDurationSeconds || 0) / 60).toFixed(1);

  const factors = [
    {
      key: 'detourScore',
      label: 'Detour Efficiency',
      weight: '25%',
      icon: Navigation,
      color: 'accent',
      value: scoreBreakdown?.detourScore ?? 0,
      note: `+${detourMinutes}m extra drive`
    },
    {
      key: 'directionScore',
      label: 'Direction Compat.',
      weight: '20%',
      icon: Compass,
      color: 'cyan-400',
      value: scoreBreakdown?.directionScore ?? 0,
      note: `${detourMetrics?.uTurnCount ?? 0} U-turns · ${detourMetrics?.turnCount ?? 0} turns`
    },
    {
      key: 'accessScore',
      label: 'Road Accessibility',
      weight: '20%',
      icon: ShieldCheck,
      color: 'success',
      value: scoreBreakdown?.accessScore ?? 0,
      note: restaurant.accessClass || 'UNVERIFIED'
    },
    {
      key: 'foodEtaScore',
      label: 'Food at ETA',
      weight: '15%',
      icon: Utensils,
      color: 'warning',
      value: scoreBreakdown?.foodEtaScore ?? 0,
      note: foodSuitability?.isOpenAtEta ? `Open · ${foodSuitability?.mealWindow || ''}` : 'Closed at ETA'
    },
    {
      key: 'timeScore',
      label: 'Time Compatibility',
      weight: '10%',
      icon: Clock,
      color: 'purple-400',
      value: scoreBreakdown?.timeScore ?? 0,
      note: `ETA ${foodSuitability?.projectedEta || '—'}`
    },
    {
      key: 'preferenceScore',
      label: 'Preference Match',
      weight: '10%',
      icon: Heart,
      color: 'pink-400',
      value: scoreBreakdown?.preferenceScore ?? 0,
      note: `${restaurant.rating ?? '—'} ★ · ${restaurant.priceRange ?? '—'}`
    }
  ];

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
                Score: {finalScore}/100
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

        {/* Rationale */}
        <div className="p-3.5 rounded-xl bg-secondary border border-borderSubtle text-xs text-textMain leading-relaxed">
          <span className="font-bold text-accent">Ranking Verdict: </span>
          {rationale}
        </div>

        {/* 6-Factor Scoring Grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs uppercase font-mono font-bold text-muted flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-accent" />
              <span>Deterministic 6-Factor Scoring</span>
            </h4>
            <div className="text-sm font-mono font-black text-accent">
              {finalScore} / 100
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {factors.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.key} className="bg-secondary p-2.5 rounded-xl border border-borderSubtle space-y-0.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[10px] text-muted font-mono">
                      <Icon className="w-3 h-3" />
                      <span>{f.label}</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted">{f.weight}</span>
                  </div>
                  <div className="text-xl font-black font-mono text-textMain">{f.value}</div>
                  <ScoreBar value={f.value} />
                  <div className="text-[10px] text-muted font-mono truncate">{f.note}</div>
                </div>
              );
            })}
          </div>

          {/* Scoring formula */}
          <div className="bg-secondary/50 border border-borderSubtle rounded-xl p-2.5 font-mono text-[10px] text-muted leading-relaxed">
            <span className="text-accent font-bold">Score = </span>
            (25%×Detour) + (20%×Direction) + (20%×Access) + (15%×Food) + (10%×Time) + (10%×Pref) = <span className="text-textMain font-bold">{finalScore}</span>
          </div>
        </div>

        {/* 3 Hackathon Tasks Technical Proofs */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs uppercase font-mono font-bold text-muted">
            Algorithm Verification (Three Hackathon Tasks)
          </h4>

          {/* Task A */}
          <div className="p-3 rounded-xl bg-secondary/80 border border-borderSubtle text-xs space-y-1">
            <div className="flex items-center justify-between font-bold text-textMain">
              <span>Task A: Corridor & Direction Filter</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                restaurant.accessClass === 'GREEN' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
              }`}>
                {restaurant.accessClass || 'UNVERIFIED'}
              </span>
            </div>
            <p className="text-muted text-[11px] leading-relaxed">
              {restaurant.accessReason || 'Corridor verified via route polyline projection (pointToSegmentDistance).'}
            </p>
            <div className="flex gap-4 text-[10px] font-mono text-muted pt-1">
              <span>Side: <strong className="text-textMain">{recommendation.sideOfRoad || '—'}</strong></span>
              <span>Lateral dist: <strong className="text-textMain">{recommendation.distanceFromRouteMeters ?? '—'}m</strong></span>
              <span>In 200m corridor: <strong className={recommendation.withinStrictCorridor ? 'text-success' : 'text-warning'}>{recommendation.withinStrictCorridor ? 'Yes' : 'No'}</strong></span>
            </div>
          </div>

          {/* Task B */}
          <div className="p-3 rounded-xl bg-secondary/80 border border-borderSubtle text-xs space-y-1">
            <div className="flex items-center justify-between font-bold text-textMain">
              <span>Task B: Road Network Detour & Turn Minimization</span>
              <span className="font-mono text-accent">+{detourMinutes} min</span>
            </div>
            <p className="text-muted text-[11px]">
              Round-trip detour: <strong>{((detourMetrics?.detourDistanceMeters || 0) / 1000).toFixed(2)} km</strong> •
              Turns: <strong>{detourMetrics?.turnCount ?? 0}</strong> •
              U-turns: <strong>{detourMetrics?.uTurnCount ?? 0}</strong> •
              Bearing compatibility: <strong>{scoreBreakdown?.directionScore ?? 0}/100</strong>
            </p>
            {(detourMetrics?.uTurnCount ?? 0) > 0 && (
              <p className="text-danger text-[11px] font-mono">
                ⚠️ U-turn penalty applied: {detourMetrics.uTurnCount} U-turn adds {detourMetrics.uTurnPenaltySeconds}s delay.
              </p>
            )}
          </div>

          {/* Task C */}
          <div className="p-3 rounded-xl bg-secondary/80 border border-borderSubtle text-xs space-y-1">
            <div className="flex items-center justify-between font-bold text-textMain">
              <span>Task C: ETA-Based Food Window Recommendation</span>
              <span className="font-mono text-success">ETA {foodSuitability?.projectedEta || '—'}</span>
            </div>
            <p className="text-muted text-[11px]">{foodSuitability?.statusMessage}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] text-muted">Active menu at arrival:</span>
              {(foodSuitability?.availableCategoriesAtEta || []).map(cat => (
                <span key={cat} className="text-[10px] font-mono bg-card px-1.5 py-0.5 rounded text-accent border border-borderSubtle">
                  {cat}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
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
