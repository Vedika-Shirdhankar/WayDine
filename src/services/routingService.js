/**
 * @file routingService.js
 * Service layer coordinating live OSRM driving calculations and demo fallback routes.
 * Strictly annotates each response with the required data-source tag:
 * "live-osrm" or "demo-fallback".
 */

import { getRoute } from '../engine/routeEngine.js';
import { getRepository } from '../data/restaurantRepository.js';

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

export { calculateRouteService as loadRoute };
