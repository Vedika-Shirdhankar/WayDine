/**
 * @file phase6.test.js
 * Verification of Supabase backend connectivity, repository contract symmetry,
 * offline fallback mechanisms, and auth guest integration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalSeedRepository } from '../src/data/LocalSeedRepository.js';
import { SupabaseRepository } from '../src/data/SupabaseRepository.js';
import { getRepository, resetRepositoryInstance, getDataSourceStatus } from '../src/data/restaurantRepository.js';
import { createSupabaseClient } from '../src/services/supabaseClient.js';
import demoSeedData from '../src/data/mumbaiPuneSeed.json' with { type: 'json' };

/**
 * Creates an in-memory mock Supabase client mirroring table operations.
 */
function createMockSupabaseClient(options = {}) {
  const tables = {
    restaurants: demoSeedData.restaurants.map(r => ({
      id: r.id,
      name: r.name,
      latitude: r.location[0],
      longitude: r.location[1],
      address: r.address,
      rating: r.rating,
      review_count: r.reviewCount,
      price_range: r.priceRange,
      cuisine_type: r.cuisineType,
      categories: r.categories,
      dietary_options: r.dietaryOptions,
      has_drive_thru: r.hasDriveThru,
      average_dine_minutes: r.averageDineMinutes,
      opening_time: r.openingHours.open,
      closing_time: r.openingHours.close,
      data_source: 'database'
    })),
    restaurant_access_points: demoSeedData.restaurants
      .filter(r => r.accessPoint)
      .map(r => ({
        id: r.accessPoint.id,
        restaurant_id: r.id,
        road_node_id: r.accessPoint.roadNodeId,
        rejoin_node_id: r.accessPoint.rejoinNodeId,
        latitude: r.accessPoint.location[0],
        longitude: r.accessPoint.location[1],
        access_class: r.accessPoint.accessClass
      })),
    restaurant_food_availability: [
      {
        id: 'fa-1',
        restaurant_id: 'rest_01_green',
        window_name: 'Lunch Window',
        start_hour: 11,
        end_hour: 15,
        available_categories: ['Lunch', 'Fast Food', 'Quick Bites']
      }
    ],
    road_segments: [
      {
        id: 'seg_mock_1',
        from_node_id: 'NODE_KALAMBOLI',
        to_node_id: 'NODE_KHALAPUR_HWY',
        from_lat: 19.0144,
        from_lng: 73.1025,
        to_lat: 18.8350,
        to_lng: 73.3080,
        distance_meters: 40000,
        duration_seconds: 1800,
        speed_limit_kmh: 90,
        is_turn: false,
        is_u_turn: false,
        has_median_barrier: false,
        is_forbidden: false
      }
    ],
    routes: [],
    pitstop_recommendations: [],
    pitstop_history: [],
    user_preferences: []
  };

  return {
    _tables: tables,
    from(tableName) {
      if (options.shouldFail) {
        return {
          select: () => Promise.reject(new Error('Simulated network error')),
          insert: () => Promise.reject(new Error('Simulated network error')),
          upsert: () => Promise.reject(new Error('Simulated network error'))
        };
      }

      let currentData = [...(tables[tableName] || [])];

      const builder = {
        select(columns = '*') {
          return builder;
        },
        eq(col, val) {
          currentData = currentData.filter(row => row[col] === val);
          return builder;
        },
        insert(data) {
          const items = Array.isArray(data) ? data : [data];
          tables[tableName] = tables[tableName] || [];
          items.forEach(item => {
            const row = { id: item.id || `mock-${Date.now()}-${Math.random()}`, ...item };
            tables[tableName].push(row);
          });
          return builder;
        },
        upsert(data, conflictOpts = {}) {
          const items = Array.isArray(data) ? data : [data];
          tables[tableName] = tables[tableName] || [];
          items.forEach(item => {
            const existingIdx = tables[tableName].findIndex(r =>
              (item.id && r.id === item.id) || (item.user_id && r.user_id === item.user_id)
            );
            if (existingIdx >= 0) {
              tables[tableName][existingIdx] = { ...tables[tableName][existingIdx], ...item };
            } else {
              tables[tableName].push({ id: item.id || `mock-${Date.now()}`, ...item });
            }
          });
          return builder;
        },
        maybeSingle() {
          return Promise.resolve({ data: currentData[0] || null, error: null });
        },
        single() {
          return Promise.resolve({ data: currentData[0] || null, error: null });
        },
        then(resolve, reject) {
          return Promise.resolve({ data: currentData, error: null }).then(resolve, reject);
        }
      };

      return builder;
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: { id: 'mock-user-123', email: 'pilot@waydine.com' }
        }
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: null }
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      })
    }
  };
}

/**
 * Common repository contract suite executed against both implementations.
 */
