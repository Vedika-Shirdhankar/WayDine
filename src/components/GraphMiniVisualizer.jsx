/**
 * GraphMiniVisualizer.jsx
 *
 * Full-screen interactive Dijkstra Graph Explorer
 *
 * Key Design Features:
 *  - Zero canvas text clutter: Nodes are glowing interactive vectors with emoji icons for key points.
 *  - Full Zoom & Pan controls: Zoom into dense junction clusters with mouse drag or +/- buttons.
 *  - Click-to-inspect: Clicking any node highlights it and opens its detailed inspection card in the sidebar.
 *  - Tabbed Sidebar: Analysis & Scores, Traversal Visit Log, and Route Overview in clean tabs (no vertical overlaps).
 *  - Clear explanations for all Accessibility Classes (GREEN, YELLOW, RED, UNVERIFIED).
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X, Play, Pause, RotateCcw, Cpu, GitBranch, Navigation,
  MapPin, CheckCircle, Trophy, Route, TrendingUp, ChevronRight,
  Info, Zap, Clock, Star, ArrowRight, Circle, ZoomIn, ZoomOut,
  Layers, Compass, ShieldCheck, AlertCircle, HelpCircle
} from 'lucide-react';
import { useJourneyEngine } from '../context/JourneyContext.jsx';
import { accessClassConfig } from '../utils/indiaDefaults.js';

// ─── Min-Heap for Dijkstra ──────────────────────────────────────────────────
class MinHeap {
  constructor() { this.h = []; }
  push(id, d) {
    this.h.push({ id, d });
    let i = this.h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.h[p].d <= this.h[i].d) break;
      [this.h[p], this.h[i]] = [this.h[i], this.h[p]]; i = p;
    }
  }
  pop() {
    const top = this.h[0];
    const last = this.h.pop();
    if (this.h.length > 0 && last !== undefined) {
      this.h[0] = last;
      let i = 0;
      while (true) {
        let s = i, l = 2 * i + 1, r = l + 1;
        if (l < this.h.length && this.h[l].d < this.h[s].d) s = l;
        if (r < this.h.length && this.h[r].d < this.h[s].d) s = r;
        if (s === i) break;
        [this.h[s], this.h[i]] = [this.h[i], this.h[s]]; i = s;
      }
    }
    return top;
  }
  get size() { return this.h.length; }
}

function runDijkstraTrace(nodes, edges, startId, targetId) {
  const adj = new Map();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (!e.blocked && adj.has(e.from)) {
      adj.get(e.from).push({ to: e.to, d: e.distanceMeters || 1 });
    }
  }

  const dist = new Map();
  const prev = new Map();
  const visitOrder = [];

  if (!adj.has(startId)) return { visitOrder: [startId], finalPath: [startId], dist };
  dist.set(startId, 0);
  const heap = new MinHeap();
  heap.push(startId, 0);

  while (heap.size > 0) {
    const { id, d } = heap.pop();
    if (d > (dist.get(id) ?? Infinity)) continue;
    visitOrder.push(id);
    if (id === targetId) break;
    for (const edge of (adj.get(id) || [])) {
      const nd = d + edge.d;
      if (nd < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, nd);
        prev.set(edge.to, id);
        heap.push(edge.to, nd);
      }
    }
  }

  const finalPath = [];
  if (dist.has(targetId)) {
    let cur = targetId;
    while (cur !== undefined) {
      finalPath.unshift(cur);
      cur = prev.get(cur);
      if (finalPath.length > nodes.length) break;
    }
  }

  return { visitOrder, finalPath, dist };
}

// ─── Layout Coordinate Normalizer ───────────────────────────────────────────
function buildLayout(nodes, W, H, pad = 65) {
  if (!nodes || nodes.length === 0) return { toX: () => W / 2, toY: () => H / 2 };
  const lats = nodes.map(n => n.location[0]);
  const lngs = nodes.map(n => n.location[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const rX = maxLng - minLng || 0.001;
  const rY = maxLat - minLat || 0.001;
  const scale = Math.min((W - pad * 2) / rX, (H - pad * 2) / rY);
  const oX = pad + ((W - pad * 2) - scale * rX) / 2;
  const oY = pad + ((H - pad * 2) - scale * rY) / 2;
  return {
    toX: lng => oX + (lng - minLng) * scale,
    toY: lat => oY + (maxLat - lat) * scale
  };
}

const fmtDist = m => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;

function cleanNodeName(id) {
  return (id || '')
    .replace(/^NODE_/, '')
    .replace(/^REST_\d+_/, '')
    .replace(/^ACCESS::/, '')
    .replace(/^CROSS::/, '')
    .replace(/_/g, ' ')
    .trim();
}

// ─── Score Bar Component ─────────────────────────────────────────────────────
function ScoreBar({ label, value, color, weight }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[10px]">
        <span className="text-slate-400">{label}</span>
        <div className="flex items-center gap-1.5 font-mono">
          {weight && <span className="text-[9px] text-slate-500">w:{weight}%</span>}
          <span className="font-bold text-white" style={{ color }}>{value}/100</span>
        </div>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── Pitstop Header Tab ──────────────────────────────────────────────────────
function PitstopTab({ rec, isActive, onClick }) {
  const ac = rec.detourResult?.accessibilityClass || 'UNVERIFIED';
  const dotColor = ac === 'GREEN' ? '#22c55e' : ac === 'YELLOW' ? '#f59e0b' : ac === 'RED' ? '#ef4444' : '#94a3b8';
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap border shrink-0 ${
        isActive
          ? 'bg-accent/15 border-accent/60 text-accent shadow-[0_0_12px_rgba(184,243,74,0.15)]'
          : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
      }`}
    >
      <span className={`text-[10px] font-mono font-black ${isActive ? 'text-accent' : 'text-slate-500'}`}>
        #{rec.rank}
      </span>
      <span className="truncate max-w-[85px]">{rec.restaurant.name.split(' ')[0]}</span>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
      <span className={`font-mono text-[10px] ${isActive ? 'text-accent font-bold' : 'text-slate-500'}`}>
        {rec.finalScore}
      </span>
    </button>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function GraphMiniVisualizer({ onClose }) {
  const {
    graphSnapshot, selectedRecommendation, engineResults,
    route, vehicleHeading, dataSourceTag, startPoint, destinationPoint
  } = useJourneyEngine();

  const SVG_W = 800, SVG_H = 520;

  // Active tab in the right panel: 'analysis' | 'log' | 'overview'
  const [activeTab, setActiveTab] = useState('analysis');

  // Animation playback state
  const [animStep, setAnimStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(160);
  const timerRef = useRef(null);
  const stepListRef = useRef(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Node selection
  const [clickedNodeId, setClickedNodeId] = useState(null);

  const eligible = useMemo(() => engineResults?.eligible || [], [engineResults]);
  const [activePitstopId, setActivePitstopId] = useState(
    () => selectedRecommendation?.restaurant?.id || eligible[0]?.restaurant?.id || null
  );

  const activeRec = useMemo(() =>
    eligible.find(r => r.restaurant.id === activePitstopId) || selectedRecommendation || eligible[0] || null,
    [activePitstopId, eligible, selectedRecommendation]
  );

  const bestRec = useMemo(() => eligible.find(r => r.rank === 1) || eligible[0] || null, [eligible]);

  // Derived start & target
  const { startId, targetId, legs } = useMemo(() => {
    if (!activeRec) return { startId: null, targetId: null, legs: null };
    const att = activeRec.detourResult?.attachment;
    const l = activeRec.detourResult?.legs;
    return {
      startId: l?.toAccess?.nodes?.[0] ?? null,
      targetId: att?.accessNodeId ?? null,
      legs: l ?? null
    };
  }, [activeRec]);

  // Dijkstra trace
  const trace = useMemo(() => {
    if (!graphSnapshot || !startId || !targetId) return null;
    return runDijkstraTrace(graphSnapshot.nodes, graphSnapshot.edges, startId, targetId);
  }, [graphSnapshot, startId, targetId]);

  const totalSteps = trace?.visitOrder.length ?? 0;

  const pathNodeSet = useMemo(() => {
    const s = new Set();
    legs?.toAccess?.nodes?.forEach(n => s.add(n));
    legs?.accessToRejoin?.nodes?.forEach(n => s.add(n));
    return s;
  }, [legs]);

  const visitedSet = useMemo(() => {
    if (!trace) return new Set();
    return new Set(trace.visitOrder.slice(0, animStep));
  }, [trace, animStep]);

  const currentVisiting = trace?.visitOrder[animStep - 1] ?? null;

  // Layout calculations
  const { toX, toY } = useMemo(() => {
    if (!graphSnapshot?.nodes) return buildLayout([], SVG_W, SVG_H);
    return buildLayout(graphSnapshot.nodes, SVG_W, SVG_H);
  }, [graphSnapshot]);

  const nodePos = useMemo(() => {
    const m = new Map();
    (graphSnapshot?.nodes || []).forEach(n => m.set(n.id, { x: toX(n.location[1]), y: toY(n.location[0]) }));
    return m;
  }, [graphSnapshot, toX, toY]);

  // Playback timer controls
  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startPlay = useCallback(() => {
    stopTimer();
    setPlaying(true);
    timerRef.current = setInterval(() => {
      setAnimStep(s => {
        if (s >= totalSteps) { setPlaying(false); stopTimer(); return s; }
        return s + 1;
      });
    }, speed);
  }, [speed, totalSteps, stopTimer]);

  const reset = useCallback(() => {
    stopTimer();
    setAnimStep(0);
    setPlaying(false);
  }, [stopTimer]);

  useEffect(() => { if (playing) startPlay(); }, [speed]);
  useEffect(() => () => stopTimer(), [stopTimer]);

  useEffect(() => {
    if (totalSteps > 0) {
      setAnimStep(0);
      setClickedNodeId(null);
      const t = setTimeout(startPlay, 400);
      return () => clearTimeout(t);
    }
  }, [trace]);

  // Auto-scroll visit log
  useEffect(() => {
    if (stepListRef.current && animStep > 0) {
      const el = stepListRef.current.querySelector(`[data-step="${animStep - 1}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [animStep]);

  const nodes = graphSnapshot?.nodes || [];
  const edges = graphSnapshot?.edges || [];

  // Edges highlighting
  const toAccessEdges = useMemo(() => {
    const s = new Set();
    if (legs?.toAccess?.nodes) {
      for (let i = 0; i < legs.toAccess.nodes.length - 1; i++)
        s.add(`${legs.toAccess.nodes[i]}->${legs.toAccess.nodes[i + 1]}`);
    }
    return s;
  }, [legs]);

  const rejoinEdges = useMemo(() => {
    const s = new Set();
    if (legs?.accessToRejoin?.nodes) {
      for (let i = 0; i < legs.accessToRejoin.nodes.length - 1; i++)
        s.add(`${legs.accessToRejoin.nodes[i]}->${legs.accessToRejoin.nodes[i + 1]}`);
    }
    return s;
  }, [legs]);

  const allTargetIds = useMemo(() => {
    const s = new Set();
    eligible.forEach(rec => {
      const tId = rec.detourResult?.attachment?.accessNodeId ?? rec.detourResult?.legs?.toAccess?.nodes?.at(-1);
      if (tId) s.add(tId);
    });
    return s;
  }, [eligible]);

  // Score factors
  const scoreFactors = [
    { key: 'detourScore', label: 'Detour Efficiency', color: '#38bdf8', weight: 25 },
    { key: 'directionScore', label: 'Direction Compat.', color: '#a78bfa', weight: 20 },
    { key: 'accessScore', label: 'Road Accessibility', color: '#22c55e', weight: 20 },
    { key: 'foodEtaScore', label: 'Food Availability', color: '#f59e0b', weight: 15 },
    { key: 'timeScore', label: 'Time Compat.', color: '#f97316', weight: 10 },
    { key: 'preferenceScore', label: 'Preference Match', color: '#ec4899', weight: 10 },
  ];
  const sc = activeRec?.scoreBreakdown || activeRec?.scoreComponents || {};

  const whyBest = useMemo(() => {
    if (!bestRec) return [];
    const bsc = bestRec.scoreBreakdown || bestRec.scoreComponents || {};
    return scoreFactors
      .map(f => ({ ...f, val: bsc[f.key] ?? 0 }))
      .sort((a, b) => b.val - a.val)
      .slice(0, 3);
  }, [bestRec]);

  // Clicked node inspector data
  const clickedNode = useMemo(() => {
    if (!clickedNodeId) return null;
    return nodes.find(n => n.id === clickedNodeId) || null;
  }, [clickedNodeId, nodes]);

  const clickedNodeRole = useMemo(() => {
    if (!clickedNode) return null;
    if (clickedNode.id === startId) return 'vehicle';
    if (clickedNode.id === targetId) return 'target';
    if (pathNodeSet.has(clickedNode.id)) return 'path';
    if (allTargetIds.has(clickedNode.id) && clickedNode.id !== targetId) return 'other_target';
    if (visitedSet.has(clickedNode.id)) return 'visited';
    return 'default';
  }, [clickedNode, startId, targetId, pathNodeSet, allTargetIds, visitedSet]);

  const clickedNodeDist = clickedNode ? trace?.dist?.get(clickedNode.id) : undefined;
  const clickedNodeStep = clickedNode ? trace?.visitOrder?.indexOf(clickedNode.id) : undefined;

  // Pan handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y
    });
  };

  const handleMouseUp = () => setIsPanning(false);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const sourceLabel = startPoint?.name?.split(' (')[0] || 'Origin';
  const destLabel = destinationPoint?.name?.split(' (')[0] || 'Destination';

  const bestTargetId = bestRec?.detourResult?.attachment?.accessNodeId;
  const currentAccessClass = activeRec?.detourResult?.accessibilityClass || 'UNVERIFIED';
  const accessConfig = accessClassConfig(currentAccessClass);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#050b14] text-slate-100 overflow-hidden font-sans">

      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#080f1d]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-accent/15 border border-accent/40 text-accent">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-extrabold text-white tracking-tight">Dijkstra Live Visualizer</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                dataSourceTag?.includes('OSRM') || dataSourceTag?.includes('Live')
                  ? 'bg-success/20 text-success border-success/40'
                  : 'bg-warning/20 text-warning border-warning/40'
              }`}>
                {dataSourceTag || 'Demo Route'}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-slate-300 flex items-center gap-1">
                <Navigation className="w-2.5 h-2.5 text-accent" />
                {sourceLabel} → {destLabel}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              {nodes.length} road graph vertices · {edges.length} directed edges · Binary Min-Heap Priority Queue
              {eligible.length > 0 && ` · ${eligible.length} pitstops ranked`}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
          title="Close Visualizer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── PITSTOP SELECTION STRIP ─────────────────────────────────────────── */}
      {eligible.length > 1 && (
        <div className="shrink-0 flex items-center gap-2 px-5 py-2.5 border-b border-white/8 bg-[#070e1b] overflow-x-auto">
          <span className="text-[11px] font-mono text-slate-400 shrink-0 flex items-center gap-1.5 font-medium">
            <Route className="w-3.5 h-3.5 text-accent" /> Compare Trace for:
          </span>
          {eligible.slice(0, 8).map(rec => (
            <PitstopTab
              key={rec.restaurant.id}
              rec={rec}
              isActive={activePitstopId === rec.restaurant.id}
              onClick={() => {
                setActivePitstopId(rec.restaurant.id);
                reset();
                setClickedNodeId(null);
              }}
            />
          ))}
          {eligible.length > 8 && (
            <span className="text-[10px] text-slate-500 font-mono shrink-0 pl-1">
              +{eligible.length - 8} more candidates
            </span>
          )}
        </div>
      )}

      {/* ── WORKSPACE BODY ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── LEFT: SVG GRAPH CANVAS ───────────────────────────────────────── */}
        <div
          className={`flex-1 flex flex-col relative overflow-hidden bg-[#040912] select-none ${
            isPanning ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Progress timeline bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-white/5 z-10">
            <div
              className="h-full bg-accent transition-all duration-300 shadow-[0_0_8px_#b8f34a]"
              style={{ width: totalSteps > 0 ? `${(animStep / totalSteps) * 100}%` : '0%' }}
            />
          </div>

          {/* Floating Canvas Controls (Play / Speed / Steps) */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2.5 bg-[#0a1324]/90 border border-white/10 rounded-2xl px-3.5 py-2 backdrop-blur-md shadow-2xl">
            <button
              onClick={() => playing ? (stopTimer(), setPlaying(false)) : startPlay()}
              className={`p-1.5 rounded-xl transition-all ${
                playing
                  ? 'bg-warning/20 text-warning hover:bg-warning/30'
                  : 'bg-success/20 text-success hover:bg-success/30'
              }`}
              title={playing ? 'Pause' : 'Play Dijkstra animation'}
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={reset}
              className="p-1.5 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-all"
              title="Restart trace"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-white/10 mx-0.5" />

            <input
              type="range" min="50" max="600" step="30" value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              className="w-20 accent-accent cursor-pointer"
              title="Animation step speed"
            />
            <span className="text-[10px] font-mono text-slate-400 w-12">{speed}ms</span>

            <div className="w-px h-4 bg-white/10 mx-0.5" />

            <span className="text-[11px] font-mono text-accent font-bold">
              Step {Math.min(animStep, totalSteps)}<span className="text-slate-500">/{totalSteps}</span>
            </span>

            {animStep > 0 && (
              <>
                <div className="w-px h-4 bg-white/10 mx-0.5" />
                <span className="text-[10px] font-mono text-slate-400">
                  {visitedSet.size}<span className="text-slate-600">/{nodes.length} visited</span>
                </span>
              </>
            )}
          </div>

          {/* Canvas Zoom & Reset Controls */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-[#0a1324]/90 border border-white/10 rounded-2xl p-1.5 backdrop-blur-md shadow-2xl">
            <button
              onClick={() => setZoom(z => Math.min(3.5, z * 1.25))}
              className="p-1.5 rounded-xl bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-all"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(z => Math.max(0.6, z / 1.25))}
              className="p-1.5 rounded-xl bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-all"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={resetView}
              className="px-2 py-1 rounded-xl bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 text-[10px] font-mono transition-all"
              title="Reset Zoom & Pan"
            >
              Reset
            </button>
          </div>

          {/* SVG Canvas */}
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="w-full h-full"
            style={{ fontFamily: 'monospace' }}
            onClick={() => setClickedNodeId(null)}
          >
            <defs>
              <pattern id="canvas-grid" width="45" height="45" patternUnits="userSpaceOnUse">
                <path d="M 45 0 L 0 0 0 45" fill="none" stroke="#0e1b2f" strokeWidth="0.8" />
              </pattern>

              {/* Filters */}
              <filter id="glow-orange" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="6" in="SourceGraphic" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-green" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="5" in="SourceGraphic" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-cyan" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="4" in="SourceGraphic" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-lime" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="4" in="SourceGraphic" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-gold" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="6" in="SourceGraphic" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>

              {/* Edge Markers */}
              <marker id="m-normal" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#1b2e4b" />
              </marker>
              <marker id="m-visited" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#3b82f6" opacity="0.6" />
              </marker>
              <marker id="m-path" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                <path d="M0,0 L0,7 L7,3.5 z" fill="#a3e635" />
              </marker>
              <marker id="m-rejoin" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#c084fc" />
              </marker>
              <marker id="m-blocked" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#ef4444" />
              </marker>
            </defs>

            {/* Background */}
            <rect width={SVG_W} height={SVG_H} fill="#040912" />
            <rect width={SVG_W} height={SVG_H} fill="url(#canvas-grid)" />

            {/* Zoom & Pan Group Container */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} transformOrigin={`${SVG_W/2} ${SVG_H/2}`}>

              {/* ── ROAD GRAPH EDGES ────────────────────────────────────────── */}
              {edges.map((e, i) => {
                const from = nodePos.get(e.from);
                const to = nodePos.get(e.to);
                if (!from || !to) return null;

                const key = `${e.from}->${e.to}`;
                const isPath = toAccessEdges.has(key);
                const isRejoin = rejoinEdges.has(key);
                const isBlocked = e.blocked;
                const isVisitedEdge = visitedSet.has(e.from) && visitedSet.has(e.to);

                let stroke = '#122238', sw = 1.2, marker = 'url(#m-normal)', opacity = 0.7, dash = '';

                if (isBlocked) {
                  stroke = '#ef4444'; sw = 1.8; dash = '5 4'; marker = 'url(#m-blocked)'; opacity = 0.75;
                } else if (isPath) {
                  stroke = '#a3e635'; sw = 3.2; marker = 'url(#m-path)'; opacity = 1;
                } else if (isRejoin) {
                  stroke = '#c084fc'; sw = 2.4; marker = 'url(#m-rejoin)'; opacity = 0.95;
                } else if (isVisitedEdge && animStep > 0) {
                  stroke = '#3b82f6'; sw = 1.4; marker = 'url(#m-visited)'; opacity = 0.55;
                } else if (e.synthetic) {
                  stroke = '#eab308'; dash = '4 3'; sw = 1.2; opacity = 0.7;
                }

                const dx = to.x - from.x, dy = to.y - from.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const ux = dx / len, uy = dy / len;
                const ex = to.x - ux * 11, ey = to.y - uy * 11;

                return (
                  <line
                    key={i}
                    x1={from.x} y1={from.y} x2={ex} y2={ey}
                    stroke={stroke} strokeWidth={sw} opacity={opacity}
                    strokeDasharray={dash} markerEnd={marker}
                    style={{ transition: 'stroke 0.3s, opacity 0.3s' }}
                  />
                );
              })}

              {/* ── ROAD GRAPH NODES ────────────────────────────────────────── */}
              {nodes.map(n => {
                const pos = nodePos.get(n.id);
                if (!pos) return null;

                const isVehicle = n.id === startId;
                const isTarget = n.id === targetId;
                const isOtherTarget = !isTarget && allTargetIds.has(n.id);
                const isBestTarget = n.id === bestTargetId;
                const inPath = pathNodeSet.has(n.id);
                const isVisiting = n.id === currentVisiting;
                const isVisited = visitedSet.has(n.id);
                const isClicked = n.id === clickedNodeId;

                let fill = '#1e293b';
                if (isVehicle) fill = '#f97316';
                else if (isTarget) fill = '#22c55e';
                else if (inPath) fill = '#a3e635';
                else if (isVisiting) fill = '#38bdf8';
                else if (isVisited) fill = '#6366f1';
                else if (isOtherTarget) fill = '#475569';
                else if (n.mainline) fill = '#1e3a5f';

                const r = isVehicle || isTarget ? 10
                  : inPath ? 8
                    : isVisiting ? 8.5
                      : isOtherTarget ? 6.5
                        : 5.5;

                const filter = isVehicle ? 'url(#glow-orange)'
                  : isTarget ? 'url(#glow-green)'
                    : isVisiting ? 'url(#glow-cyan)'
                      : isBestTarget ? 'url(#glow-gold)'
                        : inPath ? 'url(#glow-lime)'
                          : 'none';

                return (
                  <g
                    key={n.id}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setClickedNodeId(n.id);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Outer animated ripple on key vertices */}
                    {(isVehicle || isTarget || isVisiting) && (
                      <circle
                        cx={pos.x} cy={pos.y} r={r + 5}
                        fill="none"
                        stroke={isVehicle ? '#f97316' : isTarget ? '#22c55e' : '#38bdf8'}
                        strokeWidth={1.5}
                        opacity={0.4}
                      />
                    )}

                    {/* Gold dashed halo for #1 best recommended pitstop */}
                    {isBestTarget && !isTarget && (
                      <circle
                        cx={pos.x} cy={pos.y} r={r + 8}
                        fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="4 2"
                        opacity={0.7}
                      />
                    )}

                    {/* Active Click Selection Ring */}
                    {isClicked && (
                      <circle
                        cx={pos.x} cy={pos.y} r={r + 9}
                        fill="none" stroke="#ffffff" strokeWidth={2}
                        opacity={0.9}
                      />
                    )}

                    {/* Node Circle */}
                    <circle
                      cx={pos.x} cy={pos.y} r={r}
                      fill={fill} stroke="#050b14" strokeWidth={1.5}
                      filter={filter}
                      style={{ transition: 'fill 0.3s, r 0.2s' }}
                    />

                    {/* Only clean functional emoji icons — NO text labels near nodes */}
                    {isVehicle && (
                      <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize="9" style={{ pointerEvents: 'none' }}>🚗</text>
                    )}
                    {isTarget && !isVehicle && (
                      <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize="10" style={{ pointerEvents: 'none' }}>🍽</text>
                    )}
                  </g>
                );
              })}

            </g>
          </svg>

          {/* Canvas Bottom Legend Bar */}
          <div className="absolute bottom-3 left-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-mono text-slate-400 bg-[#080f1e]/80 border border-white/10 px-3.5 py-1.5 rounded-xl backdrop-blur-sm pointer-events-none select-none">
            {[
              { c: '#f97316', l: 'Vehicle' },
              { c: '#22c55e', l: 'Selected Pitstop' },
              { c: '#a3e635', l: 'Optimal Path' },
              { c: '#c084fc', l: 'Rejoin Highway' },
              { c: '#38bdf8', l: 'Dijkstra Frontier' },
              { c: '#6366f1', l: 'Explored Nodes' },
              { c: '#475569', l: 'Other Candidates' },
              { c: '#ef4444', l: 'Blocked / Barrier' },
            ].map(({ c, l }) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-sm" style={{ background: c }} />
                <span>{l}</span>
              </span>
            ))}
            <span className="text-accent font-semibold ml-1">💡 Click any node to inspect</span>
          </div>
        </div>

        {/* ── RIGHT: TABBED INSPECTION & STATS PANEL ────────────────────────── */}
        <div className="w-84 lg:w-96 shrink-0 flex flex-col bg-[#070e1b] border-l border-white/10 overflow-hidden text-xs">

          {/* Inspection Drawer Card (If a node is clicked) */}
          {clickedNode && (
            <div className="p-4 border-b border-white/10 bg-accent/10 space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">
                    {clickedNodeRole === 'vehicle' ? '🚗' : clickedNodeRole === 'target' ? '🍽' : clickedNodeRole === 'path' ? '📍' : '⬤'}
                  </span>
                  <div>
                    <div className="text-xs font-black text-white">{cleanNodeName(clickedNode.id)}</div>
                    <div className="text-[10px] font-mono text-accent">
                      {clickedNodeRole === 'vehicle' ? 'Journey Start Node'
                        : clickedNodeRole === 'target' ? 'Pitstop Entrance Node'
                        : clickedNodeRole === 'path' ? 'Optimal Path Vertex'
                        : clickedNode.mainline ? 'Highway Mainline Junction'
                        : 'Road Network Vertex'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setClickedNodeId(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div className="bg-black/30 p-2 rounded-xl">
                  <div className="text-[9px] text-slate-400">Dijkstra Shortest Dist</div>
                  <div className="text-xs font-mono font-black text-white mt-0.5">
                    {clickedNodeDist !== undefined ? fmtDist(clickedNodeDist) : 'Not reachable'}
                  </div>
                </div>
                <div className="bg-black/30 p-2 rounded-xl">
                  <div className="text-[9px] text-slate-400">Extraction Step</div>
                  <div className="text-xs font-mono font-black text-white mt-0.5">
                    {clickedNodeStep !== undefined && clickedNodeStep >= 0 ? `#${clickedNodeStep + 1}` : '—'}
                  </div>
                </div>
              </div>

              {clickedNodeRole === 'target' && activeRec && (
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] space-y-1">
                  <div className="font-bold text-white">{activeRec.restaurant.name}</div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Rank: <strong className="text-white">#{activeRec.rank}</strong></span>
                    <span>Score: <strong className="text-accent">{activeRec.finalScore}/100</strong></span>
                    <span>Access: <strong className={accessConfig.colorClass}>{currentAccessClass}</strong></span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab Navigation Header */}
          <div className="flex border-b border-white/10 bg-[#060c18] shrink-0">
            {[
              { id: 'analysis', label: 'Score & Why Won', icon: Trophy },
              { id: 'log', label: `Visit Log (${visitedSet.size})`, icon: GitBranch },
              { id: 'overview', label: 'Route Overview', icon: Navigation },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-3 px-2 text-center text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 border-b-2 ${
                    isActive
                      ? 'border-accent text-accent bg-accent/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: Analysis & Scores */}
          {activeTab === 'analysis' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* Why #1 Won Box */}
              {bestRec && (
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-yellow-400" />
                      <span className="font-extrabold text-white text-xs">Why #{bestRec.rank} Ranked Top</span>
                    </div>
                    <span className="text-xs font-mono font-black text-accent">{bestRec.finalScore}/100</span>
                  </div>

                  <div className="text-[11px] font-bold text-slate-200">
                    {bestRec.restaurant.name}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-black/30 p-2 rounded-xl">
                      <div className="text-[9px] text-slate-400">Extra Detour</div>
                      <div className="text-xs font-mono font-bold text-white mt-0.5">
                        +{Math.round((bestRec.detourResult?.detourDurationSeconds || 0) / 60)} min
                      </div>
                    </div>
                    <div className="bg-black/30 p-2 rounded-xl">
                      <div className="text-[9px] text-slate-400">Detour Dist</div>
                      <div className="text-xs font-mono font-bold text-white mt-0.5">
                        {((bestRec.detourResult?.detourDistanceMeters || 0) / 1000).toFixed(1)} km
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="text-[9px] uppercase tracking-wider text-slate-400 font-mono">Top Driving Factors:</div>
                    {whyBest.map(f => (
                      <div key={f.key} className="flex items-center justify-between text-[10px]">
                        <span style={{ color: f.color }}>▸ {f.label}</span>
                        <span className="font-mono font-bold text-white">{f.val}/100</span>
                      </div>
                    ))}
                  </div>

                  {bestRec.explanation && (
                    <p className="text-[10px] text-slate-400 leading-relaxed italic border-t border-white/5 pt-2">
                      "{bestRec.explanation}"
                    </p>
                  )}
                </div>
              )}

              {/* Active Pitstop Breakdown */}
              {activeRec && (
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-cyan-400" />
                      <span className="font-extrabold text-white text-xs">Score Breakdown</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">#{activeRec.rank} Candidate</span>
                  </div>

                  <div className="space-y-2.5">
                    {scoreFactors.map(f => (
                      <ScoreBar
                        key={f.key}
                        label={f.label}
                        value={sc[f.key] ?? 0}
                        color={f.color}
                        weight={f.weight}
                      />
                    ))}
                  </div>

                  {/* Accessibility Badge Callout */}
                  <div className="pt-2 border-t border-white/10 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Road Accessibility:</span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${accessConfig.bgClass}`}>
                        {currentAccessClass}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      {accessConfig.description}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Traversal Visit Log */}
          {activeTab === 'log' && (
            <div className="flex-1 flex flex-col min-h-0 p-4">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <span className="text-[11px] font-mono text-slate-400">Heap Extraction Sequence</span>
                <span className="text-[10px] font-mono text-accent">{visitedSet.size} visited</span>
              </div>

              {trace ? (
                <div
                  ref={stepListRef}
                  className="flex-1 overflow-y-auto rounded-xl bg-black/40 border border-white/5 p-1.5 space-y-1"
                >
                  {trace.visitOrder.map((nId, idx) => {
                    const isCurrent = idx === animStep - 1;
                    const isPast = idx < animStep;
                    const isFinal = trace.finalPath.includes(nId);
                    const isClicked = clickedNodeId === nId;
                    const d = trace.dist.get(nId);

                    return (
                      <button
                        key={idx}
                        data-step={idx}
                        onClick={() => setClickedNodeId(nId)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left font-mono text-[10px] transition-all ${
                          isClicked
                            ? 'bg-accent/25 text-accent border border-accent/40'
                            : isCurrent
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : isFinal && isPast
                            ? 'bg-lime-500/15 text-lime-300'
                            : isPast
                            ? 'text-slate-300 hover:bg-white/5'
                            : 'text-slate-600'
                        }`}
                      >
                        <span className="w-5 text-slate-500 text-right shrink-0">{idx + 1}.</span>
                        <span className="truncate flex-1">{cleanNodeName(nId)}</span>
                        {d !== undefined && isPast && (
                          <span className="text-slate-400 shrink-0 text-[9px]">{fmtDist(d)}</span>
                        )}
                        {isFinal && isPast && <span className="text-lime-400 shrink-0 font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-slate-500 text-xs italic">
                  No trace loaded. Select a pitstop tab above.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Journey Overview & Rules */}
          {activeTab === 'overview' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-accent" />
                  <span className="font-extrabold text-white text-xs">Journey Parameters</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-black/30 p-2.5 rounded-xl">
                    <div className="text-[9px] text-slate-400">Total Route Distance</div>
                    <div className="text-sm font-mono font-bold text-white mt-0.5">
                      {route ? `${(route.totalDistanceMeters / 1000).toFixed(1)} km` : '—'}
                    </div>
                  </div>
                  <div className="bg-black/30 p-2.5 rounded-xl">
                    <div className="text-[9px] text-slate-400">Estimated Duration</div>
                    <div className="text-sm font-mono font-bold text-white mt-0.5">
                      {route ? `${Math.round((route.totalDurationSeconds || 0) / 60)} min` : '—'}
                    </div>
                  </div>
                </div>

                {vehicleHeading && (
                  <div className="bg-black/30 p-2.5 rounded-xl flex items-center justify-around text-center">
                    <div>
                      <div className="text-[9px] text-slate-400">Compass</div>
                      <div className="text-xs font-mono font-bold text-white mt-0.5">{vehicleHeading.compass}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400">Bearing</div>
                      <div className="text-xs font-mono font-bold text-accent mt-0.5">{vehicleHeading.degrees}°</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400">Vehicle at KM</div>
                      <div className="text-xs font-mono font-bold text-white mt-0.5">
                        {Math.round((vehicleHeading.progressMeters || 0) / 1000)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Maneuver Penalties Card */}
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-accent" />
                  <span>Deterministic Penalties (No AI/ML)</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Turn impedance costs added directly into edge weights for physical highway safety:
                </p>
                <div className="space-y-1 text-[10px] font-mono text-slate-300">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span>U-Turn / Median Crossover:</span>
                    <strong className="text-danger">+240 seconds</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span>Cross-Traffic Left Turn:</span>
                    <strong className="text-warning">+45 seconds</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Direct Right Slip Turn:</span>
                    <strong className="text-success">+15 seconds</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── FOOTER STATUS BAR ──────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-5 py-2 bg-[#060c18] border-t border-white/10 text-[10px] font-mono text-slate-400">
        <span>
          Algorithm: <strong className="text-white">Dijkstra with Binary Min-Heap</strong> ·
          Complexity: <strong className="text-accent">O((V + E) log V)</strong> ·
          Directed graph with barrier constraints
        </span>
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-slate-300">100% Deterministic · Zero AI/ML</span>
        </span>
      </div>
    </div>
  );
}
