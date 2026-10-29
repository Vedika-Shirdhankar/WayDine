/**
 * @file routingService.js
 * Service layer coordinating live OSRM driving calculations and demo fallback routes.
 * Strictly annotates each response with the required data-source tag:
 * "live-osrm" or "demo-fallback".
 */

import { getRoute, fetchOsrmRoute } from '../engine/routeEngine.js';
import { getRepository, getRoutes, getRouteById } from '../data/restaurantRepository.js';

/**
 * Calculates or retrieves driving route between source and destination coordinates.
 * Returns route object with data-source tag: "live-osrm" or "demo-fallback".
 *
 * @param {[number, number]} src - [lat, lng]
 * @param {[number, number]} dst - [lat, lng]
 * @param {Object} [options]
 * @param {boolean} [options.forceOffline=false]
 * @returns {Promise<{
 *   geometry: Array<[number, number]>,
 *   coordinates: Array<[number, number]>,
 *   distanceMeters: number,
 *   totalDistanceMeters: number,
 *   durationSeconds: number,
 *   totalDurationSeconds: number,
 *   segments: Array<any>,
 *   source: string,
 *   dataSource: 'live-osrm' | 'demo-fallback'
 * }>}
 */
export async function calculateRouteService(src, dst, options = {}) {
  const result = await getRoute(src, dst, options);
  const dataSource = result.source === 'Live (OSRM/OSM)' ? 'live-osrm' : 'demo-fallback';
  const coords = result.geometry || result.coordinates || [];
  const dist = result.distanceMeters ?? result.totalDistanceMeters ?? 0;
  const dur = result.durationSeconds ?? result.totalDurationSeconds ?? 0;

  return {
    ...result,
    id: result.id || `route-${Date.now()}`,
    geometry: coords,
    coordinates: coords,
    distanceMeters: dist,
    totalDistanceMeters: dist,
    durationSeconds: dur,
    totalDurationSeconds: dur,
    dataSource
  };
}

/**
 * Loads a route preset by route ID, optionally attempting live OSRM calculation.
 *
 * @param {string} routeId
 * @param {boolean} [forceOffline=false]
 * @returns {Promise<any>}
 */
export async function loadRoute(routeId, forceOffline = false) {
  if (Array.isArray(routeId) && Array.isArray(forceOffline)) {
    // Called with (src, dst)
    return calculateRouteService(routeId, forceOffline);
  }

  const preset = await getRouteById(routeId);

  if (forceOffline || !preset.startPoint || !preset.endPoint) {
    return {
      ...preset,
      dataSource: 'demo-fallback'
    };
  }

  try {
    const live = await fetchOsrmRoute(
      preset.startPoint.location,
      preset.endPoint.location,
      { timeoutMs: 5000 }
    );
    return {
      ...preset,
      geometry: live.geometry,
      coordinates: live.geometry,
      distanceMeters: live.distanceMeters,
      totalDistanceMeters: live.distanceMeters,
      durationSeconds: live.durationSeconds,
      totalDurationSeconds: live.durationSeconds,
      source: 'Live (OSRM/OSM)',
      dataSource: 'live-osrm'
    };
  } catch (err) {
    return {
      ...preset,
      dataSource: 'demo-fallback'
    };
  }
}

/**
 * Calculates custom route between arbitrary points.
 *
 * @param {[number, number]} startCoord
 * @param {[number, number]} endCoord
 * @param {string} [name='Custom Highway Trip']
 * @returns {Promise<any>}
 */
export async function calculateCustomRoute(startCoord, endCoord, name = 'Custom Highway Trip') {
  const route = await calculateRouteService(startCoord, endCoord);
  return {
    ...route,
    id: `custom-${Date.now()}`,
    name
  };
}

/**
 * Loads the Mumbai -> Pune demo route from the repository.
 *
 * @returns {Promise<any>}
 */
export async function getDemoRouteService() {
  const repo = getRepository();
  if (typeof repo.getDemoRoute === 'function') {
    const demo = await repo.getDemoRoute();
    return {
      ...demo,
      dataSource: 'demo-fallback'
    };
  }
  return null;
}
