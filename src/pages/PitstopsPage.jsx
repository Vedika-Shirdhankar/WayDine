import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Utensils, SlidersHorizontal, Star, Clock, CornerDownRight,
  ShieldCheck, AlertTriangle, HelpCircle, BarChart2, Eye,
  CheckSquare, ArrowUpDown, Filter, Bookmark
} from 'lucide-react';
import { useJourneyEngine } from '../context/JourneyContext.jsx';
import { toRupeeTier } from '../utils/indiaDefaults.js';
import { getRepository } from '../data/restaurantRepository.js';
import { showToast } from '../components/Toast.jsx';

/** Sort options for pitstop list */
const SORT_OPTIONS = [
  { value: 'score',   label: 'Best Overall' },
  { value: 'detour',  label: 'Min Detour' },
  { value: 'eta',     label: 'Fastest Stop' },
  { value: 'rating',  label: 'Highest Rating' },
  { value: 'food',    label: 'Best Food Match' }
];

/** Filter pills */
const FILTER_PILLS = [
  { value: 'all',        label: 'All' },
  { value: 'green',      label: 'GREEN Only' },
  { value: 'drivethru',  label: 'Drive-Thru' },
  { value: 'open',       label: 'Open Now' },
  { value: 'saved',      label: 'Saved ★' }
];

/**
 * Accessibility class badge config.
 * @param {string} cls
 */
function accessBadge(cls) {
  if (cls === 'GREEN')      return { bg: 'bg-success/20 text-success', label: 'GREEN' };
  if (cls === 'YELLOW')     return { bg: 'bg-warning/20 text-warning', label: 'YELLOW' };
  if (cls === 'RED')        return { bg: 'bg-danger/20 text-danger',   label: 'RED' };
  return { bg: 'bg-muted/20 text-muted', label: 'UNVERIFIED' };
}

/**
 * Single pitstop card in the grid.
 */
