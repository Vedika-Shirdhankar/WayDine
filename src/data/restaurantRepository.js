/**
 * @file restaurantRepository.js
 * Unified repository factory and convenience exports.
 */

import { LocalSeedRepository } from './LocalSeedRepository.js';
import { SupabaseRepository } from './SupabaseRepository.js';

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
  return getRepository().getRestaurants(options);
}

export async function getRoadGraph() {
  return getRepository().getRoadGraph();
}

export async function getDemoRoute() {
  const repo = getRepository();
  if (typeof repo.getDemoRoute === 'function') {
    return repo.getDemoRoute();
  }
  return null;
}

export async function getDemoParameters() {
  const repo = getRepository();
  if (typeof repo.getDemoParameters === 'function') {
    return repo.getDemoParameters();
  }
  return null;
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
