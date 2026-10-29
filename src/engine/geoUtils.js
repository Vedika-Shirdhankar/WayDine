/**
 * @file geoUtils.js
 * Geospatial mathematics and spherical geometry utilities for route corridor analysis.
 * Units: meters for distance, degrees for angles/bearings, [lat, lng] for coordinates.
 * Pure deterministic mathematical functions with zero external dependencies.
 */

const EARTH_RADIUS_METERS = 6371000;

/**
 * Validates a [lat, lng] coordinate pair.
 * Throws descriptive Error if invalid.
 * @param {any} coord - Expected [lat, lng] array
 * @param {string} [name='coordinate'] - Variable name for error context
 * @throws {TypeError|RangeError}
 */
export function validateLatLng(coord, name = 'coordinate') {
  if (!Array.isArray(coord) || coord.length < 2) {
    throw new TypeError(`[geoUtils] ${name} must be an array of [latitude, longitude]. Received: ${JSON.stringify(coord)}`);
  }
  const [lat, lng] = coord;
  if (typeof lat !== 'number' || Number.isNaN(lat) || !Number.isFinite(lat)) {
    throw new TypeError(`[geoUtils] ${name}[0] (latitude) must be a finite number. Received: ${lat}`);
  }
  if (typeof lng !== 'number' || Number.isNaN(lng) || !Number.isFinite(lng)) {
    throw new TypeError(`[geoUtils] ${name}[1] (longitude) must be a finite number. Received: ${lng}`);
  }
  if (lat < -90 || lat > 90) {
    throw new RangeError(`[geoUtils] ${name} latitude out of bounds [-90, 90]: ${lat}`);
  }
  if (lng < -180 || lng > 180) {
    throw new RangeError(`[geoUtils] ${name} longitude out of bounds [-180, 180]: ${lng}`);
  }
}

/**
 * Converts degrees to radians.
 * @param {number} deg
 * @returns {number}
 */
export function degreesToRadians(deg) {
  if (typeof deg !== 'number' || Number.isNaN(deg)) {
    throw new TypeError(`[geoUtils] Expected valid number for degrees, received: ${deg}`);
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
    throw new TypeError(`[geoUtils] Expected valid number for radians, received: ${rad}`);
  }
  return (rad * 180) / Math.PI;
}

/**
 * Computes great-circle distance between two coordinates using the Haversine formula.
 * @param {[number, number]} coordA - [lat, lng]
 * @param {[number, number]} coordB - [lat, lng]
 * @returns {number} Distance in meters
 */
