/**
 * @file detourCalculator.js
 * Graph-based detour distance and time computation using Dijkstra.
 * Enforces turn penalties, U-turn penalties, boundary-tested detour classification,
 * and accessibility classification.
 */

import { dijkstra, MANEUVER_PENALTIES, RoadNetworkGraph } from './shortestPath.js';
import { haversine } from './geoUtils.js';

export const DEFAULT_DETOUR_THRESHOLDS = {
  excellent: 300,
  veryGood: 700,
  moderate: 1500,
  high: 3000
};

/**
 * Classifies detour extra distance into human categories with configurable thresholds.
 *
 * @param {number} detourMeters
 * @param {typeof DEFAULT_DETOUR_THRESHOLDS} [thresholds]
 * @returns {'Excellent' | 'Very Good' | 'Moderate' | 'High' | 'Excessive'}
 */
export function classifyDetour(detourMeters, thresholds = DEFAULT_DETOUR_THRESHOLDS) {
  const t = { ...DEFAULT_DETOUR_THRESHOLDS, ...thresholds };

  if (detourMeters <= t.excellent) {
    return 'Excellent';
  } else if (detourMeters <= t.veryGood) {
    return 'Very Good';
  } else if (detourMeters <= t.moderate) {
    return 'Moderate';
  } else if (detourMeters <= t.high) {
    return 'High';
  } else {
    return 'Excessive';
  }
}

/**
 * Classifies road accessibility based on road graph paths.
 *
 * @param {Object} params
 * @param {boolean} params.hasGraphData
 * @param {any} [params.path1]
 * @param {any} [params.path2]
 * @param {boolean} [params.prohibitedCrossing=false]
 * @returns {import('../types/typedefs.js').AccessibilityClass}
 */
export function classifyAccessibility({
  hasGraphData,
  path1,
  path2,
  prohibitedCrossing = false
}) {
  if (!hasGraphData) {
    return 'UNVERIFIED';
  }

  if (prohibitedCrossing || !path1 || !path2) {
    return 'RED';
  }

  const totalUTurns = (path1.uTurns || path1.uTurnCount || 0) + (path2.uTurns || path2.uTurnCount || 0);
  const totalTurns = (path1.turns || path1.turnCount || 0) + (path2.turns || path2.turnCount || 0);

  if (totalUTurns > 1) {
    return 'RED';
  }

  if (totalUTurns === 1 || totalTurns > 2) {
    return 'YELLOW';
  }

  return 'GREEN';
}

/**
 * Computes road graph detour via Dijkstra.
 *
 * @param {RoadNetworkGraph|null} graph
 * @param {string} vehicleNodeId
 * @param {string} accessPointNodeId
 * @param {string} rejoinNodeId
 * @param {number} directRemainingDistanceMeters
 * @param {Object} [options]
 * @returns {import('../types/typedefs.js').DetourResult}
 */
export function calculateDetour(
  graph,
  vehicleNodeId,
  accessPointNodeId,
  rejoinNodeId,
  directRemainingDistanceMeters = 0,
  options = {}
) {
  const hasGraphData = Boolean(
    graph &&
    graph instanceof RoadNetworkGraph &&
    graph.nodes.has(vehicleNodeId) &&
    graph.nodes.has(accessPointNodeId) &&
    graph.nodes.has(rejoinNodeId)
  );

  if (!hasGraphData) {
    return {
      detourDistanceMeters: 0,
      detourDurationSeconds: 0,
      turnCount: 0,
      uTurnCount: 0,
      detourClassification: 'Excessive',
      accessibilityClass: 'UNVERIFIED',
      pathNodeIds: [],
      accessibilityReason: 'No road-graph connectivity data available.'
    };
  }

  const path1 = dijkstra(graph, vehicleNodeId, accessPointNodeId, options);
  const path2 = dijkstra(graph, accessPointNodeId, rejoinNodeId, options);

  const accessibilityClass = classifyAccessibility({
    hasGraphData: true,
    path1,
    path2
  });

  if (!path1 || !path2 || accessibilityClass === 'RED') {
    return {
      detourDistanceMeters: Infinity,
      detourDurationSeconds: Infinity,
      turnCount: (path1?.turns || 0) + (path2?.turns || 0),
      uTurnCount: (path1?.uTurns || 0) + (path2?.uTurns || 0),
      detourClassification: 'Excessive',
      accessibilityClass: 'RED',
      pathNodeIds: path1 ? path1.path : [],
      accessibilityReason: 'Destination is unreachable or blocked by median barriers / one-way rules.'
    };
  }

  const rawDetourDistance = (path1.distance + path2.distance) - directRemainingDistanceMeters;
  const detourDistanceMeters = Math.max(0, Math.round(rawDetourDistance));

  const directDuration = options.directRemainingDurationSeconds || 0;
  const rawDetourDuration = (path1.time + path2.time) - directDuration;
  const detourDurationSeconds = Math.max(0, Math.round(rawDetourDuration));

  const totalTurns = path1.turns + path2.turns;
  const totalUTurns = path1.uTurns + path2.uTurns;

  const classification = classifyDetour(detourDistanceMeters, options.thresholds);
  const fullPath = [...path1.path, ...path2.path.slice(1)];

  return {
    detourDistanceMeters,
    detourDurationSeconds,
    turnCount: totalTurns,
    uTurnCount: totalUTurns,
    detourClassification: classification,
    accessibilityClass,
    pathNodeIds: fullPath,
    accessibilityReason: accessibilityClass === 'GREEN'
      ? 'Direct access on current carriageway.'
      : 'Requires junction turn or ramp detour.'
  };
}

