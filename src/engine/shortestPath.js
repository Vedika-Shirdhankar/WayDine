/**
 * @file shortestPath.js
 * Deterministic road-network graph modeling and Dijkstra shortest path algorithm.
 * Models directed road segments, highway median barriers, turn penalties, and U-turn counts.
 * Zero AI/ML - pure graph theory and Dijkstra priority queue traversal.
 */

import { haversineDistanceMeters, validateLatLng } from './geoUtils.js';

/**
 * Penalty constants (in seconds) for maneuvers.
 */
export const MANEUVER_PENALTIES = {
  U_TURN_PENALTY_SECONDS: 240,     // 4 minutes penalty for hazardous/lengthy U-turn
  LEFT_TURN_PENALTY_SECONDS: 45,   // Left turn across oncoming highway or intersection
  RIGHT_TURN_PENALTY_SECONDS: 15,  // Simple right ramp/turn
  DEFAULT_RAMP_SECONDS: 30         // Entering/exiting frontage or access road
};

/**
 * Priority queue item for Dijkstra's algorithm.
 */
class PriorityQueue {
  constructor() {
    /** @type {{ node: string, priority: number }[]} */
    this.elements = [];
  }

  enqueue(node, priority) {
    this.elements.push({ node, priority });
    this.elements.sort((a, b) => a.priority - b.priority);
  }

  dequeue() {
    return this.elements.shift()?.node;
  }

  isEmpty() {
    return this.elements.length === 0;
  }
}

/**
 * Road Network Graph representation.
 */
export class RoadNetworkGraph {
  constructor() {
    /** @type {Map<string, { id: string, location: [number, number], name?: string }>} */
    this.nodes = new Map();
    /** @type {Map<string, Array<{ to: string, distanceMeters: number, speedKmh: number, isUTurn?: boolean, isLeftTurn?: boolean, hasMedianBarrier?: boolean, roadName?: string }>>} */
    this.adjacencyList = new Map();
  }

  /**
   * Adds a vertex to the graph.
   * @param {string} id
   * @param {[number, number]} location - [lat, lng]
   * @param {string} [name]
   */
  addNode(id, location, name = '') {
    if (!id || typeof id !== 'string') {
      throw new TypeError(`[RoadNetworkGraph] Invalid node id: ${id}`);
    }
    validateLatLng(location, `node ${id}`);
    this.nodes.set(id, { id, location, name });
    if (!this.adjacencyList.has(id)) {
      this.adjacencyList.set(id, []);
    }
  }

  /**
   * Adds a directed road edge.
   * @param {string} fromNodeId
   * @param {string} toNodeId
   * @param {Object} options
   * @param {number} [options.distanceMeters] - If omitted, calculated via haversine
   * @param {number} [options.speedKmh=50]
   * @param {boolean} [options.isUTurn=false]
   * @param {boolean} [options.isLeftTurn=false]
   * @param {boolean} [options.hasMedianBarrier=false]
   * @param {string} [options.roadName='']
   * @param {boolean} [options.bidirectional=false]
   */
  addEdge(fromNodeId, toNodeId, options = {}) {
    if (!this.nodes.has(fromNodeId)) {
      throw new Error(`[RoadNetworkGraph] Source node ${fromNodeId} not in graph.`);
    }
    if (!this.nodes.has(toNodeId)) {
      throw new Error(`[RoadNetworkGraph] Target node ${toNodeId} not in graph.`);
    }

    const fromLoc = this.nodes.get(fromNodeId).location;
    const toLoc = this.nodes.get(toNodeId).location;
    const distanceMeters = options.distanceMeters ?? haversineDistanceMeters(fromLoc, toLoc);
    const speedKmh = options.speedKmh || 50;

    const edge = {
      to: toNodeId,
      distanceMeters,
      speedKmh,
      isUTurn: !!options.isUTurn,
      isLeftTurn: !!options.isLeftTurn,
      hasMedianBarrier: !!options.hasMedianBarrier,
      roadName: options.roadName || ''
    };

    this.adjacencyList.get(fromNodeId).push(edge);

    if (options.bidirectional) {
      this.adjacencyList.get(toNodeId).push({
        ...edge,
        to: fromNodeId
      });
    }
  }

  /**
   * Finds the nearest graph node to a given coordinate.
   * @param {[number, number]} point - [lat, lng]
   * @param {number} [maxSearchRadiusMeters=10000]
   * @returns {{ nodeId: string, distanceMeters: number } | null}
   */
  findNearestNode(point, maxSearchRadiusMeters = 10000) {
    validateLatLng(point, 'search point');
    let nearestNodeId = null;
    let minDistanceMeters = Infinity;

    for (const [id, node] of this.nodes.entries()) {
      const dist = haversineDistanceMeters(point, node.location);
      if (dist < minDistanceMeters && dist <= maxSearchRadiusMeters) {
        minDistanceMeters = dist;
        nearestNodeId = id;
      }
    }

    return nearestNodeId ? { nodeId: nearestNodeId, distanceMeters: minDistanceMeters } : null;
  }
}

