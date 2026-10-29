/**
 * @file restaurantFilter.js
 * Implements Hackathon Task 1: Route-aware, direction-aware corridor discovery.
 * Filters restaurants along route corridor, checks vehicle progression (ahead/behind),
 * analyzes side-of-road relative to travel direction, and assigns accessibility class:
 * GREEN, YELLOW, RED, or Unverified.
 *
 * HARD RULE: Never claim a restaurant is accessible without road-graph support;
 * otherwise show "Unverified".
 */

import {
  validateLatLng,
  findNearestPointOnPolyline,
  isAheadOfVehicle
} from './geoUtils.js';
import { dijkstraShortestPath, RoadNetworkGraph } from './shortestPath.js';

/**
 * Filters restaurants located within a lateral corridor distance (meters) of the route.
 * @param {import('../types/typedefs.js').Restaurant[]} restaurants
 * @param {[number, number][]} routeCoordinates
 * @param {number} [maxCorridorMeters=3000] - Corridor buffer width in meters
 * @returns {Array<import('../types/typedefs.js').Restaurant & {
 *   distanceFromRouteMeters: number,
 *   distanceAlongRouteMeters: number,
 *   sideOfRoad: 'right' | 'left'
 * }>}
 */
export function filterCorridorRestaurants(restaurants, routeCoordinates, maxCorridorMeters = 3000) {
  if (!Array.isArray(restaurants)) {
    throw new TypeError('[restaurantFilter] restaurants must be an array.');
  }
  if (!Array.isArray(routeCoordinates) || routeCoordinates.length < 2) {
    throw new Error('[restaurantFilter] routeCoordinates must contain at least 2 points.');
  }
  if (typeof maxCorridorMeters !== 'number' || maxCorridorMeters <= 0) {
    throw new RangeError(`[restaurantFilter] maxCorridorMeters must be a positive number. Received: ${maxCorridorMeters}`);
  }

  const corridorCandidates = [];

  for (const restaurant of restaurants) {
    validateLatLng(restaurant.location, `restaurant ${restaurant.id}`);

    const projection = findNearestPointOnPolyline(restaurant.location, routeCoordinates);

    if (projection.distanceFromRouteMeters <= maxCorridorMeters) {
      corridorCandidates.push({
        ...restaurant,
        distanceFromRouteMeters: Math.round(projection.distanceFromRouteMeters),
        distanceAlongRouteMeters: Math.round(projection.distanceAlongRouteMeters),
        sideOfRoad: projection.sideOfRoad,
        nearestRoutePoint: projection.nearestPoint
      });
    }
  }

  return corridorCandidates;
}

/**
 * Filters candidates to retain only those ahead of the vehicle along the route progression.
 * @param {Array<any>} candidates
 * @param {[number, number][]} routeCoordinates
 * @param {number} vehicleProgressDistanceMeters
 * @returns {Array<any>}
 */
export function filterAheadOfVehicle(candidates, routeCoordinates, vehicleProgressDistanceMeters) {
  if (!Array.isArray(candidates)) {
    throw new TypeError('[restaurantFilter] candidates must be an array.');
  }
  if (typeof vehicleProgressDistanceMeters !== 'number' || Number.isNaN(vehicleProgressDistanceMeters)) {
    throw new TypeError(`[restaurantFilter] vehicleProgressDistanceMeters must be a number. Received: ${vehicleProgressDistanceMeters}`);
  }

  return candidates.filter(candidate => {
    return isAheadOfVehicle(
      candidate.location,
      routeCoordinates,
      vehicleProgressDistanceMeters
    );
  });
}

/**
 * Evaluates road-network connectivity and determines accessibility class.
 * HARD RULE: Never claim accessible without road-graph support; otherwise 'Unverified'.
 *
 * @param {import('../types/typedefs.js').Restaurant} restaurant
 * @param {[number, number]} nearestRoutePoint
 * @param {RoadNetworkGraph|null} [roadGraph]
 * @returns {{
 *   accessClass: 'GREEN' | 'YELLOW' | 'RED' | 'Unverified',
 *   accessReason: string,
 *   graphVerified: boolean,
 *   uTurnRequired: boolean
 * }}
 */
