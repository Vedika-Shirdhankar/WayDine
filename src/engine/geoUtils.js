/**
 * @file geoUtils.js
 * Geospatial mathematics and spherical geometry utilities.
 * Units: meters for distance, degrees for angles/bearings, [lat, lng] for coordinates.
 * Pure deterministic mathematical functions with zero external dependencies.
 */

import { isValidLatLng } from './validators.js';

export const EARTH_RADIUS_METERS = 6371000;

/**
 * Asserts coordinate validity using isValidLatLng.
 * @param {[number, number]} coord
 * @param {string} [name='coordinate']
 */
export function validateLatLng(coord, name = 'coordinate') {
  if (!isValidLatLng(coord)) {
    if (Array.isArray(coord) && coord.length >= 2) {
      const [lat, lng] = coord;
      if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
        throw new TypeError(`[geoUtils] ${name} coordinates must be finite numbers.`);
      }
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw new RangeError(`[geoUtils] ${name} coordinates out of bounds.`);
      }
    }
    throw new TypeError(`[geoUtils] Invalid ${name}: ${JSON.stringify(coord)}`);
  }
}

/**
 * Converts degrees to radians.
 * @param {number} deg
 * @returns {number}
 */
export function degreesToRadians(deg) {
  if (typeof deg !== 'number' || Number.isNaN(deg)) {
    throw new TypeError(`[geoUtils] Expected number for degrees, received: ${deg}`);
  }
  return (deg * Math.PI) / 180;
}

/**
 * Converts radians to degrees.
 * @param {number} rad
 * @returns {number}
 */
export function radiansToDegrees(rad) {
  if (typeof rad !== 'number' || Number.isNaN(rad)) {
    throw new TypeError(`[geoUtils] Expected number for radians, received: ${rad}`);
  }
  return (rad * 180) / Math.PI;
}

/**
 * Computes great-circle distance between two coordinates using the Haversine formula.
 * @param {[number, number]} a - [lat, lng]
 * @param {[number, number]} b - [lat, lng]
 * @returns {number} Distance in meters
 */
export function haversine(a, b) {
  validateLatLng(a, 'a');
  validateLatLng(b, 'b');

  const [lat1, lng1] = a;
  const [lat2, lng2] = b;

  if (lat1 === lat2 && lng1 === lng2) return 0;

  const phi1 = degreesToRadians(lat1);
  const phi2 = degreesToRadians(lat2);
  const deltaPhi = degreesToRadians(lat2 - lat1);
  const deltaLambda = degreesToRadians(lng2 - lng1);

  const sinDeltaPhi = Math.sin(deltaPhi / 2);
  const sinDeltaLambda = Math.sin(deltaLambda / 2);

  const h = sinDeltaPhi * sinDeltaPhi + Math.cos(phi1) * Math.cos(phi2) * sinDeltaLambda * sinDeltaLambda;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));

  return EARTH_RADIUS_METERS * c;
}

export const haversineDistanceMeters = haversine;

/**
 * Computes initial compass bearing from start to destination in degrees [0, 360).
 * 0° = North, 90° = East, 180° = South, 270° = West.
 * @param {[number, number]} a - Start [lat, lng]
 * @param {[number, number]} b - Destination [lat, lng]
 * @returns {number} Bearing in degrees from 0 to 359.999...
 */
export function bearing(a, b) {
  validateLatLng(a, 'a');
  validateLatLng(b, 'b');

  const [lat1, lng1] = a;
  const [lat2, lng2] = b;

  const phi1 = degreesToRadians(lat1);
  const phi2 = degreesToRadians(lat2);
  const deltaLambda = degreesToRadians(lng2 - lng1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  const deg = (radiansToDegrees(theta) + 360) % 360;

  return Math.abs(deg - 360) < 1e-10 ? 0 : deg;
}

export const bearingDegrees = bearing;

/**
 * Computes the shortest distance from point p to segment [a, b] in meters.
 * Uses local equirectangular projection and clamps the projection to the segment.
 *
 * @param {[number, number]} p - Candidate point [lat, lng]
 * @param {[number, number]} a - Segment start [lat, lng]
 * @param {[number, number]} b - Segment end [lat, lng]
 * @returns {number} Distance in meters
 */
export function pointToSegmentDistance(p, a, b) {
  validateLatLng(p, 'p');
  validateLatLng(a, 'a');
  validateLatLng(b, 'b');

  const [lat0, lng0] = a;
  const [lat1, lng1] = b;
  const [pLat, pLng] = p;

  if (lat0 === lat1 && lng0 === lng1) {
    return haversine(p, a);
  }

  const midLat = degreesToRadians((lat0 + lat1) / 2);
  const cosLat = Math.cos(midLat);

  const vx = (lng1 - lng0) * (Math.PI / 180) * EARTH_RADIUS_METERS * cosLat;
  const vy = (lat1 - lat0) * (Math.PI / 180) * EARTH_RADIUS_METERS;

  const wx = (pLng - lng0) * (Math.PI / 180) * EARTH_RADIUS_METERS * cosLat;
  const wy = (pLat - lat0) * (Math.PI / 180) * EARTH_RADIUS_METERS;

  const lenSq = vx * vx + vy * vy;
  if (lenSq === 0) {
    return haversine(p, a);
  }

  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / lenSq));

  const projLat = lat0 + t * (lat1 - lat0);
  const projLng = lng0 + t * (lng1 - lng0);

  return haversine(p, [projLat, projLng]);
}

