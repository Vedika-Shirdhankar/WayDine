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
 *   distanceMeters: number,
 *   durationSeconds: number,
 *   segments: Array<any>,
 *   source: string,
 *   dataSource: 'live-osrm' | 'demo-fallback'
 * }>}
 */
export async function calculateRouteService(src, dst, options = {}) {
  const result = await getRoute(src, dst, options);
  const dataSource = result.source === 'Live (OSRM/OSM)' ? 'live-osrm' : 'demo-fallback';
  return {
    ...result,
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
      coordinates: live.geometry,
      totalDistanceMeters: live.distanceMeters,
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
    name,
    coordinates: route.geometry,
    totalDistanceMeters: route.distanceMeters,
    totalDurationSeconds: route.durationSeconds
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