export function determineRestaurantAccessibility(restaurant, nearestRoutePoint, roadGraph = null) {
  if (!restaurant || !restaurant.location) {
    throw new TypeError('[restaurantFilter] Invalid restaurant object.');
  }
  validateLatLng(restaurant.location, 'restaurant.location');
  validateLatLng(nearestRoutePoint, 'nearestRoutePoint');

  // Hard Rule Check: Without graph support, return Unverified
  if (!roadGraph || !(roadGraph instanceof RoadNetworkGraph) || roadGraph.nodes.size === 0) {
    // If the database has an explicit pre-verified classification with graph proof, honor it with provenance
    if (restaurant.accessClass && restaurant.accessClass !== 'Unverified' && restaurant.graphVerified) {
      return {
        accessClass: restaurant.accessClass,
        accessReason: restaurant.accessReason || 'Verified via verified road telemetry record',
        graphVerified: true,
        uTurnRequired: restaurant.accessClass === 'RED'
      };
    }
    return {
      accessClass: 'Unverified',
      accessReason: 'No local road-graph topology available to verify off-ramp or turning restrictions',
      graphVerified: false,
      uTurnRequired: false
    };
  }

  // Find nearest highway node to nearestRoutePoint and restaurant node
  const startNodeMatch = roadGraph.findNearestNode(nearestRoutePoint, 2000);
  const targetNodeMatch = roadGraph.findNearestNode(restaurant.location, 2000);

  if (!startNodeMatch || !targetNodeMatch) {
    return {
      accessClass: 'Unverified',
      accessReason: 'Restaurant or highway segment disconnected from verified local road network graph',
      graphVerified: false,
      uTurnRequired: false
    };
  }

  // Run Dijkstra shortest path on graph
  const path = dijkstraShortestPath(roadGraph, startNodeMatch.nodeId, targetNodeMatch.nodeId);

  if (!path) {
    return {
      accessClass: 'RED',
      accessReason: 'No legal vehicular road path found (median barrier or one-way restriction prevents entry)',
      graphVerified: true,
      uTurnRequired: true
    };
  }

  const hasUTurn = path.uTurnCount > 0;
  const isHighDetour = path.durationSeconds > 300; // > 5 mins
  const isVeryDirect = !hasUTurn && path.turnCount <= 2 && path.durationSeconds <= 120;

  if (isVeryDirect) {
    return {
      accessClass: 'GREEN',
      accessReason: `Direct off-ramp/service road access (${path.turnCount} turns, ~${Math.round(path.durationSeconds / 60)} min off-route)`,
      graphVerified: true,
      uTurnRequired: false
    };
  } else if (!hasUTurn && !isHighDetour) {
    return {
      accessClass: 'YELLOW',
      accessReason: `Controlled signal or overpass turn required (${path.turnCount} turns, ~${Math.round(path.durationSeconds / 60)} min detour)`,
      graphVerified: true,
      uTurnRequired: false
    };
  } else {
    return {
      accessClass: 'RED',
      accessReason: hasUTurn
        ? `Requires hazardous highway U-turn across median (${path.uTurnCount} U-turn)`
        : `High-friction detour (~${Math.round(path.durationSeconds / 60)} min off-route)`,
      graphVerified: true,
      uTurnRequired: hasUTurn
    };
  }
}

/**
 * Complete Hackathon Task 1 pipeline:
 * 1. Corridor filtering (max distance from polyline)
 * 2. Progression filtering (ahead of vehicle)
 * 3. Side of road determination
 * 4. Accessibility classification (GREEN/YELLOW/RED/Unverified)
 *
 * @param {import('../types/typedefs.js').Restaurant[]} restaurants
 * @param {[number, number][]} routeCoordinates
 * @param {number} vehicleProgressDistanceMeters
 * @param {Object} [options]
 * @param {number} [options.maxCorridorMeters=3000]
 * @param {RoadNetworkGraph|null} [options.roadGraph]
 * @returns {Array<any>}
 */
export function discoverCorridorRestaurants(
  restaurants,
  routeCoordinates,
  vehicleProgressDistanceMeters = 0,
  options = {}
) {
  const maxCorridorMeters = options.maxCorridorMeters || 3000;
  const roadGraph = options.roadGraph || null;

  // 1. Corridor buffer
  const corridorMatches = filterCorridorRestaurants(restaurants, routeCoordinates, maxCorridorMeters);

  // 2. Ahead of vehicle
  const aheadMatches = filterAheadOfVehicle(corridorMatches, routeCoordinates, vehicleProgressDistanceMeters);

  // 3 & 4. Accessibility and side-of-road refinement
  return aheadMatches.map(candidate => {
    const accessInfo = determineRestaurantAccessibility(
      candidate,
      candidate.nearestRoutePoint,
      roadGraph
    );

    return {
      ...candidate,
      accessClass: accessInfo.accessClass,
      accessReason: accessInfo.accessReason,
      graphVerified: accessInfo.graphVerified,
      uTurnRequired: accessInfo.uTurnRequired
    };
  });
}