/**
 * Projects point on segment and returns projection details.
 */
export function projectPointOnSegment(point, segmentStart, segmentEnd) {
  validateLatLng(point, 'point');
  validateLatLng(segmentStart, 'segmentStart');
  validateLatLng(segmentEnd, 'segmentEnd');

  const [lat0, lng0] = segmentStart;
  const [lat1, lng1] = segmentEnd;
  const [pLat, pLng] = point;

  if (lat0 === lat1 && lng0 === lng1) {
    return {
      projectedPoint: [lat0, lng0],
      fraction: 0,
      perpendicularDistanceMeters: haversine(point, segmentStart)
    };
  }

  const midLat = degreesToRadians((lat0 + lat1) / 2);
  const cosLat = Math.cos(midLat);

  const vx = (lng1 - lng0) * (Math.PI / 180) * EARTH_RADIUS_METERS * cosLat;
  const vy = (lat1 - lat0) * (Math.PI / 180) * EARTH_RADIUS_METERS;

  const wx = (pLng - lng0) * (Math.PI / 180) * EARTH_RADIUS_METERS * cosLat;
  const wy = (pLat - lat0) * (Math.PI / 180) * EARTH_RADIUS_METERS;

  const lenSq = vx * vx + vy * vy;
  const fraction = lenSq > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / lenSq)) : 0;

  const projLat = lat0 + fraction * (lat1 - lat0);
  const projLng = lng0 + fraction * (lng1 - lng0);
  const projectedPoint = [projLat, projLng];

  return {
    projectedPoint,
    fraction,
    perpendicularDistanceMeters: haversine(point, projectedPoint)
  };
}

/**
 * Signed cross-track distance in meters.
 */
export function crossTrackDistanceMeters(point, segmentStart, segmentEnd) {
  validateLatLng(point, 'point');
  validateLatLng(segmentStart, 'segmentStart');
  validateLatLng(segmentEnd, 'segmentEnd');

  const distToStartMeters = haversine(segmentStart, point);
  if (distToStartMeters < 0.1) return 0;

  const bearing13 = degreesToRadians(bearing(segmentStart, point));
  const bearing12 = degreesToRadians(bearing(segmentStart, segmentEnd));

  const d13 = distToStartMeters / EARTH_RADIUS_METERS;
  const dXt = Math.asin(Math.sin(d13) * Math.sin(bearing13 - bearing12));

  return dXt * EARTH_RADIUS_METERS;
}

/**
 * Determines whether a point lies to the left, right, or on-route relative to a directed segment.
 *
 * @param {[number, number]} segStart - [lat, lng]
 * @param {[number, number]} segEnd - [lat, lng]
 * @param {[number, number]} point - [lat, lng]
 * @returns {'left' | 'right' | 'on-route'}
 */
export function crossProductSide(segStart, segEnd, point) {
  const dXt = crossTrackDistanceMeters(point, segStart, segEnd);
  if (Math.abs(dXt) < 0.5) return 'on-route';
  return dXt >= 0 ? 'right' : 'left';
}

/**
 * Computes the cumulative distance along a route polyline to the closest point of approach for candidate point.
 *
 * @param {[number, number][]} route - Array of [lat, lng] coordinates
 * @param {[number, number]} point - Candidate point [lat, lng]
 * @returns {number} Distance along route in meters
 */
