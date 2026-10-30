/**
 * @file SupabaseRepository.js
 * Supabase cloud database repository implementation.
 * Connects to Supabase when configured; automatically falls back to LocalSeedRepository
 * if unconfigured, offline, or when a remote call fails mid-session.
 */

import { IWayDineRepository } from './repositoryInterface.js';
import { LocalSeedRepository } from './LocalSeedRepository.js';
import { RoadNetworkGraph } from '../engine/shortestPath.js';
import { getSupabaseClient, isSupabaseConfigured, getEnvVar } from '../services/supabaseClient.js';
import { showToast } from '../services/toastBus.js';

export class SupabaseRepository extends IWayDineRepository {
  /**
   * @param {import('@supabase/supabase-js').SupabaseClient} [client]
   * @param {IWayDineRepository} [fallback]
   * @param {{ forceUnconfigured?: boolean }} [options]
   */
  constructor(client = null, fallback = null, options = {}) {
    super();
    this.fallback = fallback || new LocalSeedRepository();
    this.supabaseUrl = options.forceUnconfigured ? null : getEnvVar('VITE_SUPABASE_URL');
    this.supabaseAnonKey = options.forceUnconfigured ? null : getEnvVar('VITE_SUPABASE_ANON_KEY');

    if (options.forceUnconfigured) {
      this.client = null;
      this.isConfigured = false;
      this._isMock = false;
    } else if (client) {
      this.client = client;
      this.isConfigured = true;
      this._isMock = true;
    } else {
      this.isConfigured = isSupabaseConfigured();
      this.client = this.isConfigured ? getSupabaseClient() : null;
      this._isMock = false;
    }

    this.isReachable = this.isConfigured && Boolean(this.client);
  }

  /**
   * Internal helper for mid-session error handling.
   * Logs warning, emits user-facing toast, and marks reachable false.
   * @private
   */
  _handleMidSessionFailure(err, actionContext) {
    const isRls = err?.code === '42501' ||
                  (err?.message && (err.message.includes('row-level security') || err.message.includes('violates'))) ||
                  err?.status === 401 ||
                  err?.status === 403;

    if (isRls) {
      // Unauthenticated guest action restricted by cloud RLS policy - silent fallback to local cache
      return;
    }

    console.warn(`[SupabaseRepository] ${actionContext} failed, falling back to local seed:`, err?.message || err);
    this.isReachable = false;
    showToast(`Supabase connection error during ${actionContext}. Using local fallback.`, 'warning');
  }

  /**
   * Safely retrieves current authenticated user if any.
   * @private
   */
  async _getCurrentUser() {
    if (!this.client || !this.client.auth) return null;
    try {
      const { data: { user } } = await this.client.auth.getUser();
      return user || null;
    } catch {
      return null;
    }
  }

