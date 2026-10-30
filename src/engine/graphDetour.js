/**
 * @file graphDetour.js
 * Graph-driven access + detour computation.
 *
 * Nothing here is looked up from a hardcoded table. Everything is derived from the road graph:
 *  - "mainline" nodes are found structurally (nodes touching a long highway link that are not ramps),
 *  - the vehicle is snapped to the last mainline node it has passed,
 *  - a restaurant with no mapped ramp gets an INFERRED access road (clearly flagged as synthetic),
 *  - detour = d(vehicle -> access) + d(access -> rejoin) - d(vehicle -> rejoin), all from Dijkstra,
 *  - the rejoin node is always a MAINLINE node downstream of the ramp, so the baseline is the real
 *    "keep driving on the highway" path (not a path that goes through the restaurant itself),
 *  - ETA comes from graph travel time to the restaurant, not from the vehicle's position.
 *
 * Complexity: one Dijkstra from the vehicle + one per DISTINCT access node
 * (cached), instead of three Dijkstra runs per restaurant.
 */

import { haversine, progressAlongRoute, findNearestPointOnPolyline } from './geoUtils.js';
import { dijkstraFrom, MANEUVER_PENALTIES } from './shortestPath.js';
import { classifyAccessibility, classifyDetour } from './detourCalculator.js';

/** A graph edge at least this long is treated as a highway link (=> its endpoints are mainline nodes). */
export const MAINLINE_EDGE_METERS = 5000;
/** Longest inferred access road we are willing to invent; beyond this the restaurant is UNVERIFIED. */
export const MAX_SPUR_METERS = 2000;
/** Winding factor applied to straight-line distance when an access road is inferred. */
export const ROAD_WINDING_FACTOR = 1.35;
export const SPUR_SPEED_KMH = 35;
/** Extra distance of the median crossover / U-turn loop inferred for opposite-side restaurants. */
export const CROSSOVER_METERS = 400;
/** India drives on the LEFT: a point on the left of the travel direction is on our carriageway. */
export const TRAFFIC_SIDE = 'left';
/** Fallback cruise speed, used only when neither the graph nor the route provide timing. */
export const DEFAULT_CRUISE_SPEED_MPS = 25;

const isLong = (e) => !e.synthetic && e.distanceMeters >= MAINLINE_EDGE_METERS;

/**
 * Mainline nodes = nodes that touch a long highway link AND are not ramp nodes.
 * A ramp node is recognisable structurally: something SHORT (a ramp / service road) leads into it
 * (e.g. an "on-ramp" node has a long highway link going out, but only short links coming in).
 * Structural, not hardcoded.
 * @param {import('./shortestPath.js').RoadNetworkGraph} graph
 * @returns {Set<string>}
 */
export function identifyMainlineNodes(graph) {
  const touchesLong = new Set();
  const hasShortIncoming = new Set();
  for (const [from, edges] of graph.adjacencyList) {
    for (const e of edges) {
      if (e.synthetic) continue;
      if (isLong(e)) {
        touchesLong.add(from);
        touchesLong.add(e.to);
      } else if (!e.isForbidden) {
        hasShortIncoming.add(e.to);
      }
    }
  }
  const result = new Set();
  for (const id of touchesLong) if (!hasShortIncoming.has(id)) result.add(id);
  return result;
}

/** Seconds-per-metre of the highway link leaving a mainline node (graph's own speed model). */
function mainlineSecondsPerMeter(graph, nodeId) {
  const edges = (graph.adjacencyList.get(nodeId) || []).filter(isLong);
  if (edges.length === 0) return 1 / DEFAULT_CRUISE_SPEED_MPS;
  const e = edges[0];
  return e.durationSeconds / e.distanceMeters;
}

function addSyntheticEdge(graph, from, to, options) {
  graph.addEdge(from, to, options);
  const list = graph.adjacencyList.get(from);
  list[list.length - 1].synthetic = true;
}

/**
 * First MAINLINE node reachable from `startId` by following legal outgoing edges (BFS, shallow).
 * This is how a ramp's "rejoin" is derived from topology: the on-ramp feeds the next highway node.
 */
