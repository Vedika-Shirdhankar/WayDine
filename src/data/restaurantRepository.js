/**
 * @file restaurantRepository.js
 * Unified repository factory and convenience exports.
 */

import { LocalSeedRepository } from './LocalSeedRepository.js';
import { SupabaseRepository } from './SupabaseRepository.js';
import sampleRoutes from './sampleRoutes.json';
import demoSeedData from './mumbaiPuneSeed.json' with { type: 'json' };

let defaultRepositoryInstance = null;

/**
 * Returns the active repository instance.
 * Defaults to SupabaseRepository if configured, otherwise LocalSeedRepository.
 * @returns {import('./repositoryInterface.js').IWayDineRepository}
 */
export function getRepository() {
  if (!defaultRepositoryInstance) {
    const supabaseRepo = new SupabaseRepository();
    defaultRepositoryInstance = supabaseRepo.isConfigured ? supabaseRepo : new LocalSeedRepository();
  }
  return defaultRepositoryInstance;
}

export async function getRestaurants(options = {}) {
  const repo = getRepository();
  return repo.getRestaurants(options);
}

export async function getRestaurantById(id) {
  const restaurants = await getRestaurants();
  return restaurants.find(r => r.id === id) || null;
}

export async function getRoutes() {
  // Combine Mumbai-Pune demo route with sample highway corridors
  const demo = demoSeedData.demoRoute;
  const list = [
    {
      id: demo.id,
      name: demo.name,
      description: demo.description,
      startPoint: demo.origin,
      endPoint: demo.destination,
      totalDistanceMeters: demo.totalDistanceMeters,
      totalDurationSeconds: demo.totalDurationSeconds,
      coordinates: demo.coordinates,
      source: demo.dataSource
    },
    ...sampleRoutes
  ];
  return list;
}

export async function getRouteById(routeId) {
  const routes = await getRoutes();
  return routes.find(r => r.id === routeId) || routes[0];
}

export async function getRoadGraph() {
  return getRepository().getRoadGraph();
}

export async function getDemoRoute() {
  const repo = getRepository();
  if (typeof repo.getDemoRoute === 'function') {
    return repo.getDemoRoute();
  }
  return demoSeedData.demoRoute;
}

export async function getDemoParameters() {
  const repo = getRepository();
  if (typeof repo.getDemoParameters === 'function') {
    return repo.getDemoParameters();
  }
  return demoSeedData.fixedDemoParameters;
}

export function getDataSourceStatus() {
  const repo = getRepository();
  const isRemote = repo instanceof SupabaseRepository && repo.isConfigured;
  return {
    sourceName: isRemote ? 'Supabase Cloud DB' : 'Local Seed (Sample/Demo)',
    isRemote,
    routingSource: 'Live (OSRM/OSM) with Offline Fallback'
  };
}