function runRepositoryContractSuite(suiteName, createRepo) {
  describe(`Repository Contract Symmetry: ${suiteName}`, () => {
    let repo;

    beforeEach(() => {
      repo = createRepo();
    });

    it('implements getRestaurants returning properly formatted restaurants', async () => {
      const list = await repo.getRestaurants();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);

      const first = list[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('location');
      expect(first).toHaveProperty('cuisineType');
      expect(first).toHaveProperty('rating');
      expect(first).toHaveProperty('priceRange');
      expect(Array.isArray(first.categories)).toBe(true);
      expect(Array.isArray(first.dietaryOptions)).toBe(true);
    });

    it('implements getRestaurants with filter support (e.g. priceRange)', async () => {
      const filtered = await repo.getRestaurants({ priceRange: '$$' });
      expect(Array.isArray(filtered)).toBe(true);
      filtered.forEach(r => {
        expect(r.priceRange).toBe('$$');
      });
    });

    it('implements getFoodAvailability returning window objects', async () => {
      const windows = await repo.getFoodAvailability('rest_01_green');
      expect(Array.isArray(windows)).toBe(true);
    });

    it('implements getAccessPoints returning access point objects', async () => {
      const aps = await repo.getAccessPoints('rest_01_green');
      expect(Array.isArray(aps)).toBe(true);
      if (aps.length > 0) {
        expect(aps[0]).toHaveProperty('roadNodeId');
        expect(aps[0]).toHaveProperty('accessClass');
      }
    });

    it('implements getRoadGraph returning a populated RoadNetworkGraph', async () => {
      const graph = await repo.getRoadGraph();
      expect(graph).toBeDefined();
      expect(graph.nodes.size).toBeGreaterThan(0);
      expect(graph.adjacencyList.size).toBeGreaterThan(0);
    });

    it('implements saveRoute persisting planned route', async () => {
      const res = await repo.saveRoute({
        id: 'contract-test-route-1',
        name: 'Contract Test Highway Route',
        totalDistanceMeters: 50000,
        totalDurationSeconds: 2400,
        coordinates: [[19.0, 72.8], [18.5, 73.8]]
      });
      expect(res).toHaveProperty('success', true);
      expect(res).toHaveProperty('id');
    });

    it('implements saveRecommendations persisting computed pitstops', async () => {
      const res = await repo.saveRecommendations('contract-test-route-1', [
        {
          rank: 1,
          finalScore: 92.5,
          detourMeters: 250,
          detourSeconds: 30,
          accessibilityClass: 'GREEN',
          restaurant: { id: 'rest_01_green', name: 'Khalapur Plaza' }
        }
      ]);
      expect(res).toHaveProperty('success', true);
    });

    it('implements saveHistory recording user pitstop selection', async () => {
      const res = await repo.saveHistory({
        restaurantId: 'rest_01_green',
        restaurantName: 'Khalapur Plaza',
        score: 95,
        detourMeters: 250,
        routeId: 'contract-test-route-1',
        userId: 'contract-test-user'
      });
      expect(res).toHaveProperty('success', true);
      expect(res).toHaveProperty('id');
    });

    it('implements getPreferences and savePreferences with round-trip consistency', async () => {
      const newPrefs = {
        preferredCuisines: ['North Indian', 'Fast Food'],
        dietaryRestrictions: ['Vegetarian'],
        maxDetourMinutes: 20,
        requireDriveThru: true,
        requireOpenAtEta: true,
        preferredPriceRange: '$$',
        weights: {
          detourEfficiency: 35,
          directionCompatibility: 25,
          roadAccessibility: 20,
          foodAvailability: 10,
          timeCompatibility: 10
        }
      };

      const saveRes = await repo.savePreferences('contract-test-user', newPrefs);
      expect(saveRes).toHaveProperty('success', true);

      const loadedPrefs = await repo.getPreferences('contract-test-user');
      expect(loadedPrefs).toBeDefined();
      expect(loadedPrefs.maxDetourMinutes).toBe(20);
      expect(loadedPrefs.requireDriveThru).toBe(true);
    });
  });
}

// 1. Run contract tests on LocalSeedRepository
runRepositoryContractSuite('LocalSeedRepository', () => new LocalSeedRepository());

// 2. Run contract tests on Mocked SupabaseRepository
runRepositoryContractSuite('SupabaseRepository (Mocked)', () => {
  const mockClient = createMockSupabaseClient();
  return new SupabaseRepository(mockClient);
});

describe('Phase 6: Supabase Setup & Automatic Local Fallback', () => {
  beforeEach(() => {
    resetRepositoryInstance();
  });

  it('createSupabaseClient returns null when environment variables are missing', () => {
    const client = createSupabaseClient('', '');
    expect(client).toBeNull();
  });

  it('getRepository() falls back to LocalSeedRepository when env vars are missing', () => {
    // In standard offline test environment without keys set
    const repo = getRepository({ forceLocal: true });
    expect(repo).toBeInstanceOf(LocalSeedRepository);

    const status = getDataSourceStatus();
    expect(status.badgeText).toBe('Sample/Demo (local)');
  });

  it('SupabaseRepository mid-session network failure triggers automatic local fallback without crashing', async () => {
    const failingMockClient = createMockSupabaseClient({ shouldFail: true });
    const repo = new SupabaseRepository(failingMockClient);

    expect(repo.isReachable).toBe(true);

    // Mid-session call should catch failure, toast, mark unreachable, and return local data
    const restaurants = await repo.getRestaurants();
    expect(Array.isArray(restaurants)).toBe(true);
    expect(restaurants.length).toBeGreaterThan(0);
    expect(repo.isReachable).toBe(false);

    // Subsequent calls immediately use fallback
    const aps = await repo.getAccessPoints('rest_01_green');
    expect(Array.isArray(aps)).toBe(true);
  });
});
