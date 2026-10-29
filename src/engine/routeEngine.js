/**
 * @file routeEngine.js
 * Driving route calculation engine interfacing with public OSRM (OpenStreetMap) service
 * with robust offline fallback routes.
 *
 * All coordinates returned are strictly converted to [lat, lng] format.
 * All units are standardized to distanceMeters and durationSeconds.
 * Provenance is explicitly labeled: "Live (OSRM/OSM)" or "Sample/Demo".
 */

import { validateLatLng, haversineDistanceMeters } from './geoUtils.js';

const OSRM_PUBLIC_ENDPOINT = 'https://router.project-osrm.org/route/v1/driving';

/**
 * Fetches driving route from public OSRM API.
 * Converts GeoJSON [lng, lat] to standard WayDine [lat, lng].
 *
 * @param {[number, number]} startCoord - [lat, lng]
 * @param {[number, number]} endCoord - [lat, lng]
 * @param {Array<[number, number]>} [waypoints=[]] - Optional intermediate [lat, lng]
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=8000]
 * @returns {Promise<import('../types/typedefs.js').Route>}
 */
export async function fetchOsrmRoute(startCoord, endCoord, waypoints = [], options = {}) {
  validateLatLng(startCoord, 'startCoord');
  validateLatLng(endCoord, 'endCoord');
  if (Array.isArray(waypoints)) {
    waypoints.forEach((wp, idx) => validateLatLng(wp, `waypoint[${idx}]`));
  }

  const allPoints = [startCoord, ...waypoints, endCoord];
  // OSRM expects coordinates in "lng,lat" format separated by semicolon
  const coordParam = allPoints.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const url = `${OSRM_PUBLIC_ENDPOINT}/${coordParam}?overview=full&geometries=geojson&steps=true&annotations=false`;

  const timeoutMs = options.timeoutMs || 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`OSRM HTTP error: status ${response.status}`);
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      throw new Error('OSRM returned no route paths.');
    }

    const primaryRoute = data.routes[0];

    // OSRM GeoJSON is [lng, lat], convert to [lat, lng]
    const coordinates = primaryRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    const steps = [];
    if (primaryRoute.legs) {
      for (const leg of primaryRoute.legs) {
        if (leg.steps) {
          for (const s of leg.steps) {
            steps.push({
              instruction: s.maneuver ? `${s.maneuver.type || 'turn'} ${s.maneuver.modifier || ''} on ${s.name || 'road'}`.trim() : 'Proceed',
              distanceMeters: Math.round(s.distance || 0),
              durationSeconds: Math.round(s.duration || 0),
              name: s.name || 'Highway',
              maneuver: {
                type: s.maneuver?.type || 'turn',
                modifier: s.maneuver?.modifier || 'straight',
                location: s.maneuver?.location ? [s.maneuver.location[1], s.maneuver.location[0]] : [0, 0]
              }
            });
          }
        }
      }
    }

    return {
      id: `osrm-${Date.now()}`,
      name: `Highway Route (${(primaryRoute.distance / 1000).toFixed(1)} km)`,
      coordinates,
      totalDistanceMeters: Math.round(primaryRoute.distance),
      totalDurationSeconds: Math.round(primaryRoute.duration),
      steps,
      source: 'Live (OSRM/OSM)'
    };
  } catch (err) {
    clearTimeout(timer);
    console.warn('[routeEngine] OSRM live routing failed or timed out. Falling back to offline route generator.', err);
    throw err;
  }
}

/**
 * Creates a synthetic highway route between two points with realistic highway geometry
 * when offline or when OSRM is unreachable.
 *
 * @param {[number, number]} startCoord - [lat, lng]
 * @param {[number, number]} endCoord - [lat, lng]
 * @param {string} [name='Highway Corridor Route']
 * @returns {import('../types/typedefs.js').Route}
 */
export function generateSyntheticCorridorRoute(
  startCoord,
  endCoord,
  name = 'Highway Corridor Route (Offline)'
) {
  validateLatLng(startCoord, 'startCoord');
  validateLatLng(endCoord, 'endCoord');

  const [lat1, lng1] = startCoord;
  const [lat2, lng2] = endCoord;

  const directDistanceMeters = haversineDistanceMeters(startCoord, endCoord);
  // Real highway winding factor ~1.18
  const totalDistanceMeters = Math.round(directDistanceMeters * 1.18);
  // Average highway speed ~90 km/h (25 m/s)
  const totalDurationSeconds = Math.round(totalDistanceMeters / 25);

  const numWaypoints = Math.max(15, Math.min(80, Math.floor(directDistanceMeters / 1500)));
  const coordinates = [];

  for (let i = 0; i <= numWaypoints; i++) {
    const fraction = i / numWaypoints;
    // Add realistic subtle highway curvature
    const sinOffset = Math.sin(fraction * Math.PI) * 0.008;
    const lat = lat1 + fraction * (lat2 - lat1) + sinOffset;
    const lng = lng1 + fraction * (lng2 - lng1);
    coordinates.push([lat, lng]);
  }

  const steps = [
    {
      instruction: `Depart from origin onto State Highway`,
      distanceMeters: Math.round(totalDistanceMeters * 0.1),
      durationSeconds: Math.round(totalDurationSeconds * 0.1),
      name: 'State Highway On-Ramp',
      maneuver: { type: 'depart', modifier: 'straight', location: startCoord }
    },
    {
      instruction: `Continue along highway corridor for ${(totalDistanceMeters / 1000).toFixed(1)} km`,
      distanceMeters: Math.round(totalDistanceMeters * 0.8),
      durationSeconds: Math.round(totalDurationSeconds * 0.8),
      name: 'Main Interstate Corridor',
      maneuver: { type: 'continue', modifier: 'straight', location: coordinates[Math.floor(coordinates.length / 2)] }
    },
    {
      instruction: `Arrive at destination`,
      distanceMeters: Math.round(totalDistanceMeters * 0.1),
      durationSeconds: Math.round(totalDurationSeconds * 0.1),
      name: 'Terminal Off-Ramp',
      maneuver: { type: 'arrive', modifier: 'straight', location: endCoord }
    }
  ];

  return {
    id: `synthetic-${Date.now()}`,
    name,
    coordinates,
    totalDistanceMeters,
    totalDurationSeconds,
    steps,
    source: 'Sample/Demo'
  };
}
