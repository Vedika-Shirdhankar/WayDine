import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Star, Clock, CornerDownRight, ShieldCheck,
  AlertTriangle, HelpCircle, CheckCircle2, XCircle,
  Calculator, Navigation, Database, Info, ExternalLink,
  BookmarkPlus, BookmarkCheck, CheckSquare
} from 'lucide-react';
import { useJourneyEngine } from '../context/JourneyContext.jsx';
import { getRepository } from '../data/restaurantRepository.js';
import {
  toRupeeTier, PRICE_TIER_DESC, formatDistance,
  accessClassConfig, detourClassConfig, MEAL_WINDOW_COLORS,
  formatTimeIST
} from '../utils/indiaDefaults.js';

/* ──────────────────────────────────────────
   HELPER COMPONENTS
   ────────────────────────────────────────── */

/** Placeholder image using cuisine initial */
function RestaurantPlaceholder({ name, cuisineType }) {
  const letter = (name || 'R')[0].toUpperCase();
  return (
    <div
      className="w-28 h-28 rounded-2xl flex items-center justify-center shrink-0 border border-borderSubtle"
      style={{ background: 'linear-gradient(135deg, #151F30, #223048)' }}
    >
      <span className="text-4xl font-black" style={{ color: '#B8F34A' }}>{letter}</span>
    </div>
  );
}

/** Dietary tag pill */
function DietTag({ label }) {
  const style = {
    Vegetarian: 'bg-success/15 text-success border-success/30',
    Vegan:      'bg-success/25 text-success border-success/40',
    Halal:      'bg-warning/15 text-warning border-warning/30',
    'Gluten-Free': 'bg-accent/15 text-accent border-accent/30',
  };
  const display = {
    Vegetarian:    'Veg 🌿',
    Vegan:         'Vegan 🌱',
    Halal:         'Halal ☾',
    'Gluten-Free': 'GF',
  };
  const cls = style[label] || 'bg-muted/15 text-muted border-muted/30';
  return (
    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {display[label] || label}
    </span>
  );
}

/** Accessibility class badge with full text */
function AccessBadgeFull({ cls, accessPoint }) {
  const cfg = accessClassConfig(cls);
  const reasons = {
    GREEN:
      `Direct access from current carriageway (India drives on LEFT). Ramp node: ${accessPoint?.roadNodeId || 'N/A'}. No U-turn required. Rejoin at: ${accessPoint?.rejoinNodeId || 'N/A'}.`,
    YELLOW:
      `Requires junction diversion or a short legal U-turn at node ${accessPoint?.roadNodeId || 'N/A'}. Rejoin at: ${accessPoint?.rejoinNodeId || 'N/A'}.`,
    RED:
      `Prohibited: median barrier crossing or backward travel. Source node ${accessPoint?.roadNodeId || 'N/A'} is on the opposite carriageway (Mumbai-bound). Cannot be accessed from the Pune-bound lane.`,
    UNVERIFIED:
      `No road graph data available for node ${accessPoint?.roadNodeId || 'N/A'}. Accessibility cannot be verified — do not assume it is accessible.`,
  };
  return (
    <div className={`p-3 rounded-xl border space-y-1.5 ${cfg.bgClass}`}>
      <div className="flex items-center gap-2 font-semibold text-sm">
        {cls === 'GREEN'      && <ShieldCheck className="w-4 h-4 shrink-0" />}
        {cls === 'YELLOW'     && <AlertTriangle className="w-4 h-4 shrink-0" />}
        {cls === 'RED'        && <AlertTriangle className="w-4 h-4 shrink-0" />}
        {cls === 'UNVERIFIED' && <HelpCircle className="w-4 h-4 shrink-0" />}
        <span>{cfg.label} — {cfg.description}</span>
      </div>
      <p className="text-[11px] leading-relaxed opacity-90">{reasons[cls] || cfg.description}</p>
    </div>
  );
}

/**
 * Food windows timeline — horizontal visual bar from 06:00 to 24:00.
 * Renders coloured segments for each meal window, an opening-hours overlay,
 * and an ETA marker at the projected arrival hour.
 */
