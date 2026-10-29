/**
 * @file routingService.js
 * Service layer coordinating live OSRM routing and fallback synthetic routes.
 * Ensures the app operates seamlessly offline or online with zero configuration.
 */

import { fetchOsrmRoute, generateSyntheticCorridorRoute } from '../engine/routeEngine.js';
import { getRoutes } from '../data/restaurantRepository.js';

/**
 * Loads route by ID or coordinates.
 * Tries public OSRM API first; if unavailable or offline, uses curated preset.
 *
 * @param {string} routeId
 * @param {boolean} [forceOffline=false]
 * @returns {Promise<import('../types/typedefs.js').Route>}
 */
export async function loadRoute(routeId, forceOffline = false) {
  const routes = await getRoutes();
  const preset = routes.find(r => r.id === routeId) || routes[0];

  if (forceOffline) {
    return preset;
  }

  // Try live OSRM route calculation using preset start & end points
  try {
    const liveRoute = await fetchOsrmRoute(
      preset.startPoint.location,
      preset.endPoint.location,
      [],
      { timeoutMs: 5000 }
    );
    return {
      ...liveRoute,
      id: preset.id,
      name: `${preset.name} (Live OSRM)`
    };
  } catch (error) {
    console.warn(`[routingService] Falling back to precomputed high-fidelity corridor for "${preset.name}".`);
    return preset;
  }
}

/**
 * Calculates a custom route between arbitrary start and end coordinates.
 *
 * @param {[number, number]} startCoord
 * @param {[number, number]} endCoord
 * @param {string} [name='Custom Highway Trip']
 * @returns {Promise<import('../types/typedefs.js').Route>}
 */
export async function calculateCustomRoute(startCoord, endCoord, name = 'Custom Trip') {
  try {
    const liveRoute = await fetchOsrmRoute(startCoord, endCoord, [], { timeoutMs: 6000 });
    return liveRoute;
  } catch (err) {
    console.warn('[routingService] OSRM query failed for custom coordinates, generating synthetic route.');
    return generateSyntheticCorridorRoute(startCoord, endCoord, `${name} (Simulated)`);
  }
}