  async getRestaurants(filter = {}) {
    if (!this.isConfigured || !this.client || !this.isReachable) {
      return this.fallback.getRestaurants(filter);
    }

    try {
      let query = this.client.from('restaurants').select('*');

      if (filter.priceRange) {
        query = query.eq('price_range', filter.priceRange);
      }
      if (filter.hasDriveThru !== undefined) {
        query = query.eq('has_drive_thru', filter.hasDriveThru);
      }

      const { data: rows, error } = await query;
      if (error) throw error;

      if (!rows || rows.length === 0) {
        return this.fallback.getRestaurants(filter);
      }

      // Fetch access points to attach directly onto restaurant objects
      let accessPointsMap = new Map();
      try {
        const { data: apRows } = await this.client.from('restaurant_access_points').select('*');
        if (Array.isArray(apRows)) {
          for (const ap of apRows) {
            if (!accessPointsMap.has(ap.restaurant_id)) {
              accessPointsMap.set(ap.restaurant_id, ap);
            }
          }
        }
      } catch {
        // Access point fetch optional
      }

      let list = rows.map(r => {
        const ap = accessPointsMap.get(r.id);
        return {
          id: r.id,
          name: r.name,
          location: [parseFloat(r.latitude), parseFloat(r.longitude)],
          address: r.address || '',
          rating: parseFloat(r.rating || 4.0),
          reviewCount: r.review_count || 0,
          priceRange: r.price_range || '$$',
          cuisineType: r.cuisine_type || 'General',
          categories: Array.isArray(r.categories) ? r.categories : [],
          dietaryOptions: Array.isArray(r.dietary_options) ? r.dietary_options : [],
          hasDriveThru: Boolean(r.has_drive_thru),
          averageDineMinutes: r.average_dine_minutes || 20,
          openingHours: { open: r.opening_time || '00:00', close: r.closing_time || '23:59' },
          dataSource: 'database',
          accessPoint: ap ? {
            id: ap.id,
            roadNodeId: ap.road_node_id,
            rejoinNodeId: ap.rejoin_node_id,
            location: [parseFloat(ap.latitude), parseFloat(ap.longitude)],
            accessClass: ap.access_class || 'UNVERIFIED'
          } : undefined
        };
      });

      // Merge with local repository to guarantee complete coverage across all sub-corridors (e.g. Mumbai -> Navi Mumbai)
      try {
        const localList = await this.fallback.getRestaurants(filter);
        const remoteIds = new Set(list.map(r => r.id));
        for (const loc of localList) {
          if (!remoteIds.has(loc.id)) {
            list.push(loc);
          }
        }
      } catch {}

      if (filter.cuisine && filter.cuisine !== 'All') {
        const q = filter.cuisine.toLowerCase();
        list = list.filter(r =>
          r.cuisineType.toLowerCase().includes(q) ||
          r.categories.some(c => c.toLowerCase().includes(q))
        );
      }

      if (filter.dietaryOption) {
        const diet = filter.dietaryOption.toLowerCase();
        list = list.filter(r =>
          (r.dietaryOptions || []).some(d => d.toLowerCase().includes(diet))
        );
      }

      return list;
    } catch (err) {
      this._handleMidSessionFailure(err, 'getRestaurants');
      return this.fallback.getRestaurants(filter);
    }
  }

  async getFoodAvailability(restaurantId) {
    if (!this.isConfigured || !this.client || !this.isReachable) {
      return this.fallback.getFoodAvailability(restaurantId);
    }

    try {
      const { data, error } = await this.client
        .from('restaurant_food_availability')
        .select('*')
        .eq('restaurant_id', restaurantId);

      if (error) throw error;
      if (!data || data.length === 0) {
        return this.fallback.getFoodAvailability(restaurantId);
      }

      return data.map(row => ({
        id: row.id,
        restaurantId: row.restaurant_id,
        windowName: row.window_name,
        name: row.window_name,
        startHour: row.start_hour,
        endHour: row.end_hour,
        categories: row.available_categories || []
      }));
    } catch (err) {
      this._handleMidSessionFailure(err, 'getFoodAvailability');
      return this.fallback.getFoodAvailability(restaurantId);
    }
  }

  async getAccessPoints(restaurantId) {
    if (!this.isConfigured || !this.client || !this.isReachable) {
      return this.fallback.getAccessPoints(restaurantId);
    }

    try {
      const { data, error } = await this.client
        .from('restaurant_access_points')
        .select('*')
        .eq('restaurant_id', restaurantId);

      if (error) throw error;
      if (!data || data.length === 0) {
        return this.fallback.getAccessPoints(restaurantId);
      }

      return data.map(ap => ({
        id: ap.id,
        restaurantId: ap.restaurant_id,
        roadNodeId: ap.road_node_id,
        rejoinNodeId: ap.rejoin_node_id,
        location: [parseFloat(ap.latitude), parseFloat(ap.longitude)],
        description: ap.description || '',
        accessClass: ap.access_class || 'UNVERIFIED'
      }));
    } catch (err) {
      this._handleMidSessionFailure(err, 'getAccessPoints');
      return this.fallback.getAccessPoints(restaurantId);
    }
  }

