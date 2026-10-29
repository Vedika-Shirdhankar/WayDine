import React, { useState, useMemo } from 'react';
import { Navbar } from '../components/Navbar.jsx';
import { getRoadGraph } from '../data/restaurantRepository.js';
import { dijkstraShortestPath, MANEUVER_PENALTIES } from '../engine/shortestPath.js';
import roadGraphSeed from '../data/roadNetworkGraph.json';
import { Network, ArrowRight, ShieldAlert, CheckCircle, Navigation, Layers } from 'lucide-react';

export function RoadGraphViewer() {
  const graph = useMemo(() => getRoadGraph(), []);

  const [fromNodeId, setFromNodeId] = useState('HWY-US101-414');
  const [toNodeId, setToNodeId] = useState('FRONTAGE-414B');
  const [allowUTurns, setAllowUTurns] = useState(true);

  const pathResult = useMemo(() => {
    try {
      return dijkstraShortestPath(graph, fromNodeId, toNodeId, { allowUTurns });
    } catch (err) {
      return null;
    }
  }, [graph, fromNodeId, toNodeId, allowUTurns]);

  const nodes = roadGraphSeed.nodes;
  const edges = roadGraphSeed.edges;

  return (
    <div className="min-h-screen flex flex-col bg-background text-textMain">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="bg-card/70 border border-borderSubtle rounded-2xl p-6 backdrop-blur-md space-y-2">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-accent/15 text-accent border border-accent/30 font-mono font-bold text-xs">
              ROAD TOPOLOGY INSPECTOR
            </span>
            <span className="text-xs font-mono text-muted bg-secondary px-2.5 py-1 rounded-lg border border-borderSubtle">
              Hard Rule: Never claim accessible without road-graph support
            </span>
          </div>
          <h1 className="text-2xl font-black text-textMain tracking-tight">
            Verified Road Network Topology & Graph Traversal
          </h1>
          <p className="text-xs text-muted max-w-3xl leading-relaxed">
            Inspect the directed highway and service road topology. WayDine runs Dijkstra's algorithm over this exact graph to calculate physical off-ramp detours, turn penalties, and U-turns.
          </p>
        </div>

        {/* Live Dijkstra Graph Traversal Tester */}
        <div className="bg-card border border-borderSubtle rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-borderSubtle pb-3">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-bold text-textMain">Interactive Dijkstra Traversal Tester</h3>
            </div>
            <span className="text-[11px] font-mono text-muted">
              {nodes.length} Vertices • {edges.length} Directed Edges
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-xs text-muted font-medium block mb-1.5">Origin Node (Start)</label>
              <select
                value={fromNodeId}
                onChange={(e) => setFromNodeId(e.target.value)}
                className="w-full bg-secondary border border-borderSubtle rounded-xl px-3 py-2 text-xs font-mono text-textMain focus:outline-none focus:border-accent"
              >
                {nodes.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.id} ({n.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted font-medium block mb-1.5">Destination Node (Target)</label>
              <select
                value={toNodeId}
                onChange={(e) => setToNodeId(e.target.value)}
                className="w-full bg-secondary border border-borderSubtle rounded-xl px-3 py-2 text-xs font-mono text-textMain focus:outline-none focus:border-accent"
              >
                {nodes.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.id} ({n.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-textMain select-none pb-2">
                <input
                  type="checkbox"
                  checked={allowUTurns}
                  onChange={(e) => setAllowUTurns(e.target.checked)}
                  className="rounded bg-secondary text-accent"
                />
                <span>Allow U-Turns in Dijkstra</span>
              </label>
            </div>
          </div>

          {/* Path Result Display */}
          <div className="bg-secondary p-4 rounded-xl border border-borderSubtle space-y-3 font-mono text-xs">
            {pathResult ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borderSubtle/60 pb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span className="font-bold text-success">Path Found via Road Graph</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted text-[11px]">
                    <span>Distance: <strong className="text-textMain">{pathResult.distanceMeters} m</strong></span>
                    <span>Duration: <strong className="text-accent">{Math.round(pathResult.durationSeconds)} s</strong> ({Math.round(pathResult.durationSeconds / 60)} min)</span>
                    <span>U-Turns: <strong className={pathResult.uTurnCount > 0 ? 'text-danger' : 'text-success'}>{pathResult.uTurnCount}</strong></span>
                    <span>Turns: <strong className="text-textMain">{pathResult.turnCount}</strong></span>
                  </div>
                </div>

                <div>
                  <span className="text-muted block text-[10px] mb-1">Traversed Sequence:</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {pathResult.pathNodeIds.map((nodeId, idx) => (
                      <React.Fragment key={nodeId}>
                        <span className="px-2 py-1 rounded bg-card border border-borderSubtle text-textMain font-bold">
                          {nodeId}
                        </span>
                        {idx < pathResult.pathNodeIds.length - 1 && (
                          <ArrowRight className="w-3 h-3 text-accent" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-danger">
                <ShieldAlert className="w-4 h-4" />
                <span>No legal path exists between selected nodes (median barrier or one-way road prevents access).</span>
              </div>
            )}
          </div>
        </div>

        {/* Graph Vertices and Edges Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Nodes Table */}
          <div className="bg-card border border-borderSubtle rounded-2xl p-4 space-y-3 shadow-xl">
            <h4 className="text-xs font-bold text-textMain uppercase tracking-wider font-mono flex items-center gap-2">
              <Navigation className="w-3.5 h-3.5 text-accent" />
              <span>Graph Vertices ({nodes.length})</span>
            </h4>
            <div className="max-h-72 overflow-y-auto space-y-1.5 font-mono text-[11px]">
              {nodes.map(n => (
                <div key={n.id} className="p-2 rounded-lg bg-secondary flex items-center justify-between border border-borderSubtle">
                  <div>
                    <span className="font-bold text-textMain block">{n.id}</span>
                    <span className="text-muted text-[10px]">{n.name}</span>
                  </div>
                  <span className="text-muted text-[10px]">[{n.location[0].toFixed(3)}, {n.location[1].toFixed(3)}]</span>
                </div>
              ))}
            </div>
          </div>

          {/* Edges Table */}
          <div className="bg-card border border-borderSubtle rounded-2xl p-4 space-y-3 shadow-xl">
            <h4 className="text-xs font-bold text-textMain uppercase tracking-wider font-mono flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-accent" />
              <span>Directed Edges ({edges.length})</span>
            </h4>
            <div className="max-h-72 overflow-y-auto space-y-1.5 font-mono text-[11px]">
              {edges.map((e, i) => (
                <div key={i} className="p-2 rounded-lg bg-secondary flex items-center justify-between border border-borderSubtle">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-textMain">{e.from}</span>
                    <ArrowRight className="w-3 h-3 text-accent" />
                    <span className="font-bold text-textMain">{e.to}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-muted">{e.distanceMeters}m</span>
                    {e.hasMedianBarrier && (
                      <span className="px-1 py-0.2 rounded bg-danger/20 text-danger font-bold">Barrier</span>
                    )}
                    {e.isUTurn && (
                      <span className="px-1 py-0.2 rounded bg-warning/20 text-warning font-bold">U-Turn</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
