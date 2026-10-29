/**
 * @file SupabaseRepository.js
 * Supabase cloud database repository implementation.
 * Gracefully falls back to LocalSeedRepository if environment credentials are not configured.
 */

import { IWayDineRepository } from './repositoryInterface.js';
import { LocalSeedRepository } from './LocalSeedRepository.js';

export class SupabaseRepository extends IWayDineRepository {
  constructor() {
    super();
    this.fallback = new LocalSeedRepository();
    this.supabaseUrl = this._getEnv('VITE_SUPABASE_URL');
    this.supabaseAnonKey = this._getEnv('VITE_SUPABASE_ANON_KEY');
    this.isConfigured = Boolean(
      this.supabaseUrl &&
      this.supabaseAnonKey &&
      this.supabaseUrl !== 'YOUR_SUPABASE_URL'
    );
  }

  _getEnv(key) {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
    return null;
  }

  async getRestaurants(filter = {}) {
    if (!this.isConfigured) {
      return this.fallback.getRestaurants(filter);
    }

    try {
      const url = new URL(`${this.supabaseUrl}/rest/v1/restaurants`);
      url.searchParams.set('select', '*');

      const response = await fetch(url.toString(), {
        headers: {
          apikey: this.supabaseAnonKey,
          Authorization: `Bearer ${this.supabaseAnonKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Supabase error ${response.status}`);
      }

      const rows = await response.json();
      return rows.map(r => ({
        id: r.id,
        name: r.name,
        location: [parseFloat(r.latitude), parseFloat(r.longitude)],
        address: r.address,
        rating: parseFloat(r.rating || 4.0),
        reviewCount: r.review_count || 0,
        priceRange: r.price_range || '$$',
        cuisineType: r.cuisine_type,
        categories: r.categories || [],
        dietaryOptions: r.dietary_options || [],
        hasDriveThru: Boolean(r.has_drive_thru),
        openingHours: { open: r.opening_time, close: r.closing_time },
        dataSource: 'database'
      }));
    } catch (err) {
      console.warn('[SupabaseRepository] Falling back to local seed due to fetch error:', err.message);
      return this.fallback.getRestaurants(filter);
    }
  }

  async getFoodAvailability(restaurantId) {
    if (!this.isConfigured) return this.fallback.getFoodAvailability(restaurantId);
    return this.fallback.getFoodAvailability(restaurantId);
  }

  async getAccessPoints(restaurantId) {
    if (!this.isConfigured) return this.fallback.getAccessPoints(restaurantId);
    return this.fallback.getAccessPoints(restaurantId);
  }

  async getRoadGraph() {
    return this.fallback.getRoadGraph();
  }

  async getDemoRoute() {
    return this.fallback.getDemoRoute();
  }

  async getDemoParameters() {
    return this.fallback.getDemoParameters();
  }

  async saveRoute(route) {
    if (!this.isConfigured) return this.fallback.saveRoute(route);
    return this.fallback.saveRoute(route);
  }

  async saveRecommendations(routeId, recommendations) {
    if (!this.isConfigured) return this.fallback.saveRecommendations(routeId, recommendations);
    return this.fallback.saveRecommendations(routeId, recommendations);
  }

  async saveHistory(entry) {
    if (!this.isConfigured) return this.fallback.saveHistory(entry);
    return this.fallback.saveHistory(entry);
  }

  async getPreferences(userId) {
    if (!this.isConfigured) return this.fallback.getPreferences(userId);
    return this.fallback.getPreferences(userId);
  }

  async savePreferences(userId, preferences) {
    if (!this.isConfigured) return this.fallback.savePreferences(userId, preferences);
    return this.fallback.savePreferences(userId, preferences);
  }
}