function PitstopCard({ rec, onSelect, onCompare, onPreview, isSelected, isComparing, isPreviewing }) {
  const navigate = useNavigate();
  const { restaurant, detourResult, foodSuitability, finalScore, rank, explanation } = rec;
  const badge = accessBadge(detourResult?.accessibilityClass);

  const detourMin = detourResult ? Math.round(detourResult.detourDurationSeconds / 60) : 0;
  const detourKm  = detourResult ? (detourResult.detourDistanceMeters / 1000).toFixed(1) : '?';

  return (
    <div
      className={`bg-card border rounded-2xl p-4 space-y-3 transition-all duration-200 ${
        isSelected ? 'border-accent shadow-glow-accent' : 'border-borderSubtle hover:border-borderStrong'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black font-mono ${
            rank === 1 ? 'bg-accent text-background' : 'bg-secondary text-textMain border border-borderSubtle'
          }`}>
            #{rank}
          </span>
          <div>
            <h3 className="text-sm font-bold text-textMain leading-snug">{restaurant.name}</h3>
            <p className="text-[11px] text-muted">{restaurant.cuisineType} • {toRupeeTier(restaurant.priceRange)}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-black font-mono text-accent">{finalScore}</div>
          <div className="text-[9px] text-muted uppercase tracking-wider">/100</div>
        </div>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
        <span className={`px-2 py-0.5 rounded-lg font-bold ${badge.bg}`}>{badge.label}</span>
        <span className="px-2 py-0.5 rounded-lg bg-secondary border border-borderSubtle text-textMain">
          +{detourMin} min (+{detourKm} km)
        </span>
        {detourResult?.uTurnCount > 0 && (
          <span className="px-2 py-0.5 rounded-lg bg-danger/20 text-danger font-bold">U-Turn</span>
        )}
        {restaurant.hasDriveThru && (
          <span className="px-2 py-0.5 rounded-lg bg-accent/15 text-accent border border-accent/30">Drive-Thru</span>
        )}
      </div>

      {/* ETA + open status */}
      <div className="flex items-center gap-2 text-xs">
        <Clock className="w-3.5 h-3.5 text-muted" />
        <span className="text-muted">ETA:</span>
        <span className="font-mono font-bold text-textMain">{foodSuitability?.projectedEta || '--:--'}</span>
        <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
          foodSuitability?.isOpenAtEta ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
        }`}>
          {foodSuitability?.isOpenAtEta ? (foodSuitability?.mealWindow || 'Open') : 'Closed'}
        </span>
        <span className="flex items-center gap-0.5 ml-auto text-warning font-medium">
          <Star className="w-3 h-3 fill-current" />{restaurant.rating}
        </span>
      </div>

      {/* Explanation */}
      <p className="text-[11px] text-textMain/80 leading-relaxed border-t border-borderSubtle/60 pt-2.5">
        {explanation}
      </p>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          onClick={() => navigate(`/restaurant/${restaurant.id}`)}
          className="py-1.5 rounded-xl bg-secondary hover:bg-card text-textMain border border-borderSubtle text-[11px] font-semibold flex items-center justify-center gap-1 transition-all"
        >
          <Eye className="w-3.5 h-3.5" />View Details
        </button>
        <button
          onClick={() => onCompare(restaurant)}
          className={`py-1.5 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all border ${
            isComparing
              ? 'bg-accent/20 border-accent/40 text-accent'
              : 'bg-secondary hover:bg-card text-muted hover:text-textMain border-borderSubtle'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />{isComparing ? 'Comparing' : 'Compare'}
        </button>
        <button
          onClick={() => onSelect(rec)}
          className={`py-1.5 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all border ${
            isSelected
              ? 'bg-accent text-background border-transparent shadow-glow-accent'
              : 'bg-secondary hover:bg-card text-textMain border-borderSubtle'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />{isSelected ? 'Selected' : 'Select Pitstop'}
        </button>
        <button
          onClick={() => onPreview(restaurant.id)}
          className={`py-1.5 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all border ${
            isPreviewing
              ? 'bg-warning text-background border-transparent'
              : 'bg-secondary hover:bg-card text-muted hover:text-textMain border-borderSubtle'
          }`}
        >
          <CornerDownRight className="w-3.5 h-3.5" />Preview Detour
        </button>
      </div>
    </div>
  );
}

/**
 * /pitstops – full grid of all eligible restaurants with sorting and filters.
 */
export function PitstopsPage() {
  const {
    engineResults,
    selectedRestaurantId,
    setSelectedRestaurantId,
    previewDetourRestaurantId,
    setPreviewDetourRestaurantId,
    toggleCompareRestaurant,
    compareList,
    isEngineCalculating
  } = useJourneyEngine();

  const [sortBy, setSortBy]     = useState('score');
  const [filterBy, setFilterBy] = useState('all');

  const handleSelectPitstop = async (rec) => {
    setSelectedRestaurantId(rec.restaurant.id);
    try {
      await getRepository().saveHistory({
        restaurantId: rec.restaurant.id,
        restaurantName: rec.restaurant.name,
        score: rec.finalScore,
        detourMeters: rec.detourResult?.detourDistanceMeters || 0,
        routeId: 'demo',
        timestamp: new Date().toISOString(),
      });
      showToast(`Selected "${rec.restaurant.name}" as pitstop!`, 'success');
    } catch (e) { /* non-critical */ }
  };

  const savedIds = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('waydine_saved_restaurants') || '[]');
    } catch { return []; }
  }, [filterBy]);

  const sorted = useMemo(() => {
    let list = [...engineResults.eligible];

    // Apply filter
    if (filterBy === 'green')     list = list.filter(r => r.detourResult?.accessibilityClass === 'GREEN');
    if (filterBy === 'drivethru') list = list.filter(r => r.restaurant.hasDriveThru);
    if (filterBy === 'open')      list = list.filter(r => r.foodSuitability?.isOpenAtEta);
    if (filterBy === 'saved')     list = list.filter(r => savedIds.includes(r.restaurant.id));

    // Apply sort
    if (sortBy === 'score')  list.sort((a, b) => b.finalScore - a.finalScore);
    if (sortBy === 'detour') list.sort((a, b) => (a.detourResult?.detourDistanceMeters ?? 9999) - (b.detourResult?.detourDistanceMeters ?? 9999));
    if (sortBy === 'eta')    list.sort((a, b) => (a.detourResult?.detourDurationSeconds ?? 9999) - (b.detourResult?.detourDurationSeconds ?? 9999));
    if (sortBy === 'rating') list.sort((a, b) => b.restaurant.rating - a.restaurant.rating);
    if (sortBy === 'food')   list.sort((a, b) => (b.foodSuitability?.isOpenAtEta ? 1 : 0) - (a.foodSuitability?.isOpenAtEta ? 1 : 0));

    return list;
  }, [engineResults.eligible, sortBy, filterBy]);

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent border border-accent/30 flex items-center justify-center">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-textMain">Explore Pitstops</h1>
            <p className="text-[11px] text-muted">All eligible corridor restaurants ranked by road convenience</p>
          </div>
        </div>
        <span className="text-xs font-mono bg-accent/15 text-accent border border-accent/30 px-3 py-1 rounded-full font-bold">
          {engineResults.eligible.length} eligible
        </span>
      </div>

      {/* Filter pills + Sort */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted shrink-0" />
          {FILTER_PILLS.map(p => (
            <button
              key={p.value}
              onClick={() => setFilterBy(p.value)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                filterBy === p.value
                  ? 'bg-accent text-background shadow-glow-accent'
                  : 'bg-card border border-borderSubtle text-muted hover:text-textMain'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-muted" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="bg-card border border-borderSubtle rounded-xl px-3 py-1.5 text-xs text-textMain focus:outline-none focus:border-accent"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading skeleton */}
      {isEngineCalculating && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-card border border-borderSubtle rounded-2xl h-52 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isEngineCalculating && sorted.length === 0 && (
        <div className="p-12 rounded-2xl bg-card border border-borderSubtle text-center space-y-3">
          <Utensils className="w-10 h-10 text-muted mx-auto" />
          <h3 className="text-sm font-bold text-textMain">No Pitstops Match Filters</h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            Try changing the filter pills above or loading the demo journey from the dashboard.
          </p>
        </div>
      )}

      {/* Pitstop Grid */}
      {!isEngineCalculating && sorted.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map(rec => (
            <PitstopCard
              key={rec.restaurant.id}
              rec={rec}
              isSelected={selectedRestaurantId === rec.restaurant.id}
              isComparing={compareList.some(r => r.id === rec.restaurant.id)}
              isPreviewing={previewDetourRestaurantId === rec.restaurant.id}
              onSelect={(rec) => handleSelectPitstop(rec)}
              onCompare={toggleCompareRestaurant}
              onPreview={(id) => setPreviewDetourRestaurantId(
                previewDetourRestaurantId === id ? null : id
              )}
            />
          ))}
        </div>
      )}

      {/* Rejected summary */}
      {engineResults.rejected.length > 0 && (
        <details className="bg-card border border-borderSubtle rounded-2xl p-4 text-xs cursor-pointer group">
          <summary className="font-semibold text-muted list-none flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              {engineResults.rejected.length} eliminated restaurants (click to expand)
            </span>
          </summary>
          <div className="mt-4 space-y-2">
            {engineResults.rejected.map(r => (
              <div key={r.restaurant.id} className="flex items-center justify-between py-2 border-t border-borderSubtle/50 text-xs">
                <span className="font-medium text-textMain">{r.restaurant.name}</span>
                <span className="text-danger font-mono bg-danger/10 px-2 py-0.5 rounded-md">{r.reasonMessage}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
