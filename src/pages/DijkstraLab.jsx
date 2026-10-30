import React, { useState, useMemo, useCallback } from 'react';
import { Network, Play, ArrowRight, AlertTriangle, CheckCircle2, RotateCcw, Zap } from 'lucide-react';
import demoSeedData from '../data/mumbaiPuneSeed.json';
import { RoadNetworkGraph, dijkstra, MANEUVER_PENALTIES } from '../engine/shortestPath.js';

/**
 * Build the real Mumbai-Pune road graph from the seed data.
 */
function buildGraph() {
  const graph = new RoadNetworkGraph();
  for (const node of demoSeedData.roadGraph.nodes) {
    graph.addNode(node.id, node.location, node.name);
  }
  for (const edge of demoSeedData.roadGraph.edges) {
    graph.addEdge(edge.from, edge.to, {
      distanceMeters: edge.distanceMeters,
      durationSeconds: edge.durationSeconds,
      speedKmh: edge.speedKmh,
      isTurn: !!edge.isTurn,
      isUTurn: !!edge.isUTurn,
      hasMedianBarrier: !!edge.hasMedianBarrier,
      isForbidden: !!edge.isForbidden
    });
  }
  return graph;
}

const GRAPH = buildGraph();

const HIGHWAY_NODES = demoSeedData.roadGraph.nodes.filter(n => n.id.startsWith('NODE_'));
const RESTAURANT_NODES = demoSeedData.roadGraph.nodes.filter(n => n.id.startsWith('REST_'));
const ALL_NODES = demoSeedData.roadGraph.nodes;

/** Preset scenarios that demonstrate interesting Dijkstra behaviors */
const PRESETS = [
  {
    label: '🟢 Direct Access (Khalapur Food Court)',
    from: 'NODE_KALAMBOLI',
    to: 'REST_01_RAMP',
    desc: 'Straight off-ramp, no turns, GREEN access'
  },
  {
    label: '🔴 Blocked by Median (Opposite Dhaba)',
    from: 'NODE_KHALAPUR_HWY',
    to: 'REST_02_MEDIAN',
    desc: 'Concrete divider blocks path — Dijkstra returns null (unreachable)'
  },
  {
    label: '🟡 U-Turn Required (Lonavala Ghat)',
    from: 'NODE_LONAVALA_HWY',
    to: 'REST_03_OVERPASS',
    desc: 'Needs an interchange loop via U-turn overpass (+240s penalty)'
  },
  {
    label: '📏 Long Detour (Khopoli Heritage Inn)',
    from: 'NODE_KHOPOLI_HWY',
    to: 'REST_04_VALLEY',
    desc: '1700m off the highway through a valley road'
  },
  {
    label: '🚀 Full Highway Traverse',
    from: 'NODE_MUMBAI_START',
    to: 'NODE_PUNE_END',
    desc: 'Calculates shortest path across entire expressway'
  }
];

/**
 * /dijkstra-lab — Interactive Dijkstra Algorithm Visualizer
 * Uses the actual Mumbai-Pune highway road graph to demonstrate
 * shortest path, turn penalties, U-turn costs, and median barriers.
 */