export function haversineDistanceMeters(coordA, coordB) {
  validateLatLng(coordA, 'coordA');
  validateLatLng(coordB, 'coordB');

  const [lat1, lng1] = coordA;
  const [lat2, lng2] = coordB;

  const phi1 = degreesToRadians(lat1);
  const phi2 = degreesToRadians(lat2);
  const deltaPhi = degreesToRadians(lat2 - lat1);
  const deltaLambda = degreesToRadians(lng2 - lng1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Computes initial compass bearing from start to destination in degrees [0, 360).
 * 0° = North, 90° = East, 180° = South, 270° = West.
 * @param {[number, number]} startCoord - [lat, lng]
 * @param {[number, number]} destCoord - [lat, lng]
 * @returns {number} Bearing in degrees from 0 to 359.999...
 */
export function bearingDegrees(startCoord, destCoord) {
  validateLatLng(startCoord, 'startCoord');
  validateLatLng(destCoord, 'destCoord');

  const [lat1, lng1] = startCoord;
  const [lat2, lng2] = destCoord;

  const phi1 = degreesToRadians(lat1);
  const phi2 = degreesToRadians(lat2);
  const deltaLambda = degreesToRadians(lng2 - lng1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  return (radiansToDegrees(theta) + 360) % 360;
}

/**
 * Computes cross-track distance from a point to a great-circle path from segmentStart to segmentEnd.
 * Sign indicates side of route: positive = right of path, negative = left of path.
 * @param {[number, number]} point - [lat, lng] of candidate point
 * @param {[number, number]} segmentStart - [lat, lng] of path start
 * @param {[number, number]} segmentEnd - [lat, lng] of path end
 * @returns {number} Signed cross-track distance in meters
 */
export function crossTrackDistanceMeters(point, segmentStart, segmentEnd) {
  validateLatLng(point, 'point');
  validateLatLng(segmentStart, 'segmentStart');
  validateLatLng(segmentEnd, 'segmentEnd');

  const distToStartMeters = haversineDistanceMeters(segmentStart, point);
  if (distToStartMeters < 0.1) return 0;

  const bearing13 = degreesToRadians(bearingDegrees(segmentStart, point));
  const bearing12 = degreesToRadians(bearingDegrees(segmentStart, segmentEnd));

  const d13 = distToStartMeters / EARTH_RADIUS_METERS;
  const dXt = Math.asin(Math.sin(d13) * Math.sin(bearing13 - bearing12));

  return dXt * EARTH_RADIUS_METERS;
}

/**
 * Projects a point onto a line segment [segmentStart, segmentEnd] on the spherical surface.
 * Clamps projection to the segment boundaries.
 * @param {[number, number]} point - [lat, lng]
 * @param {[number, number]} segmentStart - [lat, lng]
 * @param {[number, number]} segmentEnd - [lat, lng]
 * @returns {{ projectedPoint: [number, number], fraction: number, perpendicularDistanceMeters: number }}
 */
export function projectPointOnSegment(point, segmentStart, segmentEnd) {
  validateLatLng(point, 'point');
  validateLatLng(segmentStart, 'segmentStart');
  validateLatLng(segmentEnd, 'segmentEnd');

  const segLengthMeters = haversineDistanceMeters(segmentStart, segmentEnd);
  if (segLengthMeters === 0) {
    return {
      projectedPoint: [segmentStart[0], segmentStart[1]],
      fraction: 0,
      perpendicularDistanceMeters: haversineDistanceMeters(point, segmentStart)
    };
  }

  // Use local equirectangular flat-earth approximation for sub-100km segments
  const [lat0, lng0] = segmentStart;
  const [lat1, lng1] = segmentEnd;
  const [pLat, pLng] = point;

  const midLatRad = degreesToRadians((lat0 + lat1) / 2);
  const cosLat = Math.cos(midLatRad);

  // Vector v from segmentStart to segmentEnd in local meter coordinates
  const vx = (lng1 - lng0) * (Math.PI / 180) * EARTH_RADIUS_METERS * cosLat;
  const vy = (lat1 - lat0) * (Math.PI / 180) * EARTH_RADIUS_METERS;

  // Vector w from segmentStart to point in local meter coordinates
  const wx = (pLng - lng0) * (Math.PI / 180) * EARTH_RADIUS_METERS * cosLat;
  const wy = (pLat - lat0) * (Math.PI / 180) * EARTH_RADIUS_METERS;

  const dot = wx * vx + wy * vy;
  const lenSq = vx * vx + vy * vy;
  const fraction = Math.max(0, Math.min(1, dot / lenSq));

  const projLat = lat0 + fraction * (lat1 - lat0);
  const projLng = lng0 + fraction * (lng1 - lng0);
  const projectedPoint = [projLat, projLng];

  const perpendicularDistanceMeters = haversineDistanceMeters(point, projectedPoint);

  return {
    projectedPoint,
    fraction,
    perpendicularDistanceMeters
  };
}

/**
 * Finds the closest point on a dense polyline of coordinates to the candidate point.
 * Computes the along-route distance in meters from start of polyline to the projection point.
 * @param {[number, number]} point - [lat, lng]
 * @param {[number, number][]} polylineCoordinates - Array of [lat, lng]
 * @returns {{
 *   nearestPoint: [number, number],
 *   distanceFromRouteMeters: number,
 *   segmentIndex: number,
 *   distanceAlongRouteMeters: number,
 *   sideOfRoad: 'right' | 'left'
 * }}
 */
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

  // Precompute segment cumulative distances
  for (let i = 0; i < polylineCoordinates.length - 1; i++) {
    const p1 = polylineCoordinates[i];
    const p2 = polylineCoordinates[i + 1];
    const segLengthMeters = haversineDistanceMeters(p1, p2);

    const { projectedPoint, fraction, perpendicularDistanceMeters } = projectPointOnSegment(point, p1, p2);

    if (perpendicularDistanceMeters < minDistanceMeters) {
      minDistanceMeters = perpendicularDistanceMeters;
      bestNearestPoint = projectedPoint;
      bestSegmentIndex = i;
      bestDistanceAlongRouteMeters = cumulativeDistMeters + fraction * segLengthMeters;

      // Determine side of road using crossTrack
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

/**
 * Computes the total cumulative length of a polyline in meters.
 * @param {[number, number][]} polyline - Array of [lat, lng]
 * @returns {number} Total distance in meters
 */
export function computePolylineDistanceMeters(polyline) {
  if (!Array.isArray(polyline) || polyline.length < 2) return 0;
  let totalMeters = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    totalMeters += haversineDistanceMeters(polyline[i], polyline[i + 1]);
  }
  return totalMeters;
}

/**
 * Determines whether a restaurant location is ahead of the vehicle along the planned route.
 * @param {[number, number]} candidatePoint - [lat, lng]
 * @param {[number, number][]} routeCoordinates - Polyline of [lat, lng]
 * @param {number} vehicleProgressDistanceMeters - Current vehicle distance from route start
 * @param {number} [bufferBehindMeters=150] - Small tolerance buffer behind vehicle to prevent flickering at turns
 * @returns {boolean} True if ahead of vehicle
 */
export function isAheadOfVehicle(
  candidatePoint,
  routeCoordinates,
  vehicleProgressDistanceMeters,
  bufferBehindMeters = 150
) {
  validateLatLng(candidatePoint, 'candidatePoint');
  if (typeof vehicleProgressDistanceMeters !== 'number' || Number.isNaN(vehicleProgressDistanceMeters)) {
    throw new TypeError(`[geoUtils] vehicleProgressDistanceMeters must be a valid number. Received: ${vehicleProgressDistanceMeters}`);
  }

  const { distanceAlongRouteMeters } = findNearestPointOnPolyline(candidatePoint, routeCoordinates);
  return distanceAlongRouteMeters >= (vehicleProgressDistanceMeters - bufferBehindMeters);
}

/**
 * Interpolates vehicle position along polyline at a given distance in meters from start.
 * @param {[number, number][]} polyline - Array of [lat, lng]
 * @param {number} targetDistanceMeters - Desired distance along route
 * @returns {{ position: [number, number], bearing: number, segmentIndex: number }}
 */
export function interpolatePositionAlongRoute(polyline, targetDistanceMeters) {
  if (!Array.isArray(polyline) || polyline.length < 2) {
    throw new Error('[geoUtils] polyline must have at least 2 points.');
  }

  const totalLength = computePolylineDistanceMeters(polyline);
  const clampedTarget = Math.max(0, Math.min(targetDistanceMeters, totalLength));

  let accumulatedMeters = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = polylineCoordinatesOrDefault(polyline[i]);
    const p2 = polylineCoordinatesOrDefault(polyline[i + 1]);
    const segLength = haversineDistanceMeters(p1, p2);

    if (accumulatedMeters + segLength >= clampedTarget || i === polyline.length - 2) {
      const remaining = clampedTarget - accumulatedMeters;
      const fraction = segLength > 0 ? Math.max(0, Math.min(1, remaining / segLength)) : 0;
      const lat = p1[0] + fraction * (p2[0] - p1[0]);
      const lng = p1[1] + fraction * (p2[1] - p1[1]);
      const bearing = bearingDegrees(p1, p2);

      return {
        position: [lat, lng],
        bearing,
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

function polylineCoordinatesOrDefault(pt) {
  validateLatLng(pt, 'polyline coordinate');
  return pt;
}
