/**
 * @file routeEngine.js
 * Route segment calculation and OSRM integration with demo fallback.
 */

import { haversine, bearing } from './geoUtils.js';
import { isValidLatLng } from './validators.js';

export class OsrmError extends Error {
  constructor(message, type = 'OsrmError') {
    super(message);
    this.name = type;
  }
}

export class OsrmTimeoutError extends OsrmError {
  constructor(message = 'OSRM request timed out') {
    super(message, 'OsrmTimeoutError');
  }
}

export class OsrmNetworkError extends OsrmError {
  constructor(message = 'OSRM network connection failed') {
    super(message, 'OsrmNetworkError');
  }
}

export class OsrmRouteNotFoundError extends OsrmError {
  constructor(message = 'No driving route found between coordinates') {
    super(message, 'OsrmRouteNotFoundError');
  }
}

/**
 * Builds ordered segments from an array of coordinates with cumulative distances.
 *
 * @param {Array<[number, number]>} coords - Array of [lat, lng]
 * @returns {Array<import('../types/typedefs.js').RouteSegment>}
 */
export function buildSegments(coords) {
  if (!Array.isArray(coords) || coords.length < 2) {
    throw new Error('[routeEngine] coords must contain at least 2 points.');
  }

  const segments = [];
  let cumulativeDistanceMeters = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const start = coords[i];
    const end = coords[i + 1];

    if (!isValidLatLng(start) || !isValidLatLng(end)) {
      throw new TypeError(`[routeEngine] Invalid coordinate at index ${i}`);
    }

    const distanceMeters = Math.round(haversine(start, end));
    cumulativeDistanceMeters += distanceMeters;

    segments.push({
      start,
      end,
      distanceMeters,
      cumulativeDistanceMeters,
      segmentIndex: i,
      bearing: Math.round(bearing(start, end) * 10) / 10
    });
  }

  return segments;
}

/**
 * Bundled high-fidelity highway demo route (US-101 Corridor) used for offline / zero-network mode.
 */
export const BUNDLED_DEMO_ROUTE = [
  [37.6213, -122.3790], // SFO Corridor
  [37.5630, -122.3255], // San Mateo
  [37.5338, -122.2890], // Belmont
  [37.4852, -122.2364], // Redwood City
  [37.4419, -122.1430], // Palo Alto
  [37.4138, -122.0800]  // Mountain View
];

/**
 * Fetches driving route from public OSRM API.
 * Converts GeoJSON [lng, lat] to standard [lat, lng].
 *
 * @param {[number, number]} src - [lat, lng]
 * @param {[number, number]} dst - [lat, lng]
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=5000]
 * @returns {Promise<{
 *   geometry: Array<[number, number]>,
 *   distanceMeters: number,
 *   durationSeconds: number,
 *   source: string
 * }>}
 */
export async function fetchOsrmRoute(src, dst, options = {}) {
  if (!isValidLatLng(src) || !isValidLatLng(dst)) {
    throw new TypeError('[routeEngine] Invalid source or destination coordinate.');
  }

  const timeoutMs = options.timeoutMs || 5000;
  const url = `https://router.project-osrm.org/route/v1/driving/${src[1]},${src[0]};${dst[1]},${dst[0]}?overview=full&geometries=geojson&steps=false`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) {
      throw new OsrmNetworkError(`OSRM HTTP status ${response.status}`);
    }

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
      throw new OsrmRouteNotFoundError();
    }

    const primary = data.routes[0];
    const geometry = primary.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    return {
      geometry,
      distanceMeters: Math.round(primary.distance),
      durationSeconds: Math.round(primary.duration),
      source: 'Live (OSRM/OSM)'
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new OsrmTimeoutError(`OSRM request timed out after ${timeoutMs}ms`);
    }
    if (err instanceof OsrmError) {
      throw err;
    }
    throw new OsrmNetworkError(err.message || 'Network request failed');
  }
}

/**
 * High-level route loader. Tries OSRM, falls back cleanly to bundled demo route.
 *
 * @param {[number, number]} src
 * @param {[number, number]} dst
 * @param {Object} [options]
 * @param {boolean} [options.forceOffline=false]
 * @returns {Promise<{
 *   geometry: Array<[number, number]>,
 *   distanceMeters: number,
 *   durationSeconds: number,
 *   segments: Array<import('../types/typedefs.js').RouteSegment>,
 *   source: 'Live (OSRM/OSM)' | 'demo-fallback'
 * }>}
 */
export async function getRoute(src, dst, options = {}) {
  if (options.forceOffline) {
    const segments = buildSegments(BUNDLED_DEMO_ROUTE);
    const totalDist = segments[segments.length - 1].cumulativeDistanceMeters;
    return {
      geometry: BUNDLED_DEMO_ROUTE,
      distanceMeters: totalDist,
      durationSeconds: Math.round(totalDist / 25), // 90 km/h
      segments,
      source: 'demo-fallback'
    };
  }

  try {
    const live = await fetchOsrmRoute(src, dst, options);
    const segments = buildSegments(live.geometry);
    return {
      ...live,
      segments
    };
  } catch (err) {
    const segments = buildSegments(BUNDLED_DEMO_ROUTE);
    const totalDist = segments[segments.length - 1].cumulativeDistanceMeters;
    return {
      geometry: BUNDLED_DEMO_ROUTE,
      distanceMeters: totalDist,
      durationSeconds: Math.round(totalDist / 25),
      segments,
      source: 'demo-fallback'
    };
  }
}
