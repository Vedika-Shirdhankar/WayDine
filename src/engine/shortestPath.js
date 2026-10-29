/**
 * @file shortestPath.js
 * Dijkstra shortest path routing using a Binary Min-Heap priority queue.
 * Strictly respects directed (one-way) edges, U-turn restrictions, and forbidden turn maneuvers.
 */

import { haversine } from './geoUtils.js';

export const MANEUVER_PENALTIES = {
  U_TURN_PENALTY_SECONDS: 240,
  LEFT_TURN_PENALTY_SECONDS: 45,
  RIGHT_TURN_PENALTY_SECONDS: 15,
  DEFAULT_RAMP_SECONDS: 30
};

/**
 * Binary Min-Heap Priority Queue for optimal O((V + E) log V) Dijkstra traversal.
 */
export class BinaryMinHeap {
  constructor() {
    /** @type {Array<{ item: any, priority: number }>} */
    this.heap = [];
  }

  get size() {
    return this.heap.length;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  push(item, priority) {
    this.heap.push({ item, priority });
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.isEmpty()) return null;
    const min = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0 && last !== undefined) {
      this.heap[0] = last;
      this._bubbleDown(0);
    }
    return min.item;
  }

  _bubbleUp(index) {
    while (index > 0) {
      const parentIndex = (index - 1) >> 1;
      if (this.heap[index].priority < this.heap[parentIndex].priority) {
        this._swap(index, parentIndex);
        index = parentIndex;
      } else {
        break;
      }
    }
  }

  _bubbleDown(index) {
    const length = this.heap.length;
    while (true) {
      const leftChild = (index << 1) + 1;
      const rightChild = leftChild + 1;
      let smallest = index;

      if (leftChild < length && this.heap[leftChild].priority < this.heap[smallest].priority) {
        smallest = leftChild;
      }
      if (rightChild < length && this.heap[rightChild].priority < this.heap[smallest].priority) {
        smallest = rightChild;
      }

      if (smallest !== index) {
        this._swap(index, smallest);
        index = smallest;
      } else {
        break;
      }
    }
  }

  _swap(i, j) {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
  }
}

/**
 * Road Network Graph representation supporting directed edges and turn restrictions.
 */
export class RoadNetworkGraph {
  constructor() {
    /** @type {Map<string, import('../types/typedefs.js').RoadNode>} */
    this.nodes = new Map();
    /** @type {Map<string, import('../types/typedefs.js').RoadEdge[]>} */
    this.adjacencyList = new Map();
    /** @type {Set<string>} - Set of "from->via->to" forbidden turn keys */
    this.forbiddenTurns = new Set();
  }

  /**
   * Adds a vertex to the road graph.
   * @param {string} id
   * @param {[number, number]} location - [lat, lng]
   * @param {string} [name='']
   */
  addNode(id, location, name = '') {
    if (!id || typeof id !== 'string') {
      throw new TypeError(`[RoadNetworkGraph] Invalid node ID: ${id}`);
    }
    this.nodes.set(id, { id, location, name });
    if (!this.adjacencyList.has(id)) {
      this.adjacencyList.set(id, []);
    }
  }

  /**
   * Adds a directed road edge.
   * @param {string} from
   * @param {string} to
   * @param {Object} options
   * @param {number} [options.distanceMeters]
   * @param {number} [options.durationSeconds]
   * @param {number} [options.speedKmh=50]
   * @param {boolean} [options.oneWay=true]
   * @param {boolean} [options.bidirectional=false]
   * @param {boolean} [options.isUTurn=false]
   * @param {boolean} [options.isTurn=false]
   * @param {boolean} [options.isLeftTurn=false]
   * @param {boolean} [options.hasMedianBarrier=false]
   * @param {boolean} [options.isForbidden=false]
   */
  addEdge(from, to, options = {}) {
    if (!this.nodes.has(from)) {
      throw new Error(`[RoadNetworkGraph] Origin node ${from} does not exist.`);
    }
    if (!this.nodes.has(to)) {
      throw new Error(`[RoadNetworkGraph] Destination node ${to} does not exist.`);
    }

    const fromLoc = this.nodes.get(from).location;
    const toLoc = this.nodes.get(to).location;
    const distanceMeters = options.distanceMeters ?? (fromLoc && toLoc ? Math.round(haversine(fromLoc, toLoc)) : 1);
    const speedKmh = options.speedKmh || 50;
    const durationSeconds = options.durationSeconds ?? Math.round(distanceMeters / ((speedKmh * 1000) / 3600));

    const edge = {
      from,
      to,
      distanceMeters,
      durationSeconds,
      speedKmh,
      oneWay: options.bidirectional ? false : (options.oneWay !== false),
      isUTurn: !!options.isUTurn,
      isTurn: !!options.isTurn || !!options.isLeftTurn,
      isLeftTurn: !!options.isLeftTurn,
      hasMedianBarrier: !!options.hasMedianBarrier,
      isForbidden: !!options.isForbidden || !!options.hasMedianBarrier
    };

    this.adjacencyList.get(from).push(edge);

    if (options.bidirectional || options.oneWay === false) {
      this.adjacencyList.get(to).push({
        ...edge,
        from: to,
        to: from
      });
    }
  }

