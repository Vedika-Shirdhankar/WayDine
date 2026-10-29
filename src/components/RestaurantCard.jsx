import React from 'react';
import { Star, Clock, AlertTriangle, ShieldCheck, HelpCircle, CornerDownRight, Utensils, CheckCircle2 } from 'lucide-react';

export function RestaurantCard({
  recommendation,
  isSelected,
  onSelect,
  onMouseEnter,
  onMouseLeave
}) {
  const { restaurant, detourMetrics, foodSuitability, finalScore, rank } = recommendation;

  const detourMinutes = (detourMetrics.detourDurationSeconds / 60).toFixed(1);
  const detourKm = (detourMetrics.detourDistanceMeters / 1000).toFixed(1);

  // Access class badge styling
  let accessBadge = {
    bg: 'bg-muted/15 border-muted/30 text-muted',
    icon: <HelpCircle className="w-3.5 h-3.5" />,
    label: 'Unverified'
  };

  if (restaurant.accessClass === 'GREEN') {
    accessBadge = {
      bg: 'bg-success/15 border-success/30 text-success',
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      label: 'GREEN Ramp Access'
    };
  } else if (restaurant.accessClass === 'YELLOW') {
    accessBadge = {
      bg: 'bg-warning/15 border-warning/30 text-warning',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      label: 'YELLOW Overpass'
    };
  } else if (restaurant.accessClass === 'RED') {
    accessBadge = {
      bg: 'bg-danger/15 border-danger/30 text-danger',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      label: 'RED Median U-turn'
    };
  }

  return (
    <div
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'bg-cardHover border-accent shadow-glow-accent'
          : 'bg-card border-borderSubtle hover:border-borderStrong hover:bg-cardHover'
      }`}
    >
      {/* Top row: Rank, Name, Score */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
              rank === 1
                ? 'bg-accent text-background shadow-glow-accent'
                : 'bg-secondary text-textMain border border-borderSubtle'
            }`}
          >
            #{rank}
          </span>
          <div>
            <h4 className="font-bold text-sm text-textMain leading-tight">{restaurant.name}</h4>
            <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
              <span>{restaurant.cuisineType}</span>
              <span>•</span>
              <span className="flex items-center gap-0.5 text-warning">
                <Star className="w-3 h-3 fill-current" />
                <span className="font-semibold">{restaurant.rating}</span>
              </span>
              <span>•</span>
              <span className="font-mono">{restaurant.priceRange}</span>
              {restaurant.hasDriveThru && (
                <>
                  <span>•</span>
                  <span className="text-[10px] bg-secondary px-1.5 py-0.2 rounded text-accent font-medium">Drive-Thru</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Multi-Factor Pitstop Score */}
        <div className="flex flex-col items-end">
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-black font-mono text-accent">{finalScore}</span>
            <span className="text-[10px] text-muted">/100</span>
          </div>
          <span className="text-[9px] uppercase tracking-wider text-muted font-bold">Convenience</span>
        </div>
      </div>

      {/* Middle row: Badges */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* Accessibility badge */}
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-medium ${accessBadge.bg}`}>
          {accessBadge.icon}
          <span>{accessBadge.label}</span>
        </div>

        {/* Detour stats */}
        <div className="flex items-center gap-1 text-[11px] font-mono bg-secondary px-2 py-0.5 rounded-lg border border-borderSubtle text-textMain">
          <CornerDownRight className="w-3 h-3 text-accent" />
          <span>+{detourMinutes} min</span>
          <span className="text-muted">({detourKm} km)</span>
        </div>

        {/* U-turn penalty warning */}
        {detourMetrics.uTurnCount > 0 && (
          <div className="flex items-center gap-1 text-[10px] font-mono bg-danger/15 border border-danger/30 text-danger px-1.5 py-0.5 rounded-md font-bold">
            <AlertTriangle className="w-2.5 h-2.5" />
            <span>{detourMetrics.uTurnCount} U-turn (+4 min pen)</span>
          </div>
        )}
      </div>

      {/* Bottom row: Food ETA & Availability */}
      <div className="mt-2.5 pt-2 border-t border-borderSubtle/60 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-muted" />
          <span className="text-muted">ETA:</span>
          <span className="font-mono font-bold text-textMain">{foodSuitability.projectedEta}</span>
          <span className={`text-[11px] px-1.5 py-0.2 rounded font-medium ${
            foodSuitability.isOpenAtEta ? 'text-success bg-success/10' : 'text-danger bg-danger/10'
          }`}>
            {foodSuitability.isOpenAtEta ? foodSuitability.mealWindow : 'Closed'}
          </span>
        </div>

        <span className="text-[10px] text-muted font-mono">{restaurant.source}</span>
      </div>
    </div>
  );
}