  async getRoadGraph() {
    if (!this.isConfigured || !this.client || !this.isReachable) {
      return this.fallback.getRoadGraph();
    }

    try {
      const { data, error } = await this.client
        .from('road_segments')
        .select('*');

      if (error) throw error;
      if (!data || data.length === 0) {
        return this.fallback.getRoadGraph();
      }

      const graph = new RoadNetworkGraph();
      for (const seg of data) {
        graph.addNode(seg.from_node_id, [parseFloat(seg.from_lat), parseFloat(seg.from_lng)], seg.from_node_id);
        graph.addNode(seg.to_node_id, [parseFloat(seg.to_lat), parseFloat(seg.to_lng)], seg.to_node_id);
        graph.addEdge(seg.from_node_id, seg.to_node_id, {
          distanceMeters: seg.distance_meters,
          durationSeconds: seg.duration_seconds,
          speedKmh: seg.speed_limit_kmh || 80,
          isTurn: Boolean(seg.is_turn),
          isUTurn: Boolean(seg.is_u_turn),
          hasMedianBarrier: Boolean(seg.has_median_barrier),
          isForbidden: Boolean(seg.is_forbidden)
        });
      }
      return graph;
    } catch (err) {
      this._handleMidSessionFailure(err, 'getRoadGraph');
      return this.fallback.getRoadGraph();
    }
  }

  async saveRoute(route) {
    if (!this.isConfigured || !this.client || !this.isReachable) {
      return this.fallback.saveRoute(route);
    }

    try {
      const user = await this._getCurrentUser();
      const routeId = route.id || `route-${Date.now()}`;
      const row = {
        id: routeId,
        user_id: user?.id || null,
        name: route.name || 'Planned Route',
        origin_name: route.origin?.name || route.startPoint?.name || null,
        destination_name: route.destination?.name || route.endPoint?.name || null,
        total_distance_meters: route.totalDistanceMeters || route.distanceMeters || 0,
        total_duration_seconds: route.totalDurationSeconds || route.durationSeconds || 0,
        coordinates: route.coordinates || route.geometry || [],
        source: 'database'
      };

      const { error } = await this.client.from('routes').upsert(row);
      if (error) throw error;

      return { success: true, id: routeId };
    } catch (err) {
      const isRls = err?.code === '42501' || (err?.message && (err.message.includes('row-level security') || err.message.includes('violates'))) || err?.status === 401;
      if (!isRls) {
        this._handleMidSessionFailure(err, 'saveRoute');
      }
      return this.fallback.saveRoute(route);
    }
  }

  async saveRecommendations(routeId, recommendations) {
    if (!this.isConfigured || !this.client || !this.isReachable) {
      return this.fallback.saveRecommendations(routeId, recommendations);
    }

    // Persist to local fallback cache
    try {
      await this.fallback.saveRecommendations(routeId, recommendations);
    } catch {}

    try {
      const user = await this._getCurrentUser();
      const rows = recommendations.map(rec => ({
        route_id: routeId,
        user_id: user?.id || null,
        restaurant_id: rec.restaurant?.id || rec.restaurantId || rec.id,
        rank: rec.rank || 1,
        final_score: rec.finalScore ?? rec.score ?? 0,
        detour_meters: rec.detourMeters ?? rec.detourResult?.detourDistanceMeters ?? 0,
        detour_seconds: rec.detourSeconds ?? rec.detourResult?.detourDurationSeconds ?? 0,
        turn_count: rec.turnCount ?? rec.detourResult?.turnsRequired ?? 0,
        u_turn_count: rec.uTurnCount ?? (rec.detourResult?.requiresUTurn ? 1 : 0),
        accessibility_class: rec.accessibilityClass || rec.detourResult?.accessibilityClass || 'UNVERIFIED',
        eta: rec.eta instanceof Date ? rec.eta.toISOString() : (rec.eta || new Date().toISOString()),
        explanation: rec.explanation || rec.reason || ''
      }));

      const { error } = await this.client.from('pitstop_recommendations').insert(rows);
      if (error) throw error;

      return { success: true, count: rows.length };
    } catch (err) {
      const isRls = err?.code === '42501' || (err?.message && (err.message.includes('row-level security') || err.message.includes('violates'))) || err?.status === 401;
      if (!isRls) {
        this._handleMidSessionFailure(err, 'saveRecommendations');
      }
      return this.fallback.saveRecommendations(routeId, recommendations);
    }
  }