export function progressAlongRoute(route, point) {
  if (!Array.isArray(route) || route.length < 2) {
    throw new Error('[geoUtils] route must contain at least 2 points.');
  }
  validateLatLng(point, 'point');

  let minDistanceMeters = Infinity;
  let bestProgressMeters = 0;
  let cumulativeDistMeters = 0;

  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    validateLatLng(a, `route[${i}]`);
    validateLatLng(b, `route[${i + 1}]`);

    const segLength = haversine(a, b);
    const { projectedPoint, fraction, perpendicularDistanceMeters } = projectPointOnSegment(point, a, b);

    if (perpendicularDistanceMeters < minDistanceMeters) {
      minDistanceMeters = perpendicularDistanceMeters;
      bestProgressMeters = cumulativeDistMeters + fraction * segLength;
    }

    cumulativeDistMeters += segLength;
  }

  return bestProgressMeters;
}

export function findNearestPointOnPolyline(point, polylineCoordinates) {
  validateLatLng(point, 'point');
  if (!Array.isArray(polylineCoordinates) || polylineCoordinates.length < 2) {
    throw new Error('[geoUtils] polylineCoordinates must contain at least 2 points.');
  }

  let minDistanceMeters = Infinity;
  let bestNearestPoint = polylineCoordinates[0];
  let bestSegmentIndex = 0;
  let bestDistanceAlongRouteMeters = 0;
  let cumulativeDistMeters = 0;
  let bestSide = 'right';

  for (let i = 0; i < polylineCoordinates.length - 1; i++) {
    const p1 = polylineCoordinates[i];
    const p2 = polylineCoordinates[i + 1];
    const segLengthMeters = haversine(p1, p2);

    const { projectedPoint, fraction, perpendicularDistanceMeters } = projectPointOnSegment(point, p1, p2);

    if (perpendicularDistanceMeters < minDistanceMeters) {
      minDistanceMeters = perpendicularDistanceMeters;
      bestNearestPoint = projectedPoint;
      bestSegmentIndex = i;
      bestDistanceAlongRouteMeters = cumulativeDistMeters + fraction * segLengthMeters;
      const crossTrack = crossTrackDistanceMeters(point, p1, p2);
      bestSide = crossTrack >= 0 ? 'right' : 'left';
    }

    cumulativeDistMeters += segLengthMeters;
  }

  return {
    nearestPoint: bestNearestPoint,
    distanceFromRouteMeters: minDistanceMeters,
    segmentIndex: bestSegmentIndex,
    distanceAlongRouteMeters: bestDistanceAlongRouteMeters,
    sideOfRoad: bestSide
  };
}

export function computePolylineDistanceMeters(polyline) {
  if (!Array.isArray(polyline) || polyline.length < 2) return 0;
  let totalMeters = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    totalMeters += haversine(polyline[i], polyline[i + 1]);
  }
  return totalMeters;
}

export function isAheadOfVehicle(candidatePoint, routeCoordinates, vehicleProgressDistanceMeters, bufferBehindMeters = 150) {
  validateLatLng(candidatePoint, 'candidatePoint');
  const { distanceAlongRouteMeters } = findNearestPointOnPolyline(candidatePoint, routeCoordinates);
  return distanceAlongRouteMeters >= (vehicleProgressDistanceMeters - bufferBehindMeters);
}

export function interpolatePositionAlongRoute(polyline, targetDistanceMeters) {
  if (!Array.isArray(polyline) || polyline.length < 2) {
    throw new Error('[geoUtils] polyline must have at least 2 points.');
  }

  const totalLength = computePolylineDistanceMeters(polyline);
  const clampedTarget = Math.max(0, Math.min(targetDistanceMeters, totalLength));

  let accumulatedMeters = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = polyline[i];
    const p2 = polyline[i + 1];
    const segLength = haversine(p1, p2);

    if (accumulatedMeters + segLength >= clampedTarget || i === polyline.length - 2) {
      const remaining = clampedTarget - accumulatedMeters;
      const fraction = segLength > 0 ? Math.max(0, Math.min(1, remaining / segLength)) : 0;
      const lat = p1[0] + fraction * (p2[0] - p1[0]);
      const lng = p1[1] + fraction * (p2[1] - p1[1]);
      const b = bearing(p1, p2);

      return {
        position: [lat, lng],
        bearing: b,
        segmentIndex: i
      };
    }

    accumulatedMeters += segLength;
  }

  const last = polyline[polyline.length - 1];
  return {
    position: [last[0], last[1]],
    bearing: 0,
    segmentIndex: polyline.length - 2
  };
}
