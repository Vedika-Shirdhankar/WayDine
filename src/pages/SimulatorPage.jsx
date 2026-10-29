import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play, Pause, RotateCcw, FastForward, Car, Navigation,
  Clock, MapPin, Zap, Gauge, GitCompare, CheckSquare,
  XCircle, CheckCircle2, AlertTriangle, HelpCircle, ShieldCheck,
  CornerDownRight, Utensils, Info, Timer
} from 'lucide-react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { useJourneyEngine } from '../context/JourneyContext.jsx';
import { getRepository } from '../data/restaurantRepository.js';
import {
  toRupeeTier, formatDistance, formatTimeIST, formatExtraMinutes, accessClassConfig
} from '../utils/indiaDefaults.js';

const SPEED_OPTIONS = [0.5, 1, 2, 5, 10];
const ACCESS_COLORS = { GREEN: '#35D07F', YELLOW: '#FFB84D', RED: '#FF5D67', UNVERIFIED: '#94A3B8' };
const CHART_COLORS = ['#B8F34A', '#35D07F', '#FFB84D', '#38BDF8', '#A78BFA'];

/** Format seconds as IST time string */
function etaFromSeconds(departureTime, secs) {
  const d = new Date(departureTime.getTime() + secs * 1000);
  return formatTimeIST(d);
}

/** Custom bar chart tooltip */
function ChartTip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-borderSubtle rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-textMain mb-0.5">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color || '#B8F34A' }}>
          {p.name}: <strong>{p.value}{unit}</strong>
        </p>
      ))}
    </div>
  );
}

/** Highlight the best (min or max) cell in a row */
function BestBadge({ isBest, children, bestClass = 'text-accent font-black' }) {
  return (
    <span className={isBest ? bestClass : 'text-textMain'}>
      {children}
    </span>
  );
}

/**
 * /simulator — What-If Simulator: vehicle scrubber + multi-restaurant comparison.
 */