export function DijkstraLab() {
  const [fromNode, setFromNode] = useState('NODE_KALAMBOLI');
  const [toNode, setToNode] = useState('REST_01_RAMP');
  const [allowUTurns, setAllowUTurns] = useState(true);
  const [uTurnPenalty, setUTurnPenalty] = useState(MANEUVER_PENALTIES.U_TURN_PENALTY_SECONDS);
  const [turnPenalty, setTurnPenalty] = useState(MANEUVER_PENALTIES.LEFT_TURN_PENALTY_SECONDS);
  const [runCount, setRunCount] = useState(0);
  const [executionTimeMs, setExecutionTimeMs] = useState(0);

  // Run Dijkstra with timing
  const result = useMemo(() => {
    const t0 = performance.now();
    const res = dijkstra(GRAPH, fromNode, toNode, {
      allowUTurns,
      uTurnPenaltySeconds: uTurnPenalty,
      turnPenaltySeconds: turnPenalty
    });
    const t1 = performance.now();
    setExecutionTimeMs(Math.round((t1 - t0) * 100) / 100);
    return res;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromNode, toNode, allowUTurns, uTurnPenalty, turnPenalty, runCount]);

  const loadPreset = useCallback((preset) => {
    setFromNode(preset.from);
    setToNode(preset.to);
    setRunCount(c => c + 1);
  }, []);

  const fromNodeData = GRAPH.nodes.get(fromNode);
  const toNodeData = GRAPH.nodes.get(toNode);

  // Build edge list for the found path to show step-by-step traversal
  const pathEdges = useMemo(() => {
    if (!result?.path || result.path.length < 2) return [];
    const edges = [];
    for (let i = 0; i < result.path.length - 1; i++) {
      const from = result.path[i];
      const to = result.path[i + 1];
      const adjEdges = GRAPH.adjacencyList.get(from) || [];
      const edge = adjEdges.find(e => e.to === to);
      const fromData = GRAPH.nodes.get(from);
      const toData = GRAPH.nodes.get(to);
      edges.push({
        step: i + 1,
        from,
        to,
        fromName: fromData?.name || from,
        toName: toData?.name || to,
        distance: edge?.distanceMeters || 0,
        duration: edge?.durationSeconds || 0,
        isUTurn: edge?.isUTurn || false,
        isTurn: edge?.isTurn || false,
        isForbidden: edge?.isForbidden || false,
        hasMedianBarrier: edge?.hasMedianBarrier || false
      });
    }
    return edges;
  }, [result]);

  return (
    <div className="p-4 lg:p-5 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-card/70 border border-borderSubtle rounded-2xl p-5 backdrop-blur-md space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="p-2 rounded-xl bg-accent/15 text-accent border border-accent/30 font-mono font-bold text-xs">
            DIJKSTRA ALGORITHM LAB
          </span>
          <span className="text-xs font-mono text-muted bg-secondary px-2.5 py-1 rounded-lg border border-borderSubtle">
            {ALL_NODES.length} Vertices • {demoSeedData.roadGraph.edges.length} Directed Edges
          </span>
          <span className="text-xs font-mono text-success bg-success/10 px-2.5 py-1 rounded-lg border border-success/30">
            Zero AI/ML • Pure Graph Theory
          </span>
        </div>
        <h1 className="text-xl font-black text-textMain tracking-tight">
          Interactive Shortest Path on Mumbai–Pune Highway Graph
        </h1>
        <p className="text-xs text-muted max-w-3xl leading-relaxed">
          Select any two nodes from the real highway road graph. Dijkstra's algorithm finds the shortest path
          respecting one-way edges, median barriers, turn penalties, and U-turn costs. Watch each step of the traversal.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
        {/* LEFT: Controls */}
        <div className="space-y-4">
          {/* Preset Scenarios */}
          <div className="bg-card border border-borderSubtle rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center gap-2 border-b border-borderSubtle pb-2">
              <Zap className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-bold text-textMain">Quick Demo Presets</h3>
            </div>
            <div className="space-y-2">
              {PRESETS.map((preset, i) => (
                <button
                  key={i}
                  onClick={() => loadPreset(preset)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all border cursor-pointer ${
                    fromNode === preset.from && toNode === preset.to
                      ? 'bg-accent/15 border-accent/40 text-accent'
                      : 'bg-secondary border-borderSubtle text-textMain hover:bg-card hover:border-accent/30'
                  }`}
                >
                  <div className="font-bold">{preset.label}</div>
                  <div className="text-[10px] text-muted mt-0.5">{preset.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Node Selectors */}
          <div className="bg-card border border-borderSubtle rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center gap-2 border-b border-borderSubtle pb-2">
              <Network className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-bold text-textMain">Graph Traversal Parameters</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-muted font-medium block mb-1">Source Node (Vehicle)</label>
                <select
                  value={fromNode}
                  onChange={(e) => setFromNode(e.target.value)}
                  className="w-full bg-secondary border border-borderSubtle rounded-xl px-2 py-1.5 text-[11px] font-mono text-textMain focus:outline-none focus:border-accent"
                >
                  <optgroup label="Highway Mainline Nodes">
                    {HIGHWAY_NODES.map(n => (
                      <option key={n.id} value={n.id}>{n.id} — {n.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Restaurant Entry Nodes">
                    {RESTAURANT_NODES.map(n => (
                      <option key={n.id} value={n.id}>{n.id} — {n.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-muted font-medium block mb-1">Destination Node (Restaurant)</label>
                <select
                  value={toNode}
                  onChange={(e) => setToNode(e.target.value)}
                  className="w-full bg-secondary border border-borderSubtle rounded-xl px-2 py-1.5 text-[11px] font-mono text-textMain focus:outline-none focus:border-accent"
                >
                  <optgroup label="Restaurant Entry Nodes">
                    {RESTAURANT_NODES.map(n => (
                      <option key={n.id} value={n.id}>{n.id} — {n.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Highway Mainline Nodes">
                    {HIGHWAY_NODES.map(n => (
                      <option key={n.id} value={n.id}>{n.id} — {n.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Penalty Tuning */}
            <div className="space-y-2 pt-2 border-t border-borderSubtle">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-textMain">
                <input
                  type="checkbox"
                  checked={allowUTurns}
                  onChange={(e) => setAllowUTurns(e.target.checked)}
                  className="rounded bg-secondary text-accent"
                />
                <span>Allow U-Turns (Legal interchange loops)</span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-[11px] text-muted mb-1">
                    <span>U-Turn Penalty</span>
                    <span className="font-mono text-accent">{uTurnPenalty}s ({(uTurnPenalty / 60).toFixed(1)} min)</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="600"
                    step="30"
                    value={uTurnPenalty}
                    onChange={(e) => setUTurnPenalty(Number(e.target.value))}
                    className="w-full h-1.5 bg-secondary rounded-lg accent-accent cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-muted mb-1">
                    <span>Turn Penalty</span>
                    <span className="font-mono text-accent">{turnPenalty}s</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="120"
                    step="5"
                    value={turnPenalty}
                    onChange={(e) => setTurnPenalty(Number(e.target.value))}
                    className="w-full h-1.5 bg-secondary rounded-lg accent-accent cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Run Button */}
            <button
              onClick={() => setRunCount(c => c + 1)}
              className="w-full py-2.5 rounded-xl bg-accent text-background font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-accentHover transition-all shadow-glow-accent cursor-pointer"
            >
              <Play className="w-4 h-4" />
              <span>Run Dijkstra</span>
            </button>
          </div>
        </div>

        {/* RIGHT: Results */}
        <div className="space-y-4">
          {/* Summary Card */}
          <div className={`bg-card border rounded-2xl p-4 shadow-xl space-y-3 ${
            result ? 'border-success/40' : 'border-danger/40'
          }`}>
            <div className="flex items-center justify-between border-b border-borderSubtle pb-2">
              <div className="flex items-center gap-2">
                {result ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-danger" />
                )}
                <h3 className="text-sm font-bold text-textMain">
                  {result ? 'Path Found' : 'No Path (Unreachable)'}
                </h3>
              </div>
              <span className="text-[10px] font-mono text-muted bg-secondary px-2 py-0.5 rounded-lg border border-borderSubtle">
                Executed in {executionTimeMs} ms
              </span>
            </div>

            {result ? (
              <div className="space-y-2.5">
                {/* Key metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-secondary p-3 rounded-xl border border-borderSubtle text-center">
                    <div className="text-[10px] text-muted font-mono uppercase">Total Distance</div>
                    <div className="text-lg font-black text-accent font-mono">
                      {result.distance >= 1000 ? `${(result.distance / 1000).toFixed(1)} km` : `${result.distance} m`}
                    </div>
                  </div>
                  <div className="bg-secondary p-3 rounded-xl border border-borderSubtle text-center">
                    <div className="text-[10px] text-muted font-mono uppercase">Total Duration</div>
                    <div className="text-lg font-black text-accent font-mono">
                      {result.time >= 60 ? `${(result.time / 60).toFixed(1)} min` : `${result.time}s`}
                    </div>
                  </div>
                  <div className="bg-secondary p-3 rounded-xl border border-borderSubtle text-center">
                    <div className="text-[10px] text-muted font-mono uppercase">U-Turns</div>
                    <div className={`text-lg font-black font-mono ${result.uTurns > 0 ? 'text-warning' : 'text-success'}`}>
                      {result.uTurns}
                      {result.uTurns > 0 && <span className="text-[10px] text-muted ml-1">(+{result.uTurns * uTurnPenalty}s)</span>}
                    </div>
                  </div>
                  <div className="bg-secondary p-3 rounded-xl border border-borderSubtle text-center">
                    <div className="text-[10px] text-muted font-mono uppercase">Turns</div>
                    <div className={`text-lg font-black font-mono ${result.turns > 2 ? 'text-warning' : 'text-success'}`}>
                      {result.turns}
                      {result.turns > 0 && <span className="text-[10px] text-muted ml-1">(+{result.turns * turnPenalty}s)</span>}
                    </div>
                  </div>
                </div>

                {/* Node path summary */}
                <div className="bg-secondary p-3 rounded-xl border border-borderSubtle">
                  <div className="text-[10px] text-muted font-mono uppercase mb-2">
                    Shortest Path ({result.path.length} nodes)
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {result.path.map((nodeId, i) => (
                      <React.Fragment key={i}>
                        <span className={`px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold border ${
                          nodeId.startsWith('REST_')
                            ? 'bg-accent/15 text-accent border-accent/30'
                            : nodeId.startsWith('NODE_')
                              ? 'bg-success/10 text-success border-success/30'
                              : 'bg-secondary text-textMain border-borderSubtle'
                        }`}>
                          {nodeId}
                        </span>
                        {i < result.path.length - 1 && (
                          <ArrowRight className="w-3 h-3 text-muted shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 space-y-2">
                <p className="text-xs text-danger font-bold">
                  Dijkstra returned null — no valid path exists between these nodes.
                </p>
                <p className="text-[11px] text-muted leading-relaxed">
                  This happens when the destination is across a concrete median barrier with no legal crossing,
                  or when all connecting edges are marked as forbidden / one-way in the wrong direction.
                  This is how WayDine classifies restaurants as <strong className="text-danger">RED (Inaccessible)</strong>.
                </p>
              </div>
            )}
          </div>

          {/* Step-by-Step Edge Traversal Table */}
          {pathEdges.length > 0 && (
            <div className="bg-card border border-borderSubtle rounded-2xl p-4 shadow-xl space-y-3">
              <div className="flex items-center gap-2 border-b border-borderSubtle pb-2">
                <ArrowRight className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-bold text-textMain">Step-by-Step Edge Traversal</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-borderSubtle text-muted font-mono uppercase text-[10px]">
                      <th className="text-left py-2 px-2">Step</th>
                      <th className="text-left py-2 px-2">From</th>
                      <th className="text-left py-2 px-2">To</th>
                      <th className="text-right py-2 px-2">Distance</th>
                      <th className="text-right py-2 px-2">Time</th>
                      <th className="text-center py-2 px-2">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pathEdges.map((edge) => (
                      <tr key={edge.step} className="border-b border-borderSubtle/50 hover:bg-secondary/50 transition-colors">
                        <td className="py-2 px-2 font-mono font-bold text-accent">{edge.step}</td>
                        <td className="py-2 px-2">
                          <div className="font-mono font-bold text-textMain text-[10px]">{edge.from}</div>
                          <div className="text-[9px] text-muted truncate max-w-[140px]">{edge.fromName}</div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="font-mono font-bold text-textMain text-[10px]">{edge.to}</div>
                          <div className="text-[9px] text-muted truncate max-w-[140px]">{edge.toName}</div>
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {edge.distance >= 1000 ? `${(edge.distance / 1000).toFixed(1)} km` : `${edge.distance} m`}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {edge.duration}s
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {edge.isUTurn && (
                              <span className="px-1.5 py-0.5 rounded bg-warning/20 text-warning font-mono font-bold text-[9px]">
                                U-TURN +{uTurnPenalty}s
                              </span>
                            )}
                            {edge.isTurn && !edge.isUTurn && (
                              <span className="px-1.5 py-0.5 rounded bg-accent/20 text-accent font-mono font-bold text-[9px]">
                                TURN +{turnPenalty}s
                              </span>
                            )}
                            {edge.hasMedianBarrier && (
                              <span className="px-1.5 py-0.5 rounded bg-danger/20 text-danger font-mono font-bold text-[9px]">
                                BARRIER
                              </span>
                            )}
                            {!edge.isUTurn && !edge.isTurn && !edge.hasMedianBarrier && (
                              <span className="text-muted text-[9px]">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-accent/30 font-bold">
                      <td colSpan={3} className="py-2 px-2 text-accent font-mono text-[10px]">TOTAL</td>
                      <td className="py-2 px-2 text-right font-mono text-accent">
                        {result?.distance >= 1000 ? `${(result.distance / 1000).toFixed(1)} km` : `${result?.distance} m`}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-accent">
                        {result?.time >= 60 ? `${(result.time / 60).toFixed(1)} min` : `${result?.time}s`}
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-[10px]">
                        <span className="text-warning">{result?.uTurns || 0} U</span> / <span className="text-accent">{result?.turns || 0} T</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Algorithm Explanation */}
          <div className="bg-card border border-borderSubtle rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center gap-2 border-b border-borderSubtle pb-2">
              <RotateCcw className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-bold text-textMain">How Dijkstra Works Here</h3>
            </div>
            <div className="text-xs text-muted space-y-2 leading-relaxed">
              <p>
                <strong className="text-textMain">1. Priority Queue (Binary Min-Heap):</strong> Nodes are explored in order of lowest cumulative travel time. O((V + E) log V) complexity.
              </p>
              <p>
                <strong className="text-textMain">2. Directed Edges:</strong> Each road segment is one-way (Pune-bound). Edges marked <code className="text-danger">isForbidden</code> or <code className="text-danger">hasMedianBarrier</code> are never traversed.
              </p>
              <p>
                <strong className="text-textMain">3. Turn Penalties:</strong> U-turns add +{uTurnPenalty}s, regular turns add +{turnPenalty}s to the edge cost, making turn-heavy paths score worse than straight off-ramp exits.
              </p>
              <p>
                <strong className="text-textMain">4. Path Reconstruction:</strong> After reaching the destination, the algorithm backtracks through the <code className="text-accent">previous</code> map to reconstruct the exact sequence of nodes traversed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
