import { describe, it, expect } from 'vitest';
import { LocalSeedRepository } from '../src/data/LocalSeedRepository.js';
import { SupabaseRepository } from '../src/data/SupabaseRepository.js';
import { getRepository } from '../src/data/restaurantRepository.js';
import { calculateRouteService, getDemoRouteService } from '../src/services/routingService.js';
import { recommendPitstops, REASON_CODES } from '../src/engine/recommendationEngine.js';
import { calculateDetour } from '../src/engine/detourCalculator.js';

describe('Phase 2: Repository Layer Contract & Implementations', () => {
  it('LocalSeedRepository fulfills all repository contract methods', async () => {
    const repo = new LocalSeedRepository();

    const restaurants = await repo.getRestaurants();
    expect(restaurants.length).toBeGreaterThanOrEqual(12);

    const roadGraph = await repo.getRoadGraph();
    expect(roadGraph.nodes.size).toBeGreaterThan(10);
    expect(roadGraph.adjacencyList.size).toBeGreaterThan(10);

    const demoRoute = await repo.getDemoRoute();
    expect(demoRoute.id).toBe('route-mumbai-pune-expressway');
    expect(demoRoute.coordinates.length).toBeGreaterThan(5);

    const demoParams = await repo.getDemoParameters();
    expect(demoParams.vehiclePosition).toEqual([19.0144, 73.1025]);

    // Test persistence methods
    const saveRouteRes = await repo.saveRoute({ id: 'test-route-1', name: 'Test' });
    expect(saveRouteRes.success).toBe(true);

    const saveRecsRes = await repo.saveRecommendations('test-route-1', [{ rank: 1 }]);
    expect(saveRecsRes.success).toBe(true);

    const saveHistRes = await repo.saveHistory({ restaurantId: 'rest_01_green' });
    expect(saveHistRes.success).toBe(true);

    const prefs = await repo.getPreferences('user-1');
    expect(prefs.weights).toBeDefined();

    const savePrefsRes = await repo.savePreferences('user-1', { maxDetourMinutes: 20 });
    expect(savePrefsRes.success).toBe(true);
  });

  it('SupabaseRepository gracefully falls back to LocalSeedRepository when unconfigured', async () => {
    const supabaseRepo = new SupabaseRepository(null, null, { forceUnconfigured: true });
    expect(supabaseRepo.isConfigured).toBe(false);

    const restaurants = await supabaseRepo.getRestaurants();
    expect(restaurants.length).toBeGreaterThanOrEqual(12);

    const demoRoute = await supabaseRepo.getDemoRoute();
    expect(demoRoute.id).toBe('route-mumbai-pune-expressway');
  });

  it('Unified getRepository factory provides a functional repository', () => {
    const repo = getRepository();
    expect(repo).toBeDefined();
    expect(typeof repo.getRestaurants).toBe('function');
  });
});

describe('Phase 2: Route Service & Data Source Labeling', () => {
  it('calculateRouteService wraps getRoute and annotates data-source tag', async () => {
    const src = [19.0760, 72.8777];
    const dst = [18.5204, 73.8567];
    const result = await calculateRouteService(src, dst, { forceOffline: true });

    expect(result.dataSource).toBe('demo-fallback');
    expect(result.geometry.length).toBeGreaterThan(2);
    expect(result.distanceMeters).toBeGreaterThan(0);
  });

  it('getDemoRouteService loads the bundled Mumbai-Pune route', async () => {
    const demo = await getDemoRouteService();
    expect(demo).not.toBeNull();
    expect(demo.dataSource).toBe('demo-fallback');
    expect(demo.name).toContain('Mumbai to Pune');
  });
});