  /**
   * Registers a forbidden turn maneuver: fromNode -> viaNode -> toNode.
   * @param {string} fromNode
   * @param {string} viaNode
   * @param {string} toNode
   */
  addForbiddenTurn(fromNode, viaNode, toNode) {
    this.forbiddenTurns.add(`${fromNode}->${viaNode}->${toNode}`);
  }

  findNearestNode(point, maxSearchRadiusMeters = 10000) {
    let nearestNodeId = null;
    let minDistanceMeters = Infinity;

    for (const [id, node] of this.nodes.entries()) {
      const dist = haversine(point, node.location);
      if (dist < minDistanceMeters && dist <= maxSearchRadiusMeters) {
        minDistanceMeters = dist;
        nearestNodeId = id;
      }
    }

    return nearestNodeId ? { nodeId: nearestNodeId, distanceMeters: minDistanceMeters } : null;
  }
}

/**
 * Computes shortest path between startNodeId and endNodeId using Dijkstra's algorithm.
 * Respects one-way directed edges, U-turn allowances, and forbidden turn maneuvers.
 *
 * @param {RoadNetworkGraph} graph
 * @param {string} startNodeId
 * @param {string} endNodeId
 * @param {Object} [options]
 * @param {boolean} [options.allowUTurns=true]
 * @param {number} [options.uTurnPenaltySeconds=240]
 * @param {number} [options.turnPenaltySeconds=30]
 * @returns {{
 *   path: string[],
 *   distance: number,
 *   time: number,
 *   turns: number,
 *   uTurns: number,
 *   distanceMeters: number,
 *   durationSeconds: number,
 *   pathNodeIds: string[],
 *   pathCoordinates: [number, number][],
 *   uTurnCount: number,
 *   turnCount: number
 * } | null}
 */
export function dijkstra(graph, startNodeId, endNodeId, options = {}) {
  if (!graph || !graph.nodes.has(startNodeId) || !graph.nodes.has(endNodeId)) {
    return null;
  }

  const allowUTurns = options.allowUTurns !== false;
  const uTurnPenalty = options.uTurnPenaltySeconds ?? MANEUVER_PENALTIES.U_TURN_PENALTY_SECONDS;
  const turnPenalty = options.turnPenaltySeconds ?? (options.leftTurnPenaltySeconds || MANEUVER_PENALTIES.LEFT_TURN_PENALTY_SECONDS);

  const bestTimes = new Map();
  const previous = new Map();

  const startKey = `${startNodeId}:none`;
  bestTimes.set(startKey, 0);

  const pq = new BinaryMinHeap();
  pq.push({ curr: startNodeId, prev: 'none', key: startKey }, 0);

  let targetKey = null;

  while (!pq.isEmpty()) {
    const { curr, prev, key } = pq.pop();

    if (curr === endNodeId) {
      targetKey = key;
      break;
    }

    const currentDuration = bestTimes.get(key);
    const edges = graph.adjacencyList.get(curr) || [];

    for (const edge of edges) {
      if (edge.isForbidden || edge.hasMedianBarrier) continue;
      if (edge.isUTurn && !allowUTurns) continue;

      if (prev !== 'none' && graph.forbiddenTurns.has(`${prev}->${curr}->${edge.to}`)) {
        continue;
      }

      if (edge.to === prev && !allowUTurns) {
        continue;
      }

      let edgeDuration = edge.durationSeconds;
      if (edge.isUTurn) edgeDuration += uTurnPenalty;
      if (edge.isTurn || edge.isLeftTurn) edgeDuration += turnPenalty;

      const nextKey = `${edge.to}:${curr}`;
      const newDuration = currentDuration + edgeDuration;

      if (!bestTimes.has(nextKey) || newDuration < bestTimes.get(nextKey)) {
        bestTimes.set(nextKey, newDuration);
        previous.set(nextKey, {
          prevKey: key,
          edge,
          distance: edge.distanceMeters
        });
        pq.push({ curr: edge.to, prev: curr, key: nextKey }, newDuration);
      }
    }
  }

  if (!targetKey) {
    return null;
  }

  const path = [];
  let currKey = targetKey;
  let totalDistance = 0;
  let totalTime = bestTimes.get(targetKey);
  let turns = 0;
  let uTurns = 0;

  const [finalNode] = targetKey.split(':');
  path.unshift(finalNode);

  while (currKey !== startKey) {
    const step = previous.get(currKey);
    if (!step) break;

    totalDistance += step.distance;
    if (step.edge.isUTurn) uTurns++;
    if (step.edge.isTurn || step.edge.isLeftTurn) turns++;

    const [prevNode] = step.prevKey.split(':');
    if (prevNode !== 'none') {
      path.unshift(prevNode);
    }
    currKey = step.prevKey;
  }

  const pathCoordinates = path.map(id => graph.nodes.get(id)?.location).filter(Boolean);

  return {
    path,
    distance: Math.round(totalDistance),
    time: Math.round(totalTime),
    turns,
    uTurns,
    // Aliases
    distanceMeters: Math.round(totalDistance),
    durationSeconds: Math.round(totalTime),
    pathNodeIds: path,
    pathCoordinates,
    uTurnCount: uTurns,
    turnCount: turns
  };
}

export const dijkstraShortestPath = dijkstra;