function FoodWindowTimeline({ eta, openingHours, availableCategories }) {
  // Timeline spans 06:00 to 26:00 (24 hours, ending at 02:00 next day for late-night)
  const START_H = 6;
  const TOTAL_H = 20; // 06:00 → 26:00

  const hToPercent = (h, m = 0) => Math.max(0, Math.min(100, ((h + m / 60 - START_H) / TOTAL_H) * 100));

  const windows = [
    { name: 'Breakfast', start: 6,  end: 11, color: MEAL_WINDOW_COLORS.Breakfast },
    { name: 'Lunch',     start: 11, end: 15, color: MEAL_WINDOW_COLORS.Lunch },
    { name: 'Snacks',    start: 15, end: 18, color: MEAL_WINDOW_COLORS.Snacks },
    { name: 'Dinner',    start: 18, end: 23, color: MEAL_WINDOW_COLORS.Dinner },
    { name: 'Late Night',start: 23, end: 26, color: MEAL_WINDOW_COLORS['Late Night'] },
  ];

  // Parse opening hours
  let openPct = 0, closePct = 100;
  if (openingHours?.open && openingHours?.close) {
    const parseH = s => { const [h, m] = s.split(':').map(Number); return h + (m || 0) / 60; };
    let oh = parseH(openingHours.open);
    let ch = parseH(openingHours.close);
    if (ch < oh) ch += 24; // past midnight
    openPct  = hToPercent(oh);
    closePct = hToPercent(ch);
  }

  // ETA marker
  let etaPct = null;
  if (eta instanceof Date) {
    const etaH = eta.getHours() + eta.getMinutes() / 60;
    etaPct = hToPercent(etaH);
  }

  return (
    <div className="space-y-3">
      {/* Timeline bar */}
      <div className="relative h-9 rounded-xl overflow-hidden bg-secondary border border-borderSubtle">
        {/* Meal window segments */}
        {windows.map(w => {
          const left = hToPercent(w.start);
          const width = hToPercent(w.end) - left;
          return (
            <div key={w.name}
              className="absolute top-0 h-full opacity-70"
              style={{ left: `${left}%`, width: `${width}%`, backgroundColor: w.color }}
              title={`${w.name}: ${w.start}:00–${w.end > 24 ? w.end - 24 : w.end}:00`}
            />
          );
        })}
        {/* Opening hours overlay */}
        <div className="absolute top-0 h-full pointer-events-none"
          style={{ left: `${openPct}%`, width: `${closePct - openPct}%`, backgroundColor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)' }} />
        {/* ETA marker */}
        {etaPct !== null && (
          <div className="absolute top-0 h-full w-0.5 z-10" style={{ left: `${etaPct}%`, backgroundColor: '#B8F34A', boxShadow: '0 0 6px #B8F34A' }}>
            <div className="absolute -top-0 left-1 text-[9px] font-mono font-black text-accent whitespace-nowrap">
              ETA
            </div>
          </div>
        )}
      </div>
      {/* Hour labels */}
      <div className="flex justify-between text-[9px] text-muted font-mono">
        {[6, 9, 12, 15, 18, 21, 24, 26].map(h => (
          <span key={h}>{h > 24 ? `0${h-24}:00` : `${h}:00`}</span>
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {windows.map(w => (
          <span key={w.name} className="flex items-center gap-1 text-[10px] text-muted">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: w.color }} />
            {w.name}
          </span>
        ))}
        <span className="flex items-center gap-1 text-[10px] text-muted">
          <span className="w-2.5 h-2.5 rounded-sm bg-white/20 border border-white/30" />
          Restaurant hours
        </span>
        <span className="flex items-center gap-1 text-[10px] text-accent font-mono font-bold">| ETA arrival</span>
      </div>
      {/* Available at ETA */}
      {availableCategories?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="text-[10px] text-muted self-center">Active at ETA:</span>
          {availableCategories.map(cat => (
            <span key={cat} className="text-[10px] font-mono bg-card border border-borderSubtle text-accent px-2 py-0.5 rounded-lg">
              {cat}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Score bar component */
function ScoreBar({ label, pct, value, weight }) {
  return (
    <div className="bg-secondary p-3 rounded-xl border border-borderSubtle space-y-2">
      <div className="flex justify-between text-[10px] font-mono">
        <span className="text-muted">{label}</span>
        <span className="text-muted">{weight}</span>
      </div>
      <div className="text-xl font-black font-mono text-textMain">{value}</div>
      <div className="h-1.5 bg-card rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   MAIN PAGE
   ────────────────────────────────────────── */

/**
 * /restaurant/:id — Full telemetry view for a single pitstop candidate.
 * All data comes from the engine via useJourneyEngine — nothing invented.
 */
export function RestaurantDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    engineResults,
    toggleCompareRestaurant,
    compareList,
    setSelectedRestaurantId,
    selectedRestaurantId,
  } = useJourneyEngine();

  const [selectMsg, setSelectMsg] = useState('');
  const [selected, setSelected] = useState(false);

  // Find in eligible first, then rejected
  const rec          = engineResults.eligible.find(r => r.restaurant.id === id) || null;
  const rejectedEntry= !rec ? engineResults.rejected.find(r => r.restaurant.id === id) : null;
  const restaurant   = rec?.restaurant || rejectedEntry?.restaurant || null;

  const isComparing  = compareList.some(r => r.id === id);

  /* ─── Not found ─── */
  if (!restaurant) {
    return (
      <div className="p-8 flex flex-col items-center gap-4 text-center max-w-sm mx-auto pt-20">
        <div className="w-16 h-16 rounded-2xl bg-card border border-borderSubtle flex items-center justify-center">
          <Info className="w-8 h-8 text-muted" />
        </div>
        <h2 className="text-base font-bold text-textMain">Restaurant Not Found</h2>
        <p className="text-xs text-muted">
          ID <code className="font-mono bg-secondary px-1 rounded">{id}</code> was not found in the current engine results.
          Load the demo journey from the dashboard first.
        </p>
        <div className="flex gap-2">
          <button onClick={() => navigate('/pitstops')}
            className="px-4 py-2 bg-accent text-background text-xs font-bold rounded-xl shadow-glow-accent">
            Browse Pitstops
          </button>
          <button onClick={() => navigate(-1)}
            className="px-4 py-2 bg-secondary border border-borderSubtle text-muted text-xs font-semibold rounded-xl">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { detourResult, foodSuitability, finalScore, scoreBreakdown, explanation, rank, eta } = rec || {};

  /* ─── Saved Favorites ─── */
  const [savedList, setSavedList] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('waydine_saved_restaurants') || '[]');
    } catch { return []; }
  });
  const isSaved = savedList.includes(restaurant?.id);

  const toggleSaveRestaurant = () => {
    if (!restaurant) return;
    const next = isSaved ? savedList.filter(id => id !== restaurant.id) : [...savedList, restaurant.id];
    setSavedList(next);
    localStorage.setItem('waydine_saved_restaurants', JSON.stringify(next));
  };

  /* ─── Handlers ─── */
  const handleSelect = useCallback(async () => {
    setSelectedRestaurantId(restaurant.id);
    setSelected(true);
    setSelectMsg('✓ Selected as your pitstop!');
    setTimeout(() => setSelectMsg(''), 2500);
    try {
      await getRepository().saveHistory({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        score: finalScore,
        detourMeters: detourResult?.detourDistanceMeters || 0,
        routeId: 'demo',
        timestamp: new Date().toISOString(),
      });
    } catch (e) { /* non-critical */ }
  }, [restaurant, finalScore, detourResult, setSelectedRestaurantId]);

  const rupeeTier = toRupeeTier(restaurant.priceRange);
  const tierDesc  = PRICE_TIER_DESC[rupeeTier] || '';
  const accessCls = detourResult?.accessibilityClass || (rejectedEntry ? 'RED' : 'UNVERIFIED');

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-4xl mx-auto">

      {/* Back */}
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-xs text-muted hover:text-textMain transition-colors">
        <ArrowLeft className="w-4 h-4" />Back
      </button>

      {/* ═══════════════ HEADER CARD ═══════════════ */}
      <div className="bg-card border border-borderSubtle rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-4 flex-wrap">
          {/* Placeholder image */}
          <RestaurantPlaceholder name={restaurant.name} cuisineType={restaurant.cuisineType} />

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Status badges */}
            <div className="flex flex-wrap items-center gap-2">
              {rank && (
                <span className="px-2 py-0.5 bg-accent/20 text-accent text-xs font-mono font-bold rounded border border-accent/40">
                  Rank #{rank}
                </span>
              )}
              {rejectedEntry && (
                <span className="px-2 py-0.5 bg-danger/20 text-danger text-xs font-mono font-bold rounded border border-danger/40">
                  Eliminated
                </span>
              )}
              <span className="px-2 py-0.5 bg-secondary text-muted text-[10px] font-mono rounded border border-borderSubtle">
                {restaurant.dataSource || 'sample-demo'}
              </span>
            </div>

            <h1 className="text-xl font-extrabold text-textMain leading-snug">{restaurant.name}</h1>

            {/* Address */}
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <MapPin className="w-3.5 h-3.5 text-accent shrink-0" />
              <span>{restaurant.address}</span>
            </div>

            {/* Cuisine + tags */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-textMain font-semibold">{restaurant.cuisineType}</span>
              {(restaurant.dietaryOptions || []).map(d => <DietTag key={d} label={d} />)}
            </div>

            {/* Price + rating + hours */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-secondary p-2 rounded-xl border border-borderSubtle text-center">
                <div className="text-[10px] text-muted font-mono">Price</div>
                <div className="font-black text-textMain font-mono">{rupeeTier}</div>
                <div className="text-[9px] text-muted">{tierDesc}</div>
              </div>
              <div className="bg-secondary p-2 rounded-xl border border-borderSubtle text-center">
                <div className="text-[10px] text-muted font-mono">Rating</div>
                <div className="font-black text-warning flex items-center justify-center gap-0.5">
                  <Star className="w-3.5 h-3.5 fill-current" />{restaurant.rating}
                </div>
                <div className="text-[9px] text-muted">{restaurant.reviewCount} reviews</div>
              </div>
              <div className="bg-secondary p-2 rounded-xl border border-borderSubtle text-center">
                <div className="text-[10px] text-muted font-mono">Hours</div>
                <div className="font-bold text-textMain text-[11px]">
                  {restaurant.openingHours?.open}–{restaurant.openingHours?.close}
                </div>
                <div className="text-[9px] text-muted">IST</div>
              </div>
              <div className="bg-secondary p-2 rounded-xl border border-borderSubtle text-center">
                <div className="text-[10px] text-muted font-mono">Avg Dine</div>
                <div className="font-bold text-textMain">{restaurant.averageDineMinutes || '?'} min</div>
                {restaurant.hasDriveThru && <div className="text-[9px] text-accent font-mono">Drive-Thru ✓</div>}
              </div>
            </div>
          </div>

          {/* Score circle (eligible only) */}
          {finalScore !== undefined && (
            <div className="text-center shrink-0 space-y-1">
              <div className="w-20 h-20 rounded-full border-4 border-accent/40 bg-card flex flex-col items-center justify-center shadow-glow-accent">
                <div className="text-2xl font-black font-mono text-accent">{finalScore}</div>
                <div className="text-[9px] text-muted">/100</div>
              </div>
              <div className="text-[10px] text-muted font-mono uppercase">Convenience</div>
              <div className="text-[10px] font-bold text-textMain">Rank #{rank}</div>
            </div>
          )}
        </div>

        {/* Accessibility badge */}
        <AccessBadgeFull cls={accessCls} accessPoint={restaurant.accessPoint} />

        {rejectedEntry && (
          <div className="p-3 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs font-medium flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Eliminated: {rejectedEntry.reasonMessage}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={handleSelect}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              selected || selectedRestaurantId === restaurant.id
                ? 'bg-success text-background'
                : 'bg-accent hover:bg-accentHover text-background shadow-glow-accent'
            } ${!rec ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!rec}>
            <CheckSquare className="w-4 h-4" />
            {selected || selectedRestaurantId === restaurant.id ? 'Selected ✓' : 'Select as Pitstop'}
          </button>
          <button
            onClick={() => toggleCompareRestaurant(restaurant)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
              isComparing
                ? 'bg-accent/20 border-accent/40 text-accent'
                : 'bg-secondary border-borderSubtle text-muted hover:text-textMain hover:border-borderStrong'
            }`}>
            {isComparing ? <BookmarkCheck className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
            {isComparing ? 'In Compare List' : 'Add to Compare'}
          </button>
          <button
            onClick={toggleSaveRestaurant}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
              isSaved
                ? 'bg-warning/20 border-warning/40 text-warning shadow-glow-warning'
                : 'bg-secondary border-borderSubtle text-muted hover:text-textMain hover:border-borderStrong'
            }`}>
            <Star className={`w-4 h-4 ${isSaved ? 'fill-current text-warning' : ''}`} />
            {isSaved ? 'Saved ★' : 'Save Restaurant'}
          </button>
        </div>
        {selectMsg && <p className="text-xs text-success font-semibold">{selectMsg}</p>}
      </div>

      {/* ═══════════════ DETAIL SECTIONS (eligible only) ═══════════════ */}
      {rec && (
        <>
          {/* ─── TASK 1: Corridor & Directional ─── */}
          <div className="bg-card border border-borderSubtle rounded-2xl p-5 space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-muted font-bold flex items-center gap-2">
              <Navigation className="w-4 h-4 text-accent" />Task 1 — Corridor &amp; Directional Discovery
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-secondary p-2.5 rounded-xl border border-borderSubtle">
                <span className="text-muted block text-[10px] font-mono">Road Side</span>
                <span className="font-bold text-textMain capitalize">
                  {restaurant.roadSide === 'left' ? 'Left (with traffic, IN)' : restaurant.roadSide === 'right' ? 'Right (oncoming, IN)' : 'N/A'}
                </span>
              </div>
              <div className="bg-secondary p-2.5 rounded-xl border border-borderSubtle">
                <span className="text-muted block text-[10px] font-mono">Lateral Distance</span>
                <span className="font-bold text-textMain">{formatDistance(restaurant.distanceFromRouteMeters || 0)}</span>
              </div>
              <div className="bg-secondary p-2.5 rounded-xl border border-borderSubtle">
                <span className="text-muted block text-[10px] font-mono">Ramp Node ID</span>
                <span className="font-bold text-accent text-[10px] font-mono">{restaurant.accessPoint?.roadNodeId || 'N/A'}</span>
              </div>
              <div className="bg-secondary p-2.5 rounded-xl border border-borderSubtle">
                <span className="text-muted block text-[10px] font-mono">Rejoin Node ID</span>
                <span className="font-bold text-accent text-[10px] font-mono">{restaurant.accessPoint?.rejoinNodeId || 'N/A'}</span>
              </div>
            </div>
            <p className="text-[11px] text-muted leading-relaxed bg-secondary/40 p-2 rounded-lg border border-borderSubtle/60">
              <strong className="text-textMain">India drives on the LEFT.</strong> Accessibility is determined by the road graph, not geometric proximity.
              UNVERIFIED = no graph data, never assumed accessible. Access class from graph: <strong className={accessClassConfig(accessCls).colorClass}>{accessCls}</strong>.
            </p>
          </div>

          {/* ─── TASK 2: Detour ─── */}
          <div className="bg-card border border-borderSubtle rounded-2xl p-5 space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-muted font-bold flex items-center gap-2">
              <CornerDownRight className="w-4 h-4 text-accent" />Task 2 — Road-Network Detour &amp; Turn Minimization
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-secondary p-2.5 rounded-xl border border-borderSubtle text-center">
                <span className="text-muted block text-[10px] font-mono">Road Distance</span>
                <span className="font-black text-textMain font-mono">
                  {formatDistance(detourResult.detourDistanceMeters)}
                </span>
                <span className="text-[9px] text-muted block">road network</span>
              </div>
              <div className="bg-secondary p-2.5 rounded-xl border border-borderSubtle text-center">
                <span className="text-muted block text-[10px] font-mono">Extra Time</span>
                <span className="font-black text-accent font-mono">
                  +{Math.round(detourResult.detourDurationSeconds / 60)} min
                </span>
              </div>
              <div className="bg-secondary p-2.5 rounded-xl border border-borderSubtle text-center">
                <span className="text-muted block text-[10px] font-mono">Turns</span>
                <span className="font-black text-textMain font-mono">{detourResult.turnCount}</span>
              </div>
              <div className={`p-2.5 rounded-xl border text-center ${detourResult.uTurnCount > 0 ? 'bg-danger/15 border-danger/40' : 'bg-secondary border-borderSubtle'}`}>
                <span className="text-muted block text-[10px] font-mono">U-Turns</span>
                <span className={`font-black font-mono ${detourResult.uTurnCount > 0 ? 'text-danger' : 'text-textMain'}`}>
                  {detourResult.uTurnCount}
                </span>
              </div>
            </div>

            {/* Classification badge */}
            {(() => {
              const cfg = detourClassConfig(detourResult.detourClassification);
              return (
                <div className={`flex items-center gap-2 p-2.5 rounded-xl border ${cfg.bgClass}`}>
                  <span className={`text-xs font-mono font-bold ${cfg.colorClass}`}>
                    {detourResult.detourClassification}
                  </span>
                  <span className="text-[11px] text-muted">
                    Road-network extra: {formatDistance(detourResult.detourDistanceMeters)} (longer than straight-line due to ramps and turns)
                    {detourResult.uTurnCount > 0 && (
                      <span className="text-danger ml-2 font-mono">
                        ⚠ U-turn penalty: +{Math.round((detourResult.uTurnPenaltySeconds || 0) / 60)} min
                      </span>
                    )}
                  </span>
                </div>
              );
            })()}
          </div>

          {/* ─── TASK 3: ETA & Food Window ─── */}
          <div className="bg-card border border-borderSubtle rounded-2xl p-5 space-y-4">
            <h2 className="text-xs font-mono uppercase tracking-wider text-muted font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent" />Task 3 — ETA-Based Food Window Matching
            </h2>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="bg-secondary p-2.5 rounded-xl border border-borderSubtle text-center">
                <span className="text-muted block text-[10px] font-mono">Arrival ETA (IST)</span>
                <span className="font-black text-textMain font-mono">{foodSuitability?.projectedEta || '--:--'}</span>
              </div>
              <div className={`p-2.5 rounded-xl border text-center ${foodSuitability?.isOpenAtEta ? 'bg-success/15 border-success/40' : 'bg-danger/15 border-danger/40'}`}>
                <span className="text-muted block text-[10px] font-mono">Status at ETA</span>
                <span className={`font-black font-mono ${foodSuitability?.isOpenAtEta ? 'text-success' : 'text-danger'}`}>
                  {foodSuitability?.isOpenAtEta ? 'Open ✓' : 'Closed ✗'}
                </span>
              </div>
              <div className="bg-secondary p-2.5 rounded-xl border border-borderSubtle text-center">
                <span className="text-muted block text-[10px] font-mono">Meal Window</span>
                <span className="font-black text-textMain">{foodSuitability?.mealWindow || 'N/A'}</span>
              </div>
            </div>

            {/* Timeline */}
            <FoodWindowTimeline
              eta={eta instanceof Date ? eta : (eta ? new Date(eta) : null)}
              openingHours={restaurant.openingHours}
              availableCategories={foodSuitability?.availableCategoriesAtEta}
            />

            {foodSuitability?.statusMessage && (
              <p className="text-[11px] text-muted leading-relaxed">{foodSuitability.statusMessage}</p>
            )}
          </div>

          {/* ─── Score Breakdown ─── */}
          {scoreBreakdown && (
            <div className="bg-card border border-borderSubtle rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-mono uppercase tracking-wider text-muted font-bold flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-accent" />Multi-Criteria Scoring Breakdown
                </h2>
                <div className="text-xl font-black font-mono text-accent">{finalScore}/100</div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <ScoreBar label="Detour Eff."   weight="35%" value={scoreBreakdown.detourScore}     pct={scoreBreakdown.detourScore} />
                <ScoreBar label="Road Access"   weight="25%" value={scoreBreakdown.accessScore}     pct={scoreBreakdown.accessScore} />
                <ScoreBar label="Rating"        weight="15%" value={scoreBreakdown.ratingScore}     pct={scoreBreakdown.ratingScore} />
                <ScoreBar label="Food ETA"      weight="15%" value={scoreBreakdown.foodEtaScore}    pct={scoreBreakdown.foodEtaScore} />
                <ScoreBar label="Preferences"   weight="10%" value={scoreBreakdown.preferenceScore} pct={scoreBreakdown.preferenceScore} />
              </div>
              {explanation && (
                <p className="text-[11px] text-textMain/90 leading-relaxed border-t border-borderSubtle pt-3">
                  {explanation}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── Data Source Freshness ─── */}
      <div className="bg-secondary border border-borderSubtle rounded-2xl p-4 space-y-2 text-xs">
        <div className="flex items-center gap-2 font-semibold text-muted">
          <Database className="w-4 h-4 text-accent" />
          Data Source &amp; Freshness
        </div>
        <div className="space-y-1 text-[11px] text-muted leading-relaxed">
          <p><strong className="text-textMain">Source:</strong> {restaurant.dataSource || 'sample-demo'} — <span className="text-warning">Sample/Demo data, not live.</span></p>
          <p>Coordinates are approximate. Road graph is a hand-verified sample covering the Mumbai–Pune Expressway (NH-48) corridor.</p>
          <p>For live data, configure <code className="font-mono bg-card px-1 rounded">VITE_SUPABASE_URL</code> and <code className="font-mono bg-card px-1 rounded">VITE_SUPABASE_ANON_KEY</code> in <code className="font-mono bg-card px-1 rounded">.env</code>.</p>
        </div>
      </div>

    </div>
  );
}
