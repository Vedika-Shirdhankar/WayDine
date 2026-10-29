import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Compass,
  Clock,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  CornerDownRight,
  Sparkles,
  Info,
  ChevronRight,
  ShieldAlert,
  BarChart2
} from 'lucide-react';
import { useJourneyEngine } from '../../context/JourneyContext.jsx';
import { SummarySkeleton } from '../SkeletonLoader.jsx';

export function JourneySummary() {
  const {
    route,
    engineResults,
    departureTime,
    selectedRestaurantId,
    setSelectedRestaurantId,
    previewDetourRestaurantId,
    setPreviewDetourRestaurantId,
    toggleCompareRestaurant,
    compareList,
    isLoading,
    isEngineCalculating
  } = useJourneyEngine();

  if (isLoading) {
    return <SummarySkeleton />;
  }

  const distanceKm = route?.totalDistanceMeters
    ? (route.totalDistanceMeters / 1000).toFixed(1)
    : '148.5';

  const durationMin = route?.totalDurationSeconds
    ? Math.round(route.totalDurationSeconds / 60)
    : 140;

  const durationHours = `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`;

  const destEta = new Date(departureTime.getTime() + (durationMin * 60 * 1000));
  const destEtaFormatted = destEta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const totalDiscovered = engineResults.eligible.length + engineResults.rejected.length;
  const suitableCount = engineResults.eligible.length;
  const eliminatedCount = engineResults.rejected.length;

  const top3 = engineResults.eligible.slice(0, 3);
  const relaxation = engineResults.relaxationInfo;

  return (
    <div className="bg-card border border-borderSubtle rounded-2xl p-4 sm:p-5 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-borderSubtle pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-textMain">Journey Summary</h3>
            <p className="text-[10px] text-muted">Corridor telemetry & top recommendations</p>
          </div>
        </div>

        <NavLink
          to="/pitstops"
          className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
        >
          <span>All ({engineResults.eligible.length})</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </NavLink>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-secondary p-2.5 rounded-xl border border-borderSubtle">
          <span className="text-[10px] text-muted font-mono block">Distance</span>
          <span className="text-xs font-black font-mono text-textMain">{distanceKm} km</span>
        </div>
        <div className="bg-secondary p-2.5 rounded-xl border border-borderSubtle">
          <span className="text-[10px] text-muted font-mono block">Duration</span>
          <span className="text-xs font-black font-mono text-accent">{durationHours}</span>
        </div>
        <div className="bg-secondary p-2.5 rounded-xl border border-borderSubtle">
          <span className="text-[10px] text-muted font-mono block">Dest. Arrival</span>
          <span className="text-xs font-black font-mono text-success">{destEtaFormatted}</span>
        </div>
      </div>

      {/* Corridor Breakdown Pill Stats */}
      <div className="p-3 rounded-xl bg-secondary border border-borderSubtle flex items-center justify-between text-xs font-mono">
        <div>
          <span className="text-muted block text-[10px]">Discovered</span>
          <span className="font-bold text-textMain">{totalDiscovered} total</span>
        </div>
        <div className="h-6 w-px bg-borderSubtle"></div>
        <div>
          <span className="text-muted block text-[10px]">Suitable</span>
          <span className="font-bold text-success">{suitableCount} eligible</span>
        </div>
        <div className="h-6 w-px bg-borderSubtle"></div>
        <div>
          <span className="text-muted block text-[10px]">Eliminated</span>
          <span className="font-bold text-danger">{eliminatedCount} rejected</span>
        </div>
      </div>

      {/* Constraint Relaxation Notice (if active) */}
      {relaxation?.wasRelaxed && (
        <div className="p-3 rounded-xl bg-warning/15 border border-warning/30 text-warning text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Constraint Relaxed: {relaxation.relaxedConstraint}</span>
          </div>
          <p className="text-[11px] text-muted leading-relaxed">
            Zero candidates matched strict criteria. The engine automatically relaxed <strong>{relaxation.relaxedConstraint}</strong> to surface convenient highway pitstops.
          </p>
        </div>
      )}

      {/* Top 3 Recommendation Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono uppercase tracking-wider font-bold text-muted flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>Top Pitstop Recommendations</span>
          </h4>
          <span className="text-[10px] font-mono text-accent">Ranked by Convenience</span>
        </div>

        {top3.length === 0 ? (
          <div className="p-6 rounded-xl bg-secondary text-center text-xs text-muted border border-borderSubtle">
            No suitable pitstops found. Try increasing the detour limit.
          </div>
        ) : (
          top3.map((rec) => {
            const isSelected = selectedRestaurantId === rec.restaurant.id;
            const isComparing = compareList.some(r => r.id === rec.restaurant.id);
            const isPreviewing = previewDetourRestaurantId === rec.restaurant.id;

            return (
              <div
                key={rec.restaurant.id}
                className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                  isSelected
                    ? 'bg-cardHover border-accent shadow-glow-accent'
                    : 'bg-secondary/70 border-borderSubtle hover:border-borderStrong'
                }`}
              >
                {/* Title & Score */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-black text-xs ${
                      rec.rank === 1 ? 'bg-accent text-background' : 'bg-card text-textMain border border-borderSubtle'
                    }`}>
                      #{rec.rank}
                    </span>
                    <div>
                      <h5 className="font-bold text-xs text-textMain leading-snug">{rec.restaurant.name}</h5>
                      <span className="text-[10px] text-muted font-medium">{rec.restaurant.cuisineType} • {rec.restaurant.priceRange}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-mono font-black text-accent">{rec.finalScore}</span>
                    <span className="text-[9px] text-muted block">/100</span>
                  </div>
                </div>

                {/* Explanation sentence */}
                <p className="text-[11px] text-textMain/90 leading-relaxed font-sans bg-card/60 p-2 rounded-lg border border-borderSubtle">
                  {rec.explanation}
                </p>

                {/* Detour stats badge row */}
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className={`px-1.5 py-0.5 rounded font-bold ${
                    rec.detourResult.accessibilityClass === 'GREEN' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
                  }`}>
                    {rec.detourResult.accessibilityClass}
                  </span>
                  <span className="text-muted">
                    +{rec.detourResult.detourDistanceMeters}m (+{Math.round(rec.detourResult.detourDurationSeconds / 60)}m)
                  </span>
                  {rec.detourResult.uTurnCount > 0 && (
                    <span className="text-danger font-bold">1 U-Turn</span>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-borderSubtle/60 text-[10px]">
                  <button
                    onClick={() => {
                      setSelectedRestaurantId(rec.restaurant.id);
                      setPreviewDetourRestaurantId(rec.restaurant.id);
                    }}
                    className={`py-1 rounded font-semibold transition-all text-center ${
                      isSelected
                        ? 'bg-accent text-background font-bold shadow-sm'
                        : 'bg-card hover:bg-white/10 text-textMain border border-borderSubtle'
                    }`}
                  >
                    Select
                  </button>

                  <button
                    onClick={() => setPreviewDetourRestaurantId(isPreviewing ? null : rec.restaurant.id)}
                    className={`py-1 rounded font-semibold transition-all text-center ${
                      isPreviewing
                        ? 'bg-warning text-background font-bold'
                        : 'bg-card hover:bg-white/10 text-muted hover:text-textMain border border-borderSubtle'
                    }`}
                  >
                    Preview
                  </button>

                  <button
                    onClick={() => toggleCompareRestaurant(rec.restaurant)}
                    className={`py-1 rounded font-semibold transition-all text-center ${
                      isComparing
                        ? 'bg-accent/20 border border-accent/40 text-accent font-bold'
                        : 'bg-card hover:bg-white/10 text-muted hover:text-textMain border border-borderSubtle'
                    }`}
                  >
                    {isComparing ? 'Comparing' : 'Compare'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