export function SimulatorPage() {
  const {
    route,
    vehicleDistanceMeters,
    vehiclePosition,
    vehicleBearing,
    vehicleProgressPercent,
    totalRouteMeters,
    setVehicleProgressDistance,
    engineResults,
    departureTime,
    isEngineCalculating,
    loadDemoJourney,
    isLoading,
    compareList,
    toggleCompareRestaurant,
    setSelectedRestaurantId,
  } = useJourneyEngine();

  /* ─── Scrubber state ─── */
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(2);
  const intervalRef = useRef(null);
  const vehicleMetersRef = useRef(vehicleDistanceMeters);
  useEffect(() => { vehicleMetersRef.current = vehicleDistanceMeters; }, [vehicleDistanceMeters]);

  const TICK_MS = 400;
  const STEP_METERS = 500;

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        const next = vehicleMetersRef.current + STEP_METERS * speedMultiplier;
        if (next >= totalRouteMeters) {
          setIsPlaying(false);
          setVehicleProgressDistance(totalRouteMeters);
        } else {
          setVehicleProgressDistance(next);
        }
      }, TICK_MS);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, speedMultiplier, totalRouteMeters, setVehicleProgressDistance]);

  function handleReset() {
    setIsPlaying(false);
    setVehicleProgressDistance(0);
    vehicleMetersRef.current = 0;
  }

  /* ─── What-If comparison state ─── */
  // Selected IDs for comparison (up to 5)
  const [selectedIds, setSelectedIds] = useState(() => compareList.map(r => r.id).slice(0, 5));
  const [stopDurationMin, setStopDurationMin] = useState(30);
  const [chosenId, setChosenId] = useState(null);
  const [chosenMsg, setChosenMsg] = useState('');

  // All candidates (eligible + rejected), merged
  const allCandidates = useMemo(() => {
    const list = [];
    engineResults.eligible.forEach(rec => {
      list.push({ rec, rejected: null });
    });
    engineResults.rejected.forEach(r => {
      list.push({ rec: null, rejected: r });
    });
    return list;
  }, [engineResults]);

  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  }, []);

  const selectedRecs = useMemo(() =>
    selectedIds
      .map(id => engineResults.eligible.find(r => r.restaurant.id === id))
      .filter(Boolean),
  [selectedIds, engineResults.eligible]);

  /* ─── Chart data ─── */
  const chartData = useMemo(() =>
    selectedRecs.map(rec => ({
      name: rec.restaurant.name.split(' ')[0],
      fullName: rec.restaurant.name,
      detourM: rec.detourResult?.detourDistanceMeters || 0,
      detourKm: +((rec.detourResult?.detourDistanceMeters || 0) / 1000).toFixed(2),
      extraMin: Math.round((rec.detourResult?.detourDurationSeconds || 0) / 60),
      score: rec.finalScore,
      accessClass: rec.detourResult?.accessibilityClass || 'UNVERIFIED',
    })),
  [selectedRecs]);

  /* ─── Journey impact (single-restaurant "chosen" mode) ─── */
  const journeyImpact = useMemo(() => {
    if (selectedRecs.length !== 1) return null;
    const rec = selectedRecs[0];
    const dr = rec.detourResult || {};
    const baseDurationSec = route?.totalDurationSeconds || 8400;
    const detourSec = (dr.detourDurationSeconds || 0);
    const stopSec = stopDurationMin * 60;
    const totalExtraSec = detourSec + stopSec;
    const newDurationSec = baseDurationSec + totalExtraSec;

    const origArrival = new Date(departureTime.getTime() + baseDurationSec * 1000);
    const newArrival  = new Date(departureTime.getTime() + newDurationSec * 1000);

    return {
      origDurationMin: Math.round(baseDurationSec / 60),
      newDurationMin:  Math.round(newDurationSec / 60),
      extraTotalMin:   Math.round(totalExtraSec / 60),
      origArrivalIST:  formatTimeIST(origArrival),
      newArrivalIST:   formatTimeIST(newArrival),
      detourMin:       Math.round(detourSec / 60),
      stopMin:         stopDurationMin,
      rec,
    };
  }, [selectedRecs, route, departureTime, stopDurationMin]);

  const handleChoose = useCallback(async (rec) => {
    setSelectedRestaurantId(rec.restaurant.id);
    setChosenId(rec.restaurant.id);
    setChosenMsg(`✓ "${rec.restaurant.name}" selected as your pitstop!`);
    setTimeout(() => setChosenMsg(''), 3000);
    try {
      await getRepository().saveHistory({
        restaurantId: rec.restaurant.id,
        restaurantName: rec.restaurant.name,
        score: rec.finalScore,
        detourMeters: rec.detourResult?.detourDistanceMeters || 0,
        routeId: route?.id || 'demo',
        timestamp: new Date().toISOString(),
      });
    } catch (e) { /* non-critical */ }
  }, [setSelectedRestaurantId, route]);

  /* ─── Best values per row for highlight ─── */
  function bestIdx(arr, higher = true) {
    if (!arr.length) return -1;
    let best = arr[0], bi = 0;
    arr.forEach((v, i) => { if (higher ? v > best : v < best) { best = v; bi = i; } });
    return bi;
  }

  // IST ETA computed at vehicle position
  const elapsedSeconds = route ? Math.round(vehicleDistanceMeters / 25) : 0;
  const currentEtaIST = formatTimeIST(new Date(departureTime.getTime() + elapsedSeconds * 1000));
  const remainingMeters = Math.max(0, totalRouteMeters - vehicleDistanceMeters);
  const remainingMin = Math.round(remainingMeters / (25 * 60));

  return (
    <div className="p-4 lg:p-6 space-y-6">

      {/* ══════════════════════ SECTION A — ROUTE SIMULATOR ══════════════════════ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent border border-accent/30 flex items-center justify-center">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-textMain">What-If Simulator</h1>
            <p className="text-[11px] text-muted">Advance vehicle · compare pitstops · see journey impact (IST times)</p>
          </div>
        </div>
        {!route && (
          <button onClick={loadDemoJourney} disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent/15 border border-accent/30 text-accent hover:bg-accent/25 text-xs font-bold transition-all">
            <Zap className="w-3.5 h-3.5 fill-current" />Load Demo Journey
          </button>
        )}
      </div>

      {/* Stats ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Gauge className="w-4 h-4" />,     label: 'Progress',         val: `${vehicleProgressPercent}%`,                        color: 'text-accent' },
          { icon: <MapPin className="w-4 h-4" />,    label: 'Distance Driven',  val: formatDistance(vehicleDistanceMeters),               color: 'text-textMain' },
          { icon: <Clock className="w-4 h-4" />,     label: 'Current ETA (IST)',val: currentEtaIST,                                       color: 'text-success' },
          { icon: <Navigation className="w-4 h-4" />,label: 'Remaining',        val: `${formatDistance(remainingMeters)} · ${remainingMin} min`, color: 'text-warning' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-borderSubtle rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center text-muted shrink-0">{s.icon}</div>
            <div>
              <div className="text-[10px] text-muted font-mono">{s.label}</div>
              <div className={`text-sm font-black font-mono ${s.color}`}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Scrubber card */}
      <div className="bg-card border border-borderSubtle rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-muted">Mumbai (Start)</span>
          <span className="text-accent font-bold">{formatDistance(vehicleDistanceMeters)} / {formatDistance(totalRouteMeters || 148500)}</span>
          <span className="text-muted">Pune (End)</span>
        </div>
        <div className="relative">
          <input type="range" min="0" max={totalRouteMeters || 148500} step="250"
            value={vehicleDistanceMeters}
            onChange={e => { setIsPlaying(false); setVehicleProgressDistance(Number(e.target.value)); }}
            className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-accent" />
          <div className="flex justify-between text-[10px] text-muted mt-1 font-mono">
            <span>KM 0</span><span>KM 25</span><span>KM 65</span><span>KM 95</span><span>KM 148</span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button onClick={handleReset}
            className="w-10 h-10 rounded-xl bg-secondary border border-borderSubtle text-muted hover:text-textMain flex items-center justify-center transition-all" title="Reset">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={() => setIsPlaying(p => !p)}
            disabled={!route || vehicleDistanceMeters >= totalRouteMeters}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold transition-all shadow-lg ${isPlaying ? 'bg-warning text-background' : 'bg-accent text-background hover:bg-accentHover'} disabled:opacity-40`}>
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </button>
          <div className="flex items-center gap-1">
            <FastForward className="w-4 h-4 text-muted" />
            {SPEED_OPTIONS.map(s => (
              <button key={s} onClick={() => setSpeedMultiplier(s)}
                className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-all ${speedMultiplier === s ? 'bg-accent text-background' : 'bg-secondary border border-borderSubtle text-muted hover:text-textMain'}`}>
                {s}×
              </button>
            ))}
          </div>
        </div>
        <div className="text-center text-[10px] text-muted font-mono">
          Vehicle @ [{vehiclePosition[0].toFixed(4)}, {vehiclePosition[1].toFixed(4)}] · Bearing {vehicleBearing.toFixed(1)}° · IST {currentEtaIST}
        </div>
      </div>

      {/* Live re-ranking */}
      <div className="bg-card border border-borderSubtle rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-wider font-bold text-muted">Live Rankings at Current Position</h2>
          {isEngineCalculating && <span className="text-[10px] text-accent font-mono animate-pulse">Recalculating…</span>}
        </div>
        {engineResults.eligible.length === 0 ? (
          <p className="text-xs text-muted text-center py-4">No eligible pitstops. Load a demo journey first.</p>
        ) : (
          <div className="space-y-1.5">
            {engineResults.eligible.slice(0, 5).map(rec => (
              <div key={rec.restaurant.id}
                className="flex items-center justify-between p-2.5 bg-secondary border border-borderSubtle rounded-xl text-xs hover:border-borderStrong transition-all">
                <div className="flex items-center gap-2.5">
                  <span className={`w-6 h-6 rounded-lg font-mono font-black flex items-center justify-center text-[11px] ${rec.rank === 1 ? 'bg-accent text-background' : 'bg-card text-textMain border border-borderSubtle'}`}>
                    #{rec.rank}
                  </span>
                  <div>
                    <div className="font-semibold text-textMain">{rec.restaurant.name}</div>
                    <div className="text-[10px] text-muted">{rec.restaurant.cuisineType} · ETA {rec.foodSuitability?.projectedEta}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black font-mono text-accent">{rec.finalScore}</div>
                  <div className="text-[10px] text-muted">{formatExtraMinutes(rec.detourResult?.detourDurationSeconds)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════ SECTION B — WHAT-IF COMPARISON ══════════════════════ */}
      <div className="border-t border-borderStrong pt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent border border-accent/30 flex items-center justify-center">
            <GitCompare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-textMain">What-If Pitstop Comparison</h2>
            <p className="text-[11px] text-muted">Select up to 5 pitstops to compare side-by-side</p>
          </div>
          {selectedIds.length > 0 && (
            <button onClick={() => setSelectedIds([])}
              className="ml-auto text-[11px] text-muted hover:text-danger flex items-center gap-1 transition-colors">
              <XCircle className="w-3.5 h-3.5" />Clear
            </button>
          )}
        </div>

        {/* Restaurant picker */}
        {allCandidates.length === 0 ? (
          <div className="bg-card border border-borderSubtle rounded-2xl p-10 text-center space-y-2">
            <Utensils className="w-10 h-10 text-muted mx-auto" />
            <p className="text-sm font-bold text-textMain">No restaurants to compare</p>
            <p className="text-xs text-muted">Load the demo journey from the dashboard first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 mb-5">
            {allCandidates.map(({ rec, rejected }) => {
              const rest = rec?.restaurant || rejected?.restaurant;
              if (!rest) return null;
              const isEligible = !!rec;
              const isSelected = selectedIds.includes(rest.id);
              const disabled = !isEligible;
              const ac = rec?.detourResult?.accessibilityClass || 'UNVERIFIED';

              return (
                <button key={rest.id}
                  onClick={() => !disabled && toggleSelect(rest.id)}
                  disabled={disabled || (!isSelected && selectedIds.length >= 5)}
                  className={`relative p-2.5 rounded-xl border text-left transition-all text-xs ${
                    disabled
                      ? 'bg-secondary/40 border-borderSubtle opacity-60 cursor-not-allowed'
                      : isSelected
                        ? 'bg-cardHover border-accent shadow-glow-accent'
                        : 'bg-card border-borderSubtle hover:border-borderStrong cursor-pointer'
                  }`}>
                  {isSelected && (
                    <CheckSquare className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-accent" />
                  )}
                  <div className="font-semibold text-textMain leading-snug line-clamp-2 pr-4">{rest.name}</div>
                  <div className="text-[10px] text-muted mt-0.5">{rest.cuisineType}</div>
                  <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                    {isEligible ? (
                      <span className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded ${accessClassConfig(ac).bgClass}`}>{ac}</span>
                    ) : (
                      <span className="text-[9px] font-mono text-danger bg-danger/15 px-1 py-0.5 rounded">
                        {rejected.reasonCode?.replace(/_/g, ' ')}
                      </span>
                    )}
                    {isEligible && <span className="text-[9px] font-mono text-accent">{rec.finalScore}/100</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Comparison table + charts */}
        {selectedRecs.length === 0 ? (
          <div className="bg-card border border-borderSubtle rounded-2xl p-10 text-center space-y-2">
            <Info className="w-9 h-9 text-muted mx-auto" />
            <p className="text-xs text-muted">Select 1–5 eligible pitstops above to see the comparison.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* ── Comparison table ── */}
            <div className="bg-card border border-borderSubtle rounded-2xl p-4 overflow-x-auto">
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-muted mb-3">
                Side-by-Side Comparison ({selectedRecs.length} pitstop{selectedRecs.length > 1 ? 's' : ''})
              </h3>
              <table className="w-full text-xs" style={{ minWidth: `${200 + selectedRecs.length * 120}px` }}>
                <thead>
                  <tr className="border-b border-borderSubtle">
                    <th className="text-left py-2 pr-4 text-muted font-mono text-[10px] uppercase w-36">Attribute</th>
                    {selectedRecs.map(rec => (
                      <th key={rec.restaurant.id} className="text-center py-2 px-2 min-w-[110px]">
                        <div className="font-bold text-textMain leading-snug">{rec.restaurant.name.split(' ')[0]}</div>
                        <div className="text-[9px] text-muted font-normal">{rec.restaurant.cuisineType}</div>
                        <div className="text-[9px] font-mono text-accent">{toRupeeTier(rec.restaurant.priceRange)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderSubtle/40">
                  {/* Score */}
                  {(() => {
                    const vals = selectedRecs.map(r => r.finalScore);
                    const bi = bestIdx(vals, true);
                    return (
                      <tr>
                        <td className="py-2 pr-4 text-muted font-mono text-[10px]">Overall Score</td>
                        {selectedRecs.map((rec, i) => (
                          <td key={rec.restaurant.id} className="text-center py-2 px-2">
                            <BestBadge isBest={i === bi}><span className="font-mono font-black">{rec.finalScore}/100</span></BestBadge>
                          </td>
                        ))}
                      </tr>
                    );
                  })()}
                  {/* Extra Distance */}
                  {(() => {
                    const vals = selectedRecs.map(r => r.detourResult?.detourDistanceMeters || 0);
                    const bi = bestIdx(vals, false);
                    return (
                      <tr>
                        <td className="py-2 pr-4 text-muted font-mono text-[10px]">Extra Distance</td>
                        {selectedRecs.map((rec, i) => (
                          <td key={rec.restaurant.id} className="text-center py-2 px-2">
                            <BestBadge isBest={i === bi} bestClass="text-success font-bold">
                              {formatDistance(rec.detourResult?.detourDistanceMeters || 0)}
                            </BestBadge>
                          </td>
                        ))}
                      </tr>
                    );
                  })()}
                  {/* Extra Time */}
                  {(() => {
                    const vals = selectedRecs.map(r => r.detourResult?.detourDurationSeconds || 0);
                    const bi = bestIdx(vals, false);
                    return (
                      <tr>
                        <td className="py-2 pr-4 text-muted font-mono text-[10px]">Extra Time</td>
                        {selectedRecs.map((rec, i) => (
                          <td key={rec.restaurant.id} className="text-center py-2 px-2">
                            <BestBadge isBest={i === bi} bestClass="text-success font-bold">
                              +{Math.round((rec.detourResult?.detourDurationSeconds || 0) / 60)} min
                            </BestBadge>
                          </td>
                        ))}
                      </tr>
                    );
                  })()}
                  {/* U-Turn */}
                  {(() => {
                    return (
                      <tr>
                        <td className="py-2 pr-4 text-muted font-mono text-[10px]">U-Turn Required</td>
                        {selectedRecs.map(rec => {
                          const needsU = (rec.detourResult?.uTurnCount || 0) > 0;
                          return (
                            <td key={rec.restaurant.id} className="text-center py-2 px-2">
                              {needsU
                                ? <span className="text-danger font-mono text-[10px]">Yes ⚠</span>
                                : <span className="text-success font-mono text-[10px] font-bold">No ✓</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })()}
                  {/* Accessibility */}
                  <tr>
                    <td className="py-2 pr-4 text-muted font-mono text-[10px]">Accessibility</td>
                    {selectedRecs.map(rec => {
                      const ac = rec.detourResult?.accessibilityClass || 'UNVERIFIED';
                      const cfg = accessClassConfig(ac);
                      return (
                        <td key={rec.restaurant.id} className="text-center py-2 px-2">
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${cfg.bgClass}`}>{ac}</span>
                        </td>
                      );
                    })}
                  </tr>
                  {/* ETA */}
                  <tr>
                    <td className="py-2 pr-4 text-muted font-mono text-[10px]">ETA at Stop (IST)</td>
                    {selectedRecs.map(rec => (
                      <td key={rec.restaurant.id} className="text-center py-2 px-2 font-mono text-[11px] text-textMain">
                        {rec.foodSuitability?.projectedEta || '--:--'}
                      </td>
                    ))}
                  </tr>
                  {/* Open */}
                  {(() => {
                    return (
                      <tr>
                        <td className="py-2 pr-4 text-muted font-mono text-[10px]">Open at ETA?</td>
                        {selectedRecs.map(rec => (
                          <td key={rec.restaurant.id} className="text-center py-2 px-2">
                            {rec.foodSuitability?.isOpenAtEta
                              ? <CheckCircle2 className="w-4 h-4 text-success mx-auto" />
                              : <XCircle className="w-4 h-4 text-danger mx-auto" />}
                          </td>
                        ))}
                      </tr>
                    );
                  })()}
                  {/* Meal Window */}
                  <tr>
                    <td className="py-2 pr-4 text-muted font-mono text-[10px]">Meal Window</td>
                    {selectedRecs.map(rec => (
                      <td key={rec.restaurant.id} className="text-center py-2 px-2 text-[10px] text-textMain">
                        {rec.foodSuitability?.mealWindow || 'N/A'}
                      </td>
                    ))}
                  </tr>
                  {/* Price */}
                  <tr>
                    <td className="py-2 pr-4 text-muted font-mono text-[10px]">Price (₹)</td>
                    {selectedRecs.map(rec => (
                      <td key={rec.restaurant.id} className="text-center py-2 px-2 font-mono text-[11px] text-textMain">
                        {toRupeeTier(rec.restaurant.priceRange)}
                      </td>
                    ))}
                  </tr>
                  {/* Avg Dine Time */}
                  <tr>
                    <td className="py-2 pr-4 text-muted font-mono text-[10px]">Avg Dine Time</td>
                    {selectedRecs.map(rec => (
                      <td key={rec.restaurant.id} className="text-center py-2 px-2 text-[10px] text-textMain">
                        {rec.restaurant.averageDineMinutes || '?'} min
                      </td>
                    ))}
                  </tr>
                  {/* "Choose" row */}
                  <tr className="border-t border-borderStrong">
                    <td className="py-2 pr-4 text-muted font-mono text-[10px]">Action</td>
                    {selectedRecs.map(rec => (
                      <td key={rec.restaurant.id} className="text-center py-2 px-2">
                        <button
                          onClick={() => handleChoose(rec)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                            chosenId === rec.restaurant.id
                              ? 'bg-success text-background'
                              : 'bg-accent/20 border border-accent/40 text-accent hover:bg-accent/30'
                          }`}>
                          {chosenId === rec.restaurant.id ? '✓ Chosen' : 'Choose'}
                        </button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── Bar Charts ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { title: 'Extra Distance (km)', dataKey: 'detourKm', unit: ' km', color: '#38BDF8' },
                { title: 'Extra Time (min)',     dataKey: 'extraMin', unit: ' min', color: '#FFB84D' },
                { title: 'Overall Score',        dataKey: 'score',    unit: '',    color: '#B8F34A' },
              ].map(chart => (
                <div key={chart.title} className="bg-card border border-borderSubtle rounded-2xl p-4 space-y-2">
                  <p className="text-[11px] font-mono text-muted">{chart.title}</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#223048" />
                      <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 9 }} />
                      <YAxis tick={{ fill: '#94A3B8', fontSize: 9 }} />
                      <Tooltip content={<ChartTip unit={chart.unit} />} />
                      <Bar dataKey={chart.dataKey} name={chart.title} radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, i) => (
                          <Cell key={i}
                            fill={chart.dataKey === 'detourKm' || chart.dataKey === 'extraMin'
                              ? ACCESS_COLORS[entry.accessClass] || '#94A3B8'
                              : CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>

            {/* ── Journey Impact (single restaurant mode) ── */}
            {selectedRecs.length === 1 && journeyImpact && (
              <div className="bg-card border border-borderSubtle rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-accent" />
                  <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-muted">
                    Journey Impact — {journeyImpact.rec.restaurant.name}
                  </h3>
                </div>

                {/* Stop duration slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Stop Duration</span>
                    <span className="font-mono text-accent font-bold">{stopDurationMin} min</span>
                  </div>
                  <input type="range" min="5" max="90" step="5" value={stopDurationMin}
                    onChange={e => setStopDurationMin(Number(e.target.value))}
                    className="w-full h-1.5 bg-secondary rounded-full appearance-none cursor-pointer accent-accent" />
                  <div className="flex justify-between text-[10px] text-muted font-mono">
                    <span>5 min</span><span>30 min (default)</span><span>90 min</span>
                  </div>
                </div>

                {/* Before / After */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-secondary p-3 rounded-xl border border-borderSubtle space-y-1">
                    <div className="text-[10px] text-muted font-mono uppercase">Original Journey</div>
                    <div className="text-textMain font-bold">{journeyImpact.origDurationMin} min total</div>
                    <div className="text-muted">Arrive Pune: <strong className="text-textMain">{journeyImpact.origArrivalIST}</strong> IST</div>
                  </div>
                  <div className="bg-secondary p-3 rounded-xl border border-accent/30 space-y-1">
                    <div className="text-[10px] text-muted font-mono uppercase">With Pitstop</div>
                    <div className="text-textMain font-bold">{journeyImpact.newDurationMin} min total</div>
                    <div className="text-muted">Arrive Pune: <strong className="text-textMain">{journeyImpact.newArrivalIST}</strong> IST</div>
                  </div>
                </div>

                {/* Delta */}
                <div className={`flex items-center justify-center gap-3 p-3 rounded-xl border ${
                  journeyImpact.extraTotalMin > 30 ? 'bg-danger/15 border-danger/30' : 'bg-warning/15 border-warning/30'
                }`}>
                  <div className={`text-2xl font-black font-mono ${journeyImpact.extraTotalMin > 30 ? 'text-danger' : 'text-warning'}`}>
                    +{journeyImpact.extraTotalMin} min
                  </div>
                  <div className="text-xs text-muted space-y-0.5">
                    <div>Detour: +{journeyImpact.detourMin} min</div>
                    <div>Stop: +{journeyImpact.stopMin} min</div>
                  </div>
                </div>

                {/* Estimated Cost in INR */}
                {(() => {
                  const detourKm = (journeyImpact.rec.detourResult?.detourDistanceMeters || 0) / 1000;
                  const fuelCost = Math.round(detourKm * 10); // ~₹10/km detour fuel estimate
                  const price = journeyImpact.rec.restaurant.priceRange;
                  const mealCost = price === '$' || price === '₹' ? 250 : price === '$$$' || price === '₹₹₹' ? 1200 : 550;
                  const totalEst = fuelCost + mealCost;
                  return (
                    <div className="bg-secondary p-3 rounded-xl border border-borderSubtle flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-muted font-mono uppercase block">Estimated Pitstop Cost</span>
                        <span className="text-textMain">Meal (~₹{mealCost}) + Extra Fuel (~₹{fuelCost})</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black font-mono text-accent">~₹{totalEst}</span>
                        <span className="text-[9px] text-muted block">for 2 people</span>
                      </div>
                    </div>
                  );
                })()}

                <button onClick={() => handleChoose(journeyImpact.rec)}
                  className={`w-full py-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-glow-accent ${
                    chosenId === journeyImpact.rec.restaurant.id
                      ? 'bg-success text-background'
                      : 'bg-accent hover:bg-accentHover text-background'
                  }`}>
                  <CheckSquare className="w-4 h-4" />
                  {chosenId === journeyImpact.rec.restaurant.id ? '✓ Selected as Pitstop!' : 'Choose This Stop'}
                </button>

                {chosenMsg && (
                  <div className="text-center text-xs text-success font-semibold animate-pulse">{chosenMsg}</div>
                )}
              </div>
            )}

            {selectedRecs.length > 1 && (
              <p className="text-[11px] text-muted text-center">
                Select exactly <strong>1</strong> restaurant to see the full journey-time impact panel.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