export function findDownstreamMainline(graph, startId, mainline, maxHops = 4) {
  if (mainline.has(startId)) return startId;
  const seen = new Set([startId]);
  let frontier = [startId];
  for (let hop = 0; hop < maxHops; hop++) {
    const next = [];
    for (const id of frontier) {
      for (const e of graph.adjacencyList.get(id) || []) {
        if (e.isForbidden || e.hasMedianBarrier || seen.has(e.to)) continue;
        if (mainline.has(e.to)) return e.to;
        seen.add(e.to);
        next.push(e.to);
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * Snaps the vehicle to the graph: the LAST mainline node it has already reached
 * (so everything ahead stays reachable along directed edges).
 */
export function snapVehicleToGraph(graph, routeCoordinates, vehiclePosition, vehicleProgressMeters, mainline, nodeProgress, preferredNodeId = '') {
  if (preferredNodeId && graph.nodes.has(preferredNodeId)) {
    const progress = nodeProgress.get(preferredNodeId) ?? progressAlongRoute(routeCoordinates, graph.nodes.get(preferredNodeId).location);
    return { nodeId: preferredNodeId, progress, source: 'provided' };
  }

  const ordered = [...mainline]
    .map(id => ({ id, progress: nodeProgress.get(id) }))
    .filter(n => Number.isFinite(n.progress))
    .sort((a, b) => a.progress - b.progress);

  if (ordered.length > 0) {
    let chosen = ordered[0];
    for (const n of ordered) {
      if (n.progress <= vehicleProgressMeters + 50) chosen = n;
      else break;
    }
    return { nodeId: chosen.id, progress: chosen.progress, source: 'snapped to last mainline node passed' };
  }

  const nearest = graph.findNearestNode(vehiclePosition, 20000);
  if (!nearest) return null;
  return {
    nodeId: nearest.nodeId,
    progress: progressAlongRoute(routeCoordinates, graph.nodes.get(nearest.nodeId).location),
    source: 'snapped to nearest node'
  };
}

/**
 * Decides, for every candidate, which graph node is its entrance and where it rejoins.
 * Returns a NEW graph (the shared one is never mutated) with inferred spurs added.
 *
 * @param {import('./shortestPath.js').RoadNetworkGraph} baseGraph
 * @param {Array<any>} candidates restaurants already enriched with { distanceAlongRouteMeters, sideOfRoad }
 * @param {Set<string>} mainline
 * @param {Map<string, number>} nodeProgress
 * @returns {{ graph: any, attachments: Map<string, any> }}
 */
export function attachRestaurantsToGraph(baseGraph, candidates, mainline, nodeProgress) {
  const graph = baseGraph.clone();
  const attachments = new Map();
  const mainlineNodes = [...mainline].filter(id => baseGraph.nodes.has(id));

  for (const c of candidates) {
    const declared = c.accessPoint?.roadNodeId || '';
    const declaredRejoin = c.accessPoint?.rejoinNodeId || '';

    // 1) Explicitly mapped to a node that is not in the graph at all -> cannot be verified.
    if (declared && !baseGraph.nodes.has(declared)) {
      attachments.set(c.id, { status: 'unmapped', reason: `Access node "${declared}" is not in the road graph.` });
      continue;
    }

    // 2) Mapped to a dedicated ramp / service node -> use the graph exactly as given.
    //    The rejoin is resolved TOPOLOGICALLY to the next mainline node, so the baseline
    //    ("just keep driving") never routes through the restaurant itself.
    if (declared && !mainline.has(declared)) {
      let rejoin = declaredRejoin && baseGraph.nodes.has(declaredRejoin) ? declaredRejoin : declared;
      const resolved = findDownstreamMainline(baseGraph, rejoin, mainline) || findDownstreamMainline(baseGraph, declared, mainline);
      attachments.set(c.id, {
        status: 'mapped',
        accessNodeId: declared,
        rejoinNodeId: resolved || rejoin,
        synthetic: false
      });
      continue;
    }

    // 3) Mapped straight to a mainline node, or not mapped: infer an access road from geometry.
    let anchor = declared || '';
    if (!anchor) {
      const along = c.distanceAlongRouteMeters ?? 0;
      let best = null;
      for (const id of mainlineNodes) {
        const prog = nodeProgress.get(id);
        if (!Number.isFinite(prog) || prog > along + 300) continue; // exit must be before the restaurant
        const d = haversine(baseGraph.nodes.get(id).location, c.location);
        if (!best || d < best.d) best = { id, d };
      }
      anchor = best ? best.id : '';
    }

    if (!anchor) {
      attachments.set(c.id, { status: 'unmapped', reason: 'No mainline exit found before this restaurant.' });
      continue;
    }

    const straight = haversine(baseGraph.nodes.get(anchor).location, c.location);
    const spurMeters = Math.round(straight * ROAD_WINDING_FACTOR);
    if (spurMeters > MAX_SPUR_METERS) {
      attachments.set(c.id, {
        status: 'unmapped',
        reason: `Nearest mapped junction is ${spurMeters} m away (limit ${MAX_SPUR_METERS} m); access road cannot be verified.`
      });
      continue;
    }

    const restId = `ACCESS::${c.id}`;
    graph.addNode(restId, c.location, c.name || c.id);
    const spurSeconds = Math.round(spurMeters / ((SPUR_SPEED_KMH * 1000) / 3600));
    const oppositeSide = c.sideOfRoad && c.sideOfRoad !== 'on-route' && c.sideOfRoad !== TRAFFIC_SIDE;

    if (oppositeSide) {
      // Restaurant is across the carriageway: price a median crossover (a U-turn maneuver).
      const crossId = `CROSS::${c.id}`;
      graph.addNode(crossId, c.location, 'Median crossover (inferred)');
      addSyntheticEdge(graph, anchor, crossId, { distanceMeters: CROSSOVER_METERS, durationSeconds: 40, speedKmh: 30, isUTurn: true });
      addSyntheticEdge(graph, crossId, restId, { distanceMeters: spurMeters, durationSeconds: spurSeconds, speedKmh: SPUR_SPEED_KMH, isTurn: true });
    } else {
      addSyntheticEdge(graph, anchor, restId, { distanceMeters: spurMeters, durationSeconds: spurSeconds, speedKmh: SPUR_SPEED_KMH, isTurn: true });
    }
    addSyntheticEdge(graph, restId, anchor, { distanceMeters: spurMeters, durationSeconds: spurSeconds, speedKmh: SPUR_SPEED_KMH, isTurn: true });

    attachments.set(c.id, {
      status: 'inferred',
      accessNodeId: restId,
      rejoinNodeId: anchor,
      anchorNodeId: anchor,
      spurMeters,
      crossing: !!oppositeSide,
      synthetic: true
    });
  }

  return { graph, attachments };
}

/** Explains in words why `nodeId` cannot be reached (used by the visualizer). */
export function explainUnreachable(graph, nodeId) {
  const incoming = graph.incomingEdges(nodeId);
  const blocked = incoming.find(e => e.isForbidden || e.hasMedianBarrier);
  if (blocked) {
    return {
      from: blocked.from,
      to: blocked.to,
      text: `Only entry is ${blocked.from} -> ${blocked.to}, which is blocked by a median barrier / prohibited maneuver.`
    };
  }
  if (incoming.length === 0) return { from: null, to: nodeId, text: 'No road in the graph leads to this node.' };
  return { from: incoming[0].from, to: nodeId, text: 'No legal directed path from the vehicle (one-way edges or turn restrictions block it).' };
}

/**
 * Computes the full graph-based detour for one candidate from pre-computed shortest-path trees.
 */
export function evaluateGraphDetour({ graph, treeV, getTree, accessNodeId, rejoinNodeId, thresholds, synthetic }) {
  const toAccess = treeV.pathTo(accessNodeId);
  if (!toAccess) {
    return { ok: false, accessibilityClass: 'RED', blocker: explainUnreachable(graph, accessNodeId), toAccess: null };
  }

  const accessToRejoin = getTree(accessNodeId).pathTo(rejoinNodeId);
  if (!accessToRejoin) {
    return {
      ok: false,
      accessibilityClass: 'RED',
      blocker: { from: accessNodeId, to: rejoinNodeId, text: 'Reachable, but there is no legal way to rejoin the highway afterwards.' },
      toAccess
    };
  }

  const baseline = treeV.pathTo(rejoinNodeId); // continuing without the stop; may be null
  const baseDist = baseline ? baseline.distance : 0;
  const baseTime = baseline ? baseline.time : 0;

  const detourDistanceMeters = Math.max(0, Math.round(toAccess.distance + accessToRejoin.distance - baseDist));
  const detourDurationSeconds = Math.max(0, Math.round(toAccess.time + accessToRejoin.time - baseTime));
  const turnCount = toAccess.turns + accessToRejoin.turns;
  const uTurnCount = toAccess.uTurns + accessToRejoin.uTurns;

  let accessibilityClass = classifyAccessibility({ hasGraphData: true, path1: toAccess, path2: accessToRejoin });
  const usesInferred = synthetic || [...toAccess.edges, ...accessToRejoin.edges].some(e => e.synthetic);

  let accessibilityReason;
  if (accessibilityClass === 'GREEN' && usesInferred) {
    accessibilityClass = 'YELLOW';
    accessibilityReason = 'Access road inferred from geometry (no mapped ramp), so it is not marked fully verified.';
  } else if (accessibilityClass === 'GREEN') {
    accessibilityReason = `Direct access on current carriageway: ${turnCount} turn(s), no U-turn.`;
  } else if (accessibilityClass === 'YELLOW') {
    accessibilityReason = uTurnCount > 0
      ? `Needs ${uTurnCount} legal U-turn/crossover and ${turnCount} turn(s).`
      : `Needs ${turnCount} turns through a junction or ramp.`;
  } else {
    accessibilityReason = `Requires ${uTurnCount} U-turns; too hazardous.`;
  }

  return {
    ok: true,
    detourDistanceMeters,
    detourDurationSeconds,
    turnCount,
    uTurnCount,
    detourClassification: classifyDetour(detourDistanceMeters, thresholds),
    accessibilityClass,
    accessibilityReason,
    inferredAccess: usesInferred,
    pathNodeIds: [...toAccess.path, ...accessToRejoin.path.slice(1)],
    uTurnPenaltySeconds: uTurnCount * MANEUVER_PENALTIES.U_TURN_PENALTY_SECONDS,
    legs: {
      toAccess: { nodes: toAccess.path, distance: toAccess.distance, time: toAccess.time },
      accessToRejoin: { nodes: accessToRejoin.path, distance: accessToRejoin.distance, time: accessToRejoin.time },
      baseline: baseline ? { nodes: baseline.path, distance: baseline.distance, time: baseline.time } : null
    },
    toAccess
  };
}

/**
 * Builds the per-request graph context used by the recommendation engine:
 * mainline detection -> vehicle snap -> restaurant attachment -> ONE Dijkstra tree from the vehicle.
 * `resultFor(restaurant)` then returns a DetourResult-shaped object plus graph-derived timing.
 *
 * @param {Object} p
 * @param {import('./shortestPath.js').RoadNetworkGraph} p.graph shared road graph (never mutated)
 * @param {Array<[number, number]>} p.routeCoordinates
 * @param {[number, number]} p.vehiclePosition
 * @param {Array<any>} p.restaurants candidates that already passed corridor + ahead filters
 * @param {string} [p.preferredVehicleNodeId] explicit node (tests / telemetry); otherwise snapped
 * @param {number} [p.highwayDurationToVehicleSeconds] elapsed driving time at the vehicle position
 * @param {Object} [p.thresholds] detour classification thresholds
 */
export function buildGraphEvaluator({
  graph,
  routeCoordinates,
  vehiclePosition,
  restaurants,
  preferredVehicleNodeId = '',
  highwayDurationToVehicleSeconds = 0,
  thresholds
}) {
  const mainline = identifyMainlineNodes(graph);
  const nodeProgress = new Map();
  for (const id of mainline) {
    try { nodeProgress.set(id, progressAlongRoute(routeCoordinates, graph.nodes.get(id).location)); } catch { /* skip */ }
  }

  const vehicleProgress = progressAlongRoute(routeCoordinates, vehiclePosition);
  const snap = snapVehicleToGraph(graph, routeCoordinates, vehiclePosition, vehicleProgress, mainline, nodeProgress, preferredVehicleNodeId);
  if (!snap) return null;

  // Inferred access roads may only hang off mainline nodes the vehicle has NOT passed yet.
  const usableProgress = new Map();
  for (const [id, prog] of nodeProgress) if (prog >= snap.progress - 1) usableProgress.set(id, prog);

  const enriched = restaurants.map(r => {
    if (r.distanceAlongRouteMeters !== undefined && r.sideOfRoad) return r;
    const proj = findNearestPointOnPolyline(r.location, routeCoordinates);
    return { ...r, distanceAlongRouteMeters: proj.distanceAlongRouteMeters, sideOfRoad: proj.sideOfRoad };
  });

  const { graph: workGraph, attachments } = attachRestaurantsToGraph(graph, enriched, mainline, usableProgress);
  const treeV = dijkstraFrom(workGraph, snap.nodeId);
  const treeCache = new Map();
  const getTree = (id) => {
    if (!treeCache.has(id)) treeCache.set(id, dijkstraFrom(workGraph, id));
    return treeCache.get(id);
  };

  // Seconds already spent between the snapped node and the vehicle's true position: the graph's
  // vehicle->restaurant time includes that stretch, but the clock (highwayDurationToVehicleSeconds)
  // already counted it.
  const alreadyDrivenSeconds = Math.max(0, (vehicleProgress - snap.progress) * mainlineSecondsPerMeter(graph, snap.nodeId));

  return {
    mainline,
    snap,
    vehicleProgress,
    attachments,
    workGraph,
    attachmentFor: (restaurantId) => attachments.get(restaurantId),
    resultFor(restaurant) {
      const att = attachments.get(restaurant.id);
      if (!att || att.status === 'unmapped') {
        return {
          unmapped: true,
          reason: att?.reason || 'Restaurant is not attached to the road graph.'
        };
      }
      const res = evaluateGraphDetour({
        graph: workGraph,
        treeV,
        getTree,
        accessNodeId: att.accessNodeId,
        rejoinNodeId: att.rejoinNodeId,
        thresholds,
        synthetic: att.synthetic
      });
      if (!res.ok) {
        return {
          detourDistanceMeters: Infinity,
          detourDurationSeconds: Infinity,
          turnCount: 0,
          uTurnCount: 0,
          detourClassification: 'Excessive',
          accessibilityClass: 'RED',
          accessibilityReason: res.blocker.text,
          blocker: res.blocker,
          pathNodeIds: [],
          attachment: att
        };
      }
      const secondsToRestaurant = Math.max(0, res.toAccess.time - alreadyDrivenSeconds);
      return {
        ...res,
        attachment: att,
        etaOffsetSeconds: highwayDurationToVehicleSeconds + secondsToRestaurant
      };
    }
  };
}

/** JSON-safe snapshot of the graph (for the visualizer). */
export function serializeGraph(graph, mainline) {
  const nodes = [...graph.nodes.values()].map(n => ({
    id: n.id,
    name: n.name,
    location: n.location,
    mainline: mainline.has(n.id),
    synthetic: n.id.startsWith('ACCESS::') || n.id.startsWith('CROSS::')
  }));
  const edges = [];
  for (const list of graph.adjacencyList.values()) {
    for (const e of list) {
      edges.push({
        from: e.from,
        to: e.to,
        distanceMeters: e.distanceMeters,
        durationSeconds: e.durationSeconds,
        isTurn: e.isTurn,
        isUTurn: e.isUTurn,
        blocked: !!(e.isForbidden || e.hasMedianBarrier),
        synthetic: !!e.synthetic
      });
    }
  }
  return { nodes, edges };
}

export { mainlineSecondsPerMeter, dijkstraFrom };
