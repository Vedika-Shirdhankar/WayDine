/**
 * @file restaurantFilter.js
 * Route corridor candidate discovery and ahead-of-vehicle progression filtering.
 * Note: Corridor is candidate selection ONLY, not the detour limit.
 */

import { pointToSegmentDistance, progressAlongRoute, findNearestPointOnPolyline } from './geoUtils.js';
import { isValidLatLng, assertPositiveNumber } from './validators.js';
import { dijkstra, RoadNetworkGraph } from './shortestPath.js';

/**
 * Filters restaurants situated within a lateral corridor distance of the route.
 *
 * @param {Array<[number, number]>} route - Polyline coordinates [lat, lng][]
 * @param {Array<import('../types/typedefs.js').Restaurant>} restaurants
 * @param {number} [corridorMeters=200] - Lateral candidate corridor buffer
 * @returns {Array<import('../types/typedefs.js').Restaurant & { distanceFromRouteMeters: number }>}
 */
export function corridorFilter(route, restaurants, corridorMeters = 200) {
  if (!Array.isArray(route) || route.length < 2) {
    throw new Error('[restaurantFilter] route must contain at least 2 points.');
  }
  if (!Array.isArray(restaurants)) {
    throw new TypeError('[restaurantFilter] restaurants must be an array.');
  }
  assertPositiveNumber(corridorMeters, 'corridorMeters');

  const candidates = [];

  for (const restaurant of restaurants) {
    if (!restaurant || !isValidLatLng(restaurant.location)) continue;

    let minDistance = Infinity;

    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i];
      const b = route[i + 1];
      const dist = pointToSegmentDistance(restaurant.location, a, b);
      if (dist < minDistance) {
        minDistance = dist;
      }
    }

    if (minDistance <= corridorMeters) {
      candidates.push({
        ...restaurant,
        distanceFromRouteMeters: Math.round(minDistance)
      });
    }
  }

  return candidates;
}

export const filterCorridorRestaurants = corridorFilter;

/**
 * Drops restaurants that are located behind the vehicle along the route.
 *
 * @param {Array<[number, number]>} route - Polyline coordinates [lat, lng][]
 * @param {[number, number]} vehiclePos - Current vehicle position [lat, lng]
 * @param {Array<any>} candidates - Filtered candidate restaurants
 * @param {number} [behindToleranceMeters=50] - Buffer to avoid flickering near vehicle
 * @returns {Array<any>}
 */
export function aheadFilter(route, vehiclePos, candidates, behindToleranceMeters = 50) {
  if (!Array.isArray(route) || route.length < 2) {
    throw new Error('[restaurantFilter] route must contain at least 2 points.');
  }
  if (!isValidLatLng(vehiclePos)) {
    throw new TypeError('[restaurantFilter] Invalid vehiclePos coordinate.');
  }
  if (!Array.isArray(candidates)) {
    throw new TypeError('[restaurantFilter] candidates must be an array.');
  }

  const vehicleProgress = progressAlongRoute(route, vehiclePos);
  const cutoffProgress = vehicleProgress - behindToleranceMeters;

  return candidates.filter(candidate => {
    const loc = candidate.location;
    if (!isValidLatLng(loc)) return false;

    const candidateProgress = progressAlongRoute(route, loc);
    return candidateProgress >= cutoffProgress;
  });
}

export const filterAheadOfVehicle = (candidates, routeCoordinates, vehicleProgressDistanceMeters) => {
  return candidates.filter(candidate => {
    const candidateProgress = progressAlongRoute(routeCoordinates, candidate.location);
    return candidateProgress >= (vehicleProgressDistanceMeters - 150);
  });
};

export function determineRestaurantAccessibility(restaurant, nearestRoutePoint, roadGraph = null) {
  if (!restaurant || !restaurant.location) {
    throw new TypeError('[restaurantFilter] Invalid restaurant object.');
  }

  if (!roadGraph || !(roadGraph instanceof RoadNetworkGraph) || roadGraph.nodes.size === 0) {
    if (restaurant.accessClass && restaurant.accessClass !== 'Unverified' && restaurant.graphVerified) {
      return {
        accessClass: restaurant.accessClass,
        accessReason: restaurant.accessReason || 'Verified via road telemetry record',
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

  const path = dijkstra(roadGraph, startNodeMatch.nodeId, targetNodeMatch.nodeId);

  if (!path) {
    return {
      accessClass: 'RED',
      accessReason: 'No legal vehicular road path found (median barrier or one-way restriction prevents entry)',
      graphVerified: true,
      uTurnRequired: true
    };
  }

  const hasUTurn = (path.uTurns || path.uTurnCount || 0) > 0;
  const turns = path.turns || path.turnCount || 0;
  const duration = path.time || path.durationSeconds || 0;

  if (!hasUTurn && turns <= 2 && duration <= 120) {
    return {
      accessClass: 'GREEN',
      accessReason: `Direct off-ramp/service road access (${turns} turns, ~${Math.round(duration / 60)} min off-route)`,
      graphVerified: true,
      uTurnRequired: false
    };
  } else if (!hasUTurn && duration <= 300) {
    return {
      accessClass: 'YELLOW',
      accessReason: `Controlled signal or overpass turn required (${turns} turns, ~${Math.round(duration / 60)} min detour)`,
      graphVerified: true,
      uTurnRequired: false
    };
  } else {
    return {
      accessClass: 'RED',
      accessReason: hasUTurn
        ? `Requires hazardous highway U-turn across median`
        : `High-friction detour (~${Math.round(duration / 60)} min off-route)`,
      graphVerified: true,
      uTurnRequired: hasUTurn
    };
  }
}

export function discoverCorridorRestaurants(restaurants, routeCoordinates, vehicleProgressDistanceMeters = 0, options = {}) {
  const maxCorridorMeters = options.maxCorridorMeters || 3000;
  const roadGraph = options.roadGraph || null;

  const corridorMatches = corridorFilter(routeCoordinates, restaurants, maxCorridorMeters);
  const aheadMatches = filterAheadOfVehicle(corridorMatches, routeCoordinates, vehicleProgressDistanceMeters);

  return aheadMatches.map(candidate => {
    const projection = findNearestPointOnPolyline(candidate.location, routeCoordinates);
    const accessInfo = determineRestaurantAccessibility(candidate, projection.nearestPoint, roadGraph);

    return {
      ...candidate,
      distanceFromRouteMeters: Math.round(projection.distanceFromRouteMeters),
      distanceAlongRouteMeters: Math.round(projection.distanceAlongRouteMeters),
      sideOfRoad: projection.sideOfRoad,
      nearestRoutePoint: projection.nearestPoint,
      accessClass: accessInfo.accessClass,
      accessReason: accessInfo.accessReason,
      graphVerified: accessInfo.graphVerified,
      uTurnRequired: accessInfo.uTurnRequired
    };
  });
}
