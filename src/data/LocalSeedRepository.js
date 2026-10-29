/**
 * @file LocalSeedRepository.js
 * Default offline repository implementation reading JSON seed data and persisting to localStorage.
 * Includes in-memory fallback for Node.js / CLI environments.
 */

import { IWayDineRepository } from './repositoryInterface.js';
import demoSeedData from './mumbaiPuneSeed.json' with { type: 'json' };
import { RoadNetworkGraph } from '../engine/shortestPath.js';

export class LocalSeedRepository extends IWayDineRepository {
  constructor() {
    super();
    this.memoryStore = {
      routes: new Map(),
      recommendations: new Map(),
      history: [],
      preferences: new Map()
    };
    this._initStorage();
  }

  _isBrowser() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  _initStorage() {
    if (this._isBrowser()) {
      try {
        if (!localStorage.getItem('waydine_preferences')) {
          localStorage.setItem('waydine_preferences', JSON.stringify({}));
        }
        if (!localStorage.getItem('waydine_history')) {
          localStorage.setItem('waydine_history', JSON.stringify([]));
        }
      } catch (err) {
        console.warn('[LocalSeedRepository] localStorage access warning:', err.message);
      }
    }
  }

  async getRestaurants(filter = {}) {
    let list = [...demoSeedData.restaurants];

    if (filter.cuisine && filter.cuisine !== 'All') {
      const q = filter.cuisine.toLowerCase();
      list = list.filter(r => r.cuisineType.toLowerCase().includes(q) || r.categories.some(c => c.toLowerCase().includes(q)));
    }

    if (filter.dietaryOption) {
      const diet = filter.dietaryOption.toLowerCase();
      list = list.filter(r => (r.dietaryOptions || []).some(d => d.toLowerCase().includes(diet)));
    }

    if (filter.priceRange) {
      list = list.filter(r => r.priceRange === filter.priceRange);
    }

    if (filter.hasDriveThru !== undefined) {
      list = list.filter(r => r.hasDriveThru === filter.hasDriveThru);
    }

    return list;
  }

  async getFoodAvailability(restaurantId) {
    const restaurant = demoSeedData.restaurants.find(r => r.id === restaurantId);
    if (!restaurant) return [];
    return restaurant.customFoodWindows || [];
  }

  async getAccessPoints(restaurantId) {
    const restaurant = demoSeedData.restaurants.find(r => r.id === restaurantId);
    if (!restaurant || !restaurant.accessPoint) return [];
    return [restaurant.accessPoint];
  }

  async getRoadGraph() {
    const graph = new RoadNetworkGraph();
    const seed = demoSeedData.roadGraph;

    for (const node of seed.nodes) {
      graph.addNode(node.id, node.location, node.name);
    }

    for (const edge of seed.edges) {
      graph.addEdge(edge.from, edge.to, {
        distanceMeters: edge.distanceMeters,
        durationSeconds: edge.durationSeconds,
        speedKmh: edge.speedKmh,
        isTurn: !!edge.isTurn,
        isUTurn: !!edge.isUTurn,
        hasMedianBarrier: !!edge.hasMedianBarrier,
        isForbidden: !!edge.isForbidden
      });
    }

    return graph;
  }

  async getDemoRoute() {
    return demoSeedData.demoRoute;
  }

  async getDemoParameters() {
    return demoSeedData.fixedDemoParameters;
  }

  async saveRoute(route) {
    const id = route.id || `route-${Date.now()}`;
    if (this._isBrowser()) {
      try {
        const stored = JSON.parse(localStorage.getItem('waydine_routes') || '{}');
        stored[id] = route;
        localStorage.setItem('waydine_routes', JSON.stringify(stored));
      } catch (e) {}
    } else {
      this.memoryStore.routes.set(id, route);
    }
    return { success: true, id };
  }

  async saveRecommendations(routeId, recommendations) {
    if (this._isBrowser()) {
      try {
        const stored = JSON.parse(localStorage.getItem('waydine_recommendations') || '{}');
        stored[routeId] = recommendations;
        localStorage.setItem('waydine_recommendations', JSON.stringify(stored));
      } catch (e) {}
    } else {
      this.memoryStore.recommendations.set(routeId, recommendations);
    }
    return { success: true, count: recommendations.length };
  }

  async saveHistory(entry) {
    const id = `hist-${Date.now()}`;
    const record = { id, ...entry, selectedAt: new Date().toISOString() };

    if (this._isBrowser()) {
      try {
        const history = JSON.parse(localStorage.getItem('waydine_history') || '[]');
        history.unshift(record);
        localStorage.setItem('waydine_history', JSON.stringify(history.slice(0, 50)));
      } catch (e) {}
    } else {
      this.memoryStore.history.unshift(record);
    }
    return { success: true, id };
  }

  async getPreferences(userId = 'default_user') {
    const defaults = {
      preferredCuisines: [],
      dietaryRestrictions: [],
      maxDetourMinutes: 15,
      requireDriveThru: false,
      requireOpenAtEta: true,
      preferredPriceRange: '$$',
      weights: {
        detourEfficiency: 30,
        directionCompatibility: 25,
        roadAccessibility: 20,
        foodAvailability: 15,
        timeCompatibility: 10
      }
    };

    if (this._isBrowser()) {
      try {
        const prefs = JSON.parse(localStorage.getItem('waydine_preferences') || '{}');
        return prefs[userId] || defaults;
      } catch (e) {
        return defaults;
      }
    }
    return this.memoryStore.preferences.get(userId) || defaults;
  }

  async savePreferences(userId = 'default_user', preferences) {
    if (this._isBrowser()) {
      try {
        const prefs = JSON.parse(localStorage.getItem('waydine_preferences') || '{}');
        prefs[userId] = preferences;
        localStorage.setItem('waydine_preferences', JSON.stringify(prefs));
      } catch (e) {}
    } else {
      this.memoryStore.preferences.set(userId, preferences);
    }
    return { success: true };
  }
}