/**
 * Computes shortest path on the road graph using Dijkstra's algorithm.
 * Accounts for distance, speed limits, U-turn penalties, and turn delays.
 *
 * @param {RoadNetworkGraph} graph
 * @param {string} startNodeId
 * @param {string} targetNodeId
 * @param {Object} [options]
 * @param {boolean} [options.allowUTurns=true]
 * @param {number} [options.uTurnPenaltySeconds=240]
 * @param {number} [options.leftTurnPenaltySeconds=45]
 * @returns {{
 *   distanceMeters: number,
 *   durationSeconds: number,
 *   pathNodeIds: string[],
 *   pathCoordinates: [number, number][],
 *   uTurnCount: number,
 *   turnCount: number
 * } | null}
 */
export function dijkstraShortestPath(graph, startNodeId, targetNodeId, options = {}) {
  if (!graph || !(graph instanceof RoadNetworkGraph)) {
    throw new TypeError('[shortestPath] Invalid graph instance provided.');
  }
  if (!graph.nodes.has(startNodeId)) {
    throw new Error(`[shortestPath] Start node ${startNodeId} not found in graph.`);
  }
  if (!graph.nodes.has(targetNodeId)) {
    throw new Error(`[shortestPath] Target node ${targetNodeId} not found in graph.`);
  }

  const uTurnPenalty = options.uTurnPenaltySeconds ?? MANEUVER_PENALTIES.U_TURN_PENALTY_SECONDS;
  const leftTurnPenalty = options.leftTurnPenaltySeconds ?? MANEUVER_PENALTIES.LEFT_TURN_PENALTY_SECONDS;
  const allowUTurns = options.allowUTurns !== false;

  /** @type {Map<string, number>} - Node ID to minimum duration in seconds */
  const times = new Map();
  /** @type {Map<string, number>} - Node ID to distance in meters */
  const distances = new Map();
  /** @type {Map<string, { prevNode: string, edge: any }>} */
  const previous = new Map();

  for (const nodeId of graph.nodes.keys()) {
    times.set(nodeId, Infinity);
    distances.set(nodeId, Infinity);
  }

  times.set(startNodeId, 0);
  distances.set(startNodeId, 0);

  const pq = new PriorityQueue();
  pq.enqueue(startNodeId, 0);

  while (!pq.isEmpty()) {
    const currentId = pq.dequeue();

    if (currentId === targetNodeId) break;

    const currentDuration = times.get(currentId);
    const edges = graph.adjacencyList.get(currentId) || [];

    for (const edge of edges) {
      if (edge.isUTurn && !allowUTurns) continue;
      if (edge.hasMedianBarrier) continue; // Physical barrier prevents crossing

      // Edge traversal time in seconds
      const speedMs = (edge.speedKmh * 1000) / 3600;
      let edgeDuration = edge.distanceMeters / (speedMs || 1);

      if (edge.isUTurn) edgeDuration += uTurnPenalty;
      if (edge.isLeftTurn) edgeDuration += leftTurnPenalty;

      const newDuration = currentDuration + edgeDuration;
      const newDistance = distances.get(currentId) + edge.distanceMeters;

      if (newDuration < times.get(edge.to)) {
        times.set(edge.to, newDuration);
        distances.set(edge.to, newDistance);
        previous.set(edge.to, { prevNode: currentId, edge });
        pq.enqueue(edge.to, newDuration);
      }
    }
  }

  // If target is unreachable
  if (times.get(targetNodeId) === Infinity) {
    return null;
  }

  // Reconstruct path
  const pathNodeIds = [];
  let curr = targetNodeId;
  let uTurnCount = 0;
  let turnCount = 0;

  while (curr !== startNodeId) {
    pathNodeIds.unshift(curr);
    const prevInfo = previous.get(curr);
    if (!prevInfo) break;
    if (prevInfo.edge.isUTurn) uTurnCount++;
    if (prevInfo.edge.isLeftTurn) turnCount++;
    curr = prevInfo.prevNode;
  }
  pathNodeIds.unshift(startNodeId);

  const pathCoordinates = pathNodeIds.map(id => graph.nodes.get(id).location);

  return {
    distanceMeters: Math.round(distances.get(targetNodeId)),
    durationSeconds: Math.round(times.get(targetNodeId)),
    pathNodeIds,
    pathCoordinates,
    uTurnCount,
    turnCount
  };
}