describe('Phase 2: End-to-End Pipeline Integration Test on Demo Seed', () => {
  it('verifies all 8 deliberate benchmark case restaurants and confirms Top Pick', async () => {
    const repo = new LocalSeedRepository();
    const demoRoute = await repo.getDemoRoute();
    const demoParams = await repo.getDemoParameters();
    const roadGraph = await repo.getRoadGraph();
    const restaurants = await repo.getRestaurants();

    const departureTime = new Date(demoParams.departureTimeIso);

    const results = recommendPitstops({
      routeCoordinates: demoRoute.coordinates,
      vehiclePosition: demoParams.vehiclePosition,
      restaurants,
      roadGraph,
      vehicleNodeId: demoParams.vehicleNodeId,
      departureTime,
      highwayDurationToVehicleSeconds: demoParams.highwayDurationToVehicleSeconds,
      filters: {
        corridorMeters: 500,
        maxDetourMeters: demoParams.filterMaxDetourMeters, // 2500 m
        requiredCategory: demoParams.filterRequiredCategory // "Lunch"
      }
    });

    // 1. Case 7: Premier Express Pitstop is the top-ranked pick (Rank #1)
    expect(results.eligible.length).toBeGreaterThan(0);
    const topPick = results.eligible[0];
    expect(topPick.restaurant.id).toBe('rest_07_top_pick');
    expect(topPick.rank).toBe(1);
    expect(topPick.detourResult.accessibilityClass).toBe('GREEN');
    expect(topPick.detourResult.detourDistanceMeters).toBeLessThan(100);
    expect(topPick.finalScore).toBeGreaterThanOrEqual(90);

    // 2. Case 1: Close to route, direct ramp (GREEN)
    const case1 = results.eligible.find(e => e.restaurant.id === 'rest_01_green');
    expect(case1).toBeDefined();
    expect(case1.detourResult.accessibilityClass).toBe('GREEN');
    expect(case1.detourResult.uTurnCount).toBe(0);

    // 3. Case 2: Opposite carriageway with median barrier -> Rejected with INACCESSIBLE_RED
    const case2 = results.rejected.find(r => r.restaurant.id === 'rest_02_red');
    expect(case2).toBeDefined();
    expect(case2.reasonCode).toBe(REASON_CODES.INACCESSIBLE_RED);

    // 4. Case 3: Needs a legal U-turn at overpass -> Eligible with YELLOW
    const case3 = results.eligible.find(e => e.restaurant.id === 'rest_03_yellow');
    expect(case3).toBeDefined();
    expect(case3.detourResult.accessibilityClass).toBe('YELLOW');
    expect(case3.detourResult.uTurnCount).toBe(1);

    // 5. Case 4: Long diversion (3.4 km > 2.5 km max detour) -> Rejected with EXCESSIVE_DETOUR
    const case4 = results.rejected.find(r => r.restaurant.id === 'rest_04_excessive_detour');
    expect(case4).toBeDefined();
    expect(case4.reasonCode).toBe(REASON_CODES.EXCESSIVE_DETOUR);

    // 6. Case 5: Evening dinner only, closed at ETA (~12:55 PM) -> Rejected with CLOSED_AT_ETA
    const case5 = results.rejected.find(r => r.restaurant.id === 'rest_05_closed_eta');
    expect(case5).toBeDefined();
    expect(case5.reasonCode).toBe(REASON_CODES.CLOSED_AT_ETA);

    // 7. Case 6: Open at ETA but only serves breakfast/pancakes -> Rejected with CATEGORY_UNAVAILABLE
    const case6 = results.rejected.find(r => r.restaurant.id === 'rest_06_no_lunch');
    expect(case6).toBeDefined();
    expect(case6.reasonCode).toBe(REASON_CODES.CATEGORY_UNAVAILABLE);

    // 8. Case 8: Missing road data -> Evaluates to UNVERIFIED
    const case8Detour = calculateDetour(
      roadGraph,
      demoParams.vehicleNodeId,
      'UNMAPPED_NODE_999',
      'UNMAPPED_NODE_999',
      0
    );
    expect(case8Detour.accessibilityClass).toBe('UNVERIFIED');

    // 9. Case 9: Closing time past midnight (11:00 to 03:00) -> Eligible at lunchtime ETA
    const case9 = results.eligible.find(e => e.restaurant.id === 'rest_09_midnight');
    expect(case9).toBeDefined();

    // 10. Every seed record has dataSource: "sample-demo"
    restaurants.forEach(r => {
      expect(r.dataSource).toBe('sample-demo');
    });
  });
});