/**
 * Normalized score for detour duration (0-100).
 */
export function calculateDetourScore(totalDetourDurationSeconds) {
  if (typeof totalDetourDurationSeconds !== 'number' || totalDetourDurationSeconds < 0) {
    return 0;
  }
  const minutes = totalDetourDurationSeconds / 60;
  const score = Math.max(0, 100 * Math.exp(-0.09 * minutes));
  return Math.round(score * 10) / 10;
}

/**
 * Detour metrics calculator for high-level pipeline.
 */
export function calculateDetourMetrics(restaurant, nearestRoutePoint, roadGraph = null, options = {}) {
  const isDividedHighway = options.isDividedHighway ?? true;

  if (roadGraph && roadGraph instanceof RoadNetworkGraph && roadGraph.nodes.size > 0) {
    const startNode = roadGraph.findNearestNode(nearestRoutePoint, 2000);
    const targetNode = roadGraph.findNearestNode(restaurant.location, 2000);

    if (startNode && targetNode) {
      const result = calculateDetour(roadGraph, startNode.nodeId, targetNode.nodeId, startNode.nodeId, 0, options);
      if (result.accessibilityClass !== 'RED' && result.detourDistanceMeters !== Infinity) {
        return {
          ...result,
          uTurnPenaltySeconds: result.uTurnCount * MANEUVER_PENALTIES.U_TURN_PENALTY_SECONDS,
          detourPenaltyScore: calculateDetourScore(result.detourDurationSeconds),
          detourPathCoordinates: [nearestRoutePoint, restaurant.location, nearestRoutePoint],
          nearestRoutePoint,
          distanceAlongRouteMeters: restaurant.distanceAlongRouteMeters || 0
        };
      }
    }
  }

  // Geometric fallback
  const straightLineMeters = haversine(nearestRoutePoint, restaurant.location);
  const roadDetourMetersOneWay = Math.round(straightLineMeters * 1.35);
  const detourDistanceMeters = roadDetourMetersOneWay * 2;
  const drivingDurationSeconds = Math.round(detourDistanceMeters / ((40 * 1000) / 3600));

  let uTurnCount = 0;
  let turnCount = 2;
  if ((restaurant.sideOfRoad === 'left' || restaurant.roadSide === 'opposite_side') && isDividedHighway) {
    uTurnCount = 1;
    turnCount += 2;
  }

  const uTurnPenaltySeconds = uTurnCount * MANEUVER_PENALTIES.U_TURN_PENALTY_SECONDS;
  const turnPenaltySeconds = turnCount * MANEUVER_PENALTIES.RIGHT_TURN_PENALTY_SECONDS;
  const totalDurationSeconds = drivingDurationSeconds + uTurnPenaltySeconds + turnPenaltySeconds;

  return {
    detourDistanceMeters,
    detourDurationSeconds: totalDurationSeconds,
    uTurnCount,
    turnCount,
    uTurnPenaltySeconds,
    detourPenaltyScore: calculateDetourScore(totalDurationSeconds),
    detourPathCoordinates: [nearestRoutePoint, restaurant.location, nearestRoutePoint],
    nearestRoutePoint,
    distanceAlongRouteMeters: restaurant.distanceAlongRouteMeters || 0
  };
}