  async saveHistory(entry) {
    if (!this.isConfigured || !this.client || !this.isReachable) {
      return this.fallback.saveHistory(entry);
    }

    try {
      const user = await this._getCurrentUser();
      const effectiveUserId = entry.userId || user?.id;

      // Also persist to local cache for instant offline fallback
      try {
        await this.fallback.saveHistory(entry);
      } catch {
        // ignore fallback cache error
      }

      const row = {
        restaurant_id: entry.restaurantId || entry.restaurant?.id || entry.id,
        user_id: effectiveUserId || null,
        selected_at: entry.selectedAt || entry.timestamp || new Date().toISOString(),
        notes: entry.notes || (entry.restaurantName ? `Restaurant: ${entry.restaurantName}` : null)
      };

      if (entry.routeId && entry.routeId !== 'demo') {
        row.route_id = entry.routeId;
      }

      const { data, error } = await this.client
        .from('pitstop_history')
        .insert(row)
        .select()
        .maybeSingle();

      if (error) throw error;

      return { success: true, id: data?.id || `hist-${Date.now()}` };
    } catch (err) {
      const isRls = err?.code === '42501' || (err?.message && (err.message.includes('row-level security') || err.message.includes('violates'))) || err?.status === 401;
      if (!isRls) {
        this._handleMidSessionFailure(err, 'saveHistory');
      }
      return this.fallback.saveHistory(entry);
    }
  }

  async getPreferences(userId) {
    if (!this.isConfigured || !this.client || !this.isReachable) {
      return this.fallback.getPreferences(userId);
    }

    try {
      const user = await this._getCurrentUser();
      const targetId = user?.id || (userId && userId !== 'default_user' ? userId : (this._isMock ? userId : null));

      if (!targetId) {
        return this.fallback.getPreferences(userId);
      }

      const { data, error } = await this.client
        .from('user_preferences')
        .select('*')
        .eq('user_id', targetId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return this.fallback.getPreferences(userId);

      return {
        preferredCuisines: data.preferred_cuisines || [],
        dietaryRestrictions: data.dietary_restrictions || [],
        maxDetourMinutes: data.max_detour_minutes || 15,
        requireDriveThru: Boolean(data.require_drive_thru),
        requireOpenAtEta: Boolean(data.require_open_at_eta),
        preferredPriceRange: data.preferred_price_range || '$$',
        weights: data.weights || {
          detourEfficiency: 25,
        directionCompatibility: 20,
        roadAccessibility: 20,
        foodAvailability: 15,
        timeCompatibility: 10,
        preferenceMatch: 10
        }
      };
    } catch (err) {
      this._handleMidSessionFailure(err, 'getPreferences');
      return this.fallback.getPreferences(userId);
    }
  }

  async savePreferences(userId, preferences) {
    if (!this.isConfigured || !this.client || !this.isReachable) {
      return this.fallback.savePreferences(userId, preferences);
    }

    try {
      const user = await this._getCurrentUser();
      const targetId = user?.id || (userId && userId !== 'default_user' ? userId : (this._isMock ? userId : null));

      if (!targetId) {
        return this.fallback.savePreferences(userId, preferences);
      }

      const row = {
        user_id: targetId,
        preferred_cuisines: preferences.preferredCuisines || [],
        dietary_restrictions: preferences.dietaryRestrictions || [],
        max_detour_minutes: preferences.maxDetourMinutes || 15,
        require_drive_thru: Boolean(preferences.requireDriveThru),
        require_open_at_eta: Boolean(preferences.requireOpenAtEta),
        preferred_price_range: preferences.preferredPriceRange || preferences.budget || '$$',
        weights: preferences.weights || {
          detourEfficiency: 25,
        directionCompatibility: 20,
        roadAccessibility: 20,
        foodAvailability: 15,
        timeCompatibility: 10,
        preferenceMatch: 10
        },
        updated_at: new Date().toISOString()
      };

      // Check if user preferences record already exists for target user
      const { data: existing } = await this.client
        .from('user_preferences')
        .select('id')
        .eq('user_id', targetId)
        .maybeSingle();

      if (existing && existing.id) {
        const { error: updateErr } = await this.client
          .from('user_preferences')
          .update(row)
          .eq('id', existing.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await this.client
          .from('user_preferences')
          .insert(row);
        if (insertErr) throw insertErr;
      }

      return { success: true };
    } catch (err) {
      this._handleMidSessionFailure(err, 'savePreferences');
      return this.fallback.savePreferences(userId, preferences);
    }
  }

  async getDemoRoute() {
    return this.fallback.getDemoRoute();
  }

  async getDemoParameters() {
    return this.fallback.getDemoParameters();
  }
}
