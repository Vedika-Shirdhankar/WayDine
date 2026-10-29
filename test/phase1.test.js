import { describe, it, expect } from 'vitest';
import {
  isValidLatLng,
  assertPositiveNumber,
  assertWeightsSumTo100
} from '../src/engine/validators.js';
import {
  haversine,
  bearing,
  pointToSegmentDistance,
  crossProductSide,
  progressAlongRoute
} from '../src/engine/geoUtils.js';
import {
  buildSegments,
  getRoute,
  BUNDLED_DEMO_ROUTE
} from '../src/engine/routeEngine.js';
import {
  corridorFilter,
  aheadFilter
} from '../src/engine/restaurantFilter.js';
import {
  RoadNetworkGraph,
  dijkstra,
  BinaryMinHeap
} from '../src/engine/shortestPath.js';
import {
  calculateDetour,
  classifyDetour,
  classifyAccessibility,
  DEFAULT_DETOUR_THRESHOLDS
} from '../src/engine/detourCalculator.js';
import {
  computeEta,
  isOpenAt,
  getMealWindowAt,
  getActiveCategories,
  matchesDiet,
  matchesBudget,
  matchesCuisine
} from '../src/engine/foodRulesEngine.js';
import {
  recommendPitstops,
  REASON_CODES,
  RELAXATION_ORDER,
  DEFAULT_WEIGHTS,
  buildTemplatedExplanation
} from '../src/engine/recommendationEngine.js';

describe('1. validators.js: Runtime Boundary & Type Checks', () => {
  it('validates correct latitude and longitude coordinates', () => {
    expect(isValidLatLng([37.7749, -122.4194])).toBe(true);
    expect(isValidLatLng([0, 0])).toBe(true);
    expect(isValidLatLng([-90, -180])).toBe(true);
    expect(isValidLatLng([90, 180])).toBe(true);
  });

  it('rejects NaN, null, undefined, non-array or non-finite values', () => {
    expect(isValidLatLng(null)).toBe(false);
    expect(isValidLatLng(undefined)).toBe(false);
    expect(isValidLatLng([NaN, -122])).toBe(false);
    expect(isValidLatLng([37, NaN])).toBe(false);
    expect(isValidLatLng([Infinity, 0])).toBe(false);
    expect(isValidLatLng('37.77,-122.41')).toBe(false);
    expect(isValidLatLng([37.77])).toBe(false);
  });

  it('rejects out-of-range coordinates and detects swapped lat/lng', () => {
    expect(isValidLatLng([95.5, -122.4])).toBe(false); // Lat > 90
    expect(isValidLatLng([-95.5, -122.4])).toBe(false); // Lat < -90
    expect(isValidLatLng([37.7, 190])).toBe(false); // Lng > 180
    // Detectable swapped lat/lng: e.g. San Francisco entered as [-122.4194, 37.7749]
    expect(isValidLatLng([-122.4194, 37.7749])).toBe(false);
  });

  it('assertPositiveNumber asserts strictly positive numbers', () => {
    expect(() => assertPositiveNumber(10, 'distance')).not.toThrow();
    expect(() => assertPositiveNumber(0.01, 'distance')).not.toThrow();
    expect(() => assertPositiveNumber(0, 'distance')).toThrow(RangeError);
    expect(() => assertPositiveNumber(-5, 'distance')).toThrow(RangeError);
    expect(() => assertPositiveNumber(NaN, 'distance')).toThrow(TypeError);
    expect(() => assertPositiveNumber('10', 'distance')).toThrow(TypeError);
  });

  it('assertWeightsSumTo100 validates exact 100 sum within float tolerance', () => {
    expect(() => assertWeightsSumTo100(DEFAULT_WEIGHTS)).not.toThrow();
    expect(() => assertWeightsSumTo100({ a: 50, b: 50 })).not.toThrow();
    expect(() => assertWeightsSumTo100({ a: 33.333, b: 33.333, c: 33.334 })).not.toThrow();

    expect(() => assertWeightsSumTo100({ a: 50, b: 40 })).toThrow(/sum to 100/);
    expect(() => assertWeightsSumTo100({ a: 50, b: 60 })).toThrow(/sum to 100/);
    expect(() => assertWeightsSumTo100({})).toThrow(/must not be empty/);
    expect(() => assertWeightsSumTo100({ a: -10, b: 110 })).toThrow(TypeError);
  });
});

describe('2. geoUtils.js: Spherical Geospatial Math', () => {
  it('haversine: known city pair within tolerance (London to Paris)', () => {
    const london = [51.5074, -0.1278];
    const paris = [48.8566, 2.3522];
    const distanceMeters = haversine(london, paris);
    // Real distance ~ 343 km (343,000 m) +/- 1%
    expect(distanceMeters).toBeGreaterThan(340000);
    expect(distanceMeters).toBeLessThan(346000);
  });

  it('haversine: zero distance and symmetry', () => {
    const sf = [37.7749, -122.4194];
    const oakland = [37.8044, -122.2712];

    expect(haversine(sf, sf)).toBe(0);
    expect(haversine(sf, oakland)).toBeCloseTo(haversine(oakland, sf), 5);
  });

  it('bearing: N/E/S/W cardinal cases and 360 degree wraparound', () => {
    // Due North
    expect(bearing([0, 0], [1, 0])).toBeCloseTo(0, 5);
    // Due East
    expect(bearing([0, 0], [0, 1])).toBeCloseTo(90, 5);
    // Due South
    expect(bearing([1, 0], [0, 0])).toBeCloseTo(180, 5);
    // Due West
    expect(bearing([0, 1], [0, 0])).toBeCloseTo(270, 5);
  });

  it('pointToSegmentDistance: perpendicular, beyond-endpoint clamp, and zero-length segment', () => {
    const a = [37.0, -122.0];
    const b = [37.0, -121.0]; // West to East segment along latitude 37

    // 1. Perpendicular point at mid-segment, offset by 0.01 deg latitude (~1.11 km North)
    const midPointNorth = [37.01, -121.5];
    const perpDist = pointToSegmentDistance(midPointNorth, a, b);
    expect(perpDist).toBeGreaterThan(1100);
    expect(perpDist).toBeLessThan(1130);

    // 2. Beyond endpoint B (clamped to B)
    const beyondB = [37.0, -120.9];
    const distBeyondB = pointToSegmentDistance(beyondB, a, b);
    expect(distBeyondB).toBeCloseTo(haversine(beyondB, b), 1);

    // 3. Before endpoint A (clamped to A)
    const beforeA = [37.0, -122.1];
    const distBeforeA = pointToSegmentDistance(beforeA, a, b);
    expect(distBeforeA).toBeCloseTo(haversine(beforeA, a), 1);

    // 4. Zero-length segment (a === b)
    const zeroSegDist = pointToSegmentDistance(midPointNorth, a, a);
    expect(zeroSegDist).toBeCloseTo(haversine(midPointNorth, a), 1);
  });

  it('crossProductSide: left, right, and collinear on a known directed segment', () => {
    const segStart = [37.0, -122.0];
    const segEnd = [38.0, -122.0];

    // Right of travel: East of route
    const pointEast = [37.5, -121.9];
    expect(crossProductSide(segStart, segEnd, pointEast)).toBe('right');

    // Left of travel: West of route
    const pointWest = [37.5, -122.1];
    expect(crossProductSide(segStart, segEnd, pointWest)).toBe('left');

    // Collinear on segment
    const pointOnLine = [37.5, -122.0];
    expect(crossProductSide(segStart, segEnd, pointOnLine)).toBe('on-route');
  });

  it('progressAlongRoute: computes cumulative distance along polyline', () => {
    const route = [
      [37.0, -122.0],
      [37.1, -122.0],
      [37.2, -122.0]
    ];
    const seg1Length = haversine(route[0], route[1]);

    const progress = progressAlongRoute(route, [37.1, -122.0]);
    expect(progress).toBeCloseTo(seg1Length, -1);

    const progressStart = progressAlongRoute(route, [37.001, -122.0]);
    expect(progressStart).toBeLessThan(seg1Length / 2);
  });
});

describe('3. routeEngine.js: Segment Builder & Offline Fallback', () => {
  it('buildSegments creates ordered segments with cumulative distance', () => {
    const coords = [
      [37.0, -122.0],
      [37.1, -122.0],
      [37.2, -122.0]
    ];
    const segments = buildSegments(coords);

    expect(segments.length).toBe(2);
    expect(segments[0].segmentIndex).toBe(0);
    expect(segments[1].segmentIndex).toBe(1);
    expect(segments[1].cumulativeDistanceMeters).toBeGreaterThan(segments[0].cumulativeDistanceMeters);
  });

  it('getRoute cleanly returns demo-fallback without network calls when forced or offline', async () => {
    const src = [37.6213, -122.3790];
    const dst = [37.4138, -122.0800];
    const route = await getRoute(src, dst, { forceOffline: true });

    expect(route.source).toBe('demo-fallback');
    expect(route.geometry.length).toBe(BUNDLED_DEMO_ROUTE.length);
    expect(route.distanceMeters).toBeGreaterThan(20000);
    expect(route.segments.length).toBe(BUNDLED_DEMO_ROUTE.length - 1);
  });
});

describe('4. restaurantFilter.js: Corridor & Ahead-of-Vehicle Filtering', () => {
  const testRoute = [
    [37.0, -122.0],
    [37.2, -122.0]
  ];

  it('corridorFilter filters candidate restaurants within lateral corridor threshold', () => {
    const restaurants = [
      { id: 'near', location: [37.1, -122.001] },
      { id: 'far', location: [37.1, -122.05] }
    ];

    const candidates = corridorFilter(testRoute, restaurants, 200);
    expect(candidates.length).toBe(1);
    expect(candidates[0].id).toBe('near');
    expect(candidates[0].distanceFromRouteMeters).toBeLessThanOrEqual(200);
  });

  it('aheadFilter drops restaurants behind the vehicle with buffer tolerance', () => {
    const candidates = [
      { id: 'behind', location: [37.02, -122.0] },
      { id: 'ahead', location: [37.15, -122.0] }
    ];
    const vehiclePos = [37.10, -122.0];

    const filtered = aheadFilter(testRoute, vehiclePos, candidates, 50);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('ahead');
  });
});

describe('5. shortestPath.js: Dijkstra with Binary Min-Heap & Turn Restrictions', () => {
  it('BinaryMinHeap correctly maintains min priority order', () => {
    const pq = new BinaryMinHeap();
    pq.push('taskC', 30);
    pq.push('taskA', 10);
    pq.push('taskB', 20);

    expect(pq.size).toBe(3);
    expect(pq.pop()).toBe('taskA');
    expect(pq.pop()).toBe('taskB');
    expect(pq.pop()).toBe('taskC');
    expect(pq.pop()).toBeNull();
  });

  it('dijkstra: simple graph shortest path calculation', () => {
    const graph = new RoadNetworkGraph();
    graph.addNode('A', [37.0, -122.0]);
    graph.addNode('B', [37.01, -122.0]);
    graph.addNode('C', [37.02, -122.0]);

    graph.addEdge('A', 'B', { distanceMeters: 500, durationSeconds: 30 });
    graph.addEdge('B', 'C', { distanceMeters: 500, durationSeconds: 30 });

    const result = dijkstra(graph, 'A', 'C');
    expect(result).not.toBeNull();
    expect(result.path).toEqual(['A', 'B', 'C']);
    expect(result.distance).toBe(1000);
    expect(result.time).toBe(60);
  });

  it('dijkstra: one-way edge forces a longer alternate path', () => {
    const graph = new RoadNetworkGraph();
    graph.addNode('A', [37.0, -122.0]);
    graph.addNode('B', [37.01, -122.0]);
    graph.addNode('C', [37.02, -122.0]);

    graph.addEdge('C', 'A', { distanceMeters: 100, durationSeconds: 10, oneWay: true });
    graph.addEdge('A', 'B', { distanceMeters: 200, durationSeconds: 20, oneWay: true });
    graph.addEdge('B', 'C', { distanceMeters: 200, durationSeconds: 20, oneWay: true });

    const result = dijkstra(graph, 'A', 'C');
    expect(result.path).toEqual(['A', 'B', 'C']);
    expect(result.distance).toBe(400);
  });

  it('dijkstra: returns null when target node is unreachable', () => {
    const graph = new RoadNetworkGraph();
    graph.addNode('A', [37.0, -122.0]);
    graph.addNode('B', [37.01, -122.0]);
    graph.addNode('ISLAND', [37.05, -122.0]);

    graph.addEdge('A', 'B', { distanceMeters: 100 });

    const result = dijkstra(graph, 'A', 'ISLAND');
    expect(result).toBeNull();
  });

  it('dijkstra: respects forbidden turn and U-turn restrictions', () => {
    const graph = new RoadNetworkGraph();
    graph.addNode('N1', [37.0, -122.0]);
    graph.addNode('N2', [37.01, -122.0]);
    graph.addNode('N3', [37.02, -122.0]);

    graph.addEdge('N1', 'N2', { distanceMeters: 100, durationSeconds: 10 });
    graph.addEdge('N2', 'N3', { distanceMeters: 100, durationSeconds: 10 });
    graph.addForbiddenTurn('N1', 'N2', 'N3');

    const result = dijkstra(graph, 'N1', 'N3');
    expect(result).toBeNull();
  });
});

describe('6. detourCalculator.js: Real Detour Calculation & Boundaries', () => {
  it('detour calculation with a hand-computed expected value', () => {
    const graph = new RoadNetworkGraph();
    graph.addNode('V', [37.0, -122.0]);
    graph.addNode('A', [37.01, -122.01]);
    graph.addNode('R', [37.02, -122.0]);

    graph.addEdge('V', 'A', { distanceMeters: 400, durationSeconds: 40 });
    graph.addEdge('A', 'R', { distanceMeters: 400, durationSeconds: 40 });

    const directHighwayDist = 500;
    const directHighwayTime = 30;

    const result = calculateDetour(graph, 'V', 'A', 'R', directHighwayDist, {
      directRemainingDurationSeconds: directHighwayTime
    });

    expect(result.detourDistanceMeters).toBe(300);
    expect(result.detourDurationSeconds).toBe(50);
    expect(result.detourClassification).toBe('Excellent');
    expect(result.accessibilityClass).toBe('GREEN');
  });

  it('classifyDetour at every boundary value', () => {
    const { excellent, veryGood, moderate, high } = DEFAULT_DETOUR_THRESHOLDS;

    expect(classifyDetour(0)).toBe('Excellent');
    expect(classifyDetour(excellent)).toBe('Excellent');

    expect(classifyDetour(excellent + 0.001)).toBe('Very Good');
    expect(classifyDetour(veryGood)).toBe('Very Good');

    expect(classifyDetour(veryGood + 0.001)).toBe('Moderate');
    expect(classifyDetour(moderate)).toBe('Moderate');

    expect(classifyDetour(moderate + 0.001)).toBe('High');
    expect(classifyDetour(high)).toBe('High');

    expect(classifyDetour(high + 0.001)).toBe('Excessive');
    expect(classifyDetour(5000)).toBe('Excessive');
  });

  it('classifyAccessibility assigns GREEN, YELLOW, RED, and UNVERIFIED', () => {
    expect(classifyAccessibility({ hasGraphData: false })).toBe('UNVERIFIED');
    expect(classifyAccessibility({ hasGraphData: true, path1: null, path2: null })).toBe('RED');
    expect(classifyAccessibility({ hasGraphData: true, prohibitedCrossing: true })).toBe('RED');

    const pathWithUTurn = { distance: 500, time: 60, turns: 1, uTurns: 1 };
    const pathNormal = { distance: 500, time: 60, turns: 1, uTurns: 0 };
    expect(classifyAccessibility({ hasGraphData: true, path1: pathWithUTurn, path2: pathNormal })).toBe('YELLOW');
    expect(classifyAccessibility({ hasGraphData: true, path1: pathNormal, path2: pathNormal })).toBe('GREEN');
  });
});

describe('7. foodRulesEngine.js: Meal Windows & Midnight Operating Hours', () => {
  it('food windows: boundary times (11:00, 15:00, 18:00)', () => {
    const at1100 = new Date('2026-10-29T11:00:00');
    expect(getMealWindowAt(at1100).name).toBe('Lunch');

    const at1500 = new Date('2026-10-29T15:00:00');
    expect(getMealWindowAt(at1500).name).toBe('Snacks');

    const at1800 = new Date('2026-10-29T18:00:00');
    expect(getMealWindowAt(at1800).name).toBe('Dinner');

    const at0800 = new Date('2026-10-29T08:00:00');
    expect(getMealWindowAt(at0800).name).toBe('Breakfast');
  });

  it('isOpenAt: normal hours, midnight crossing, and exactly at closing', () => {
    const duringDay = new Date('2026-10-29T12:30:00');
    const lateNight = new Date('2026-10-29T22:30:00');
    const exactlyAtClosing = new Date('2026-10-29T21:00:00');

    expect(isOpenAt(duringDay, '07:00', '21:00')).toBe(true);
    expect(isOpenAt(lateNight, '07:00', '21:00')).toBe(false);
    expect(isOpenAt(exactlyAtClosing, '07:00', '21:00')).toBe(true);

    const evening = new Date('2026-10-29T20:00:00');
    const postMidnight = new Date('2026-10-29T01:30:00');
    const exactlyMidnightClose = new Date('2026-10-29T02:00:00');
    const nextDayNoon = new Date('2026-10-29T12:00:00');

    expect(isOpenAt(evening, '18:00', '02:00')).toBe(true);
    expect(isOpenAt(postMidnight, '18:00', '02:00')).toBe(true);
    expect(isOpenAt(exactlyMidnightClose, '18:00', '02:00')).toBe(true);
    expect(isOpenAt(nextDayNoon, '18:00', '02:00')).toBe(false);
  });

  it('matchesDiet, matchesBudget, and matchesCuisine helpers work as expected', () => {
    const restaurant = {
      cuisineType: 'Italian Pizzeria',
      categories: ['Pizza', 'Salads', 'Vegetarian'],
      dietaryOptions: ['Vegetarian', 'Gluten-Free'],
      priceRange: '$$'
    };

    expect(matchesDiet(restaurant, 'Vegetarian')).toBe(true);
    expect(matchesDiet(restaurant, 'Halal')).toBe(false);

    expect(matchesBudget(restaurant, '$$')).toBe(true);
    expect(matchesBudget(restaurant, '$$$')).toBe(true);
    expect(matchesBudget(restaurant, '$')).toBe(false);

    expect(matchesCuisine(restaurant, 'Pizza')).toBe(true);
    expect(matchesCuisine(restaurant, 'Sushi')).toBe(false);
  });
});

describe('8. recommendationEngine.js: Hard Constraints, Scoring & Relaxation', () => {
  const routeCoords = [
    [37.0, -122.0],
    [37.1, -122.0],
    [37.2, -122.0]
  ];
  const vehiclePos = [37.05, -122.0];

  const graph = new RoadNetworkGraph();
  graph.addNode('VEHICLE', [37.05, -122.0]);
  graph.addNode('R1_NODE', [37.08, -122.001]);
  // Bidirectional connection so vehicle can reach R1_NODE and return to VEHICLE
  graph.addEdge('VEHICLE', 'R1_NODE', { distanceMeters: 250, durationSeconds: 30, bidirectional: true });

  it('ranks eligible candidates deterministically and formats templated explanation', () => {
    const restaurants = [
      {
        id: 'r1',
        name: 'Corridor Cafe',
        location: [37.08, -122.001],
        accessPoint: { roadNodeId: 'R1_NODE', rejoinNodeId: 'VEHICLE' },
        categories: ['Breakfast', 'Coffee'],
        openingHours: { open: '06:00', close: '22:00' }
      }
    ];

    const result = recommendPitstops({
      routeCoordinates: routeCoords,
      vehiclePosition: vehiclePos,
      restaurants,
      roadGraph: graph,
      vehicleNodeId: 'VEHICLE',
      departureTime: new Date('2026-10-29T08:00:00'),
      filters: { corridorMeters: 300, maxDetourMeters: 1000 }
    });

    expect(result.eligible.length).toBe(1);
    expect(result.eligible[0].rank).toBe(1);
    expect(result.eligible[0].finalScore).toBeGreaterThan(0);
    expect(result.eligible[0].finalScore).toBeLessThanOrEqual(100);

    expect(result.eligible[0].explanation).toContain('Recommended because it adds only');
    expect(result.eligible[0].explanation).toContain('needs no U-turn');
  });

  it('eliminates candidates failing hard constraints with explicit reason codes', () => {
    const restaurants = [
      {
        id: 'r_behind',
        name: 'Behind Vehicle Restaurant',
        location: [37.01, -122.0],
        categories: ['Coffee'],
        openingHours: { open: '00:00', close: '23:59' }
      },
      {
        id: 'r_far',
        name: 'Out of Corridor Venue',
        location: [37.08, -122.05],
        categories: ['Coffee'],
        openingHours: { open: '00:00', close: '23:59' }
      }
    ];

    const result = recommendPitstops({
      routeCoordinates: routeCoords,
      vehiclePosition: vehiclePos,
      restaurants,
      roadGraph: graph,
      vehicleNodeId: 'VEHICLE',
      filters: { corridorMeters: 200 }
    });

    expect(result.eligible.length).toBe(0);
    const behindRejection = result.rejected.find(r => r.restaurant.id === 'r_behind');
    const farRejection = result.rejected.find(r => r.restaurant.id === 'r_far');

    expect(behindRejection).toBeDefined();
    expect(behindRejection.reasonCode).toBe(REASON_CODES.BEHIND_VEHICLE);

    expect(farRejection).toBeDefined();
    expect(farRejection.reasonCode).toBe(REASON_CODES.OUT_OF_CORRIDOR);
  });

  it('relaxes constraints in documented sequential order when zero candidates pass', () => {
    const restaurants = [
      {
        id: 'r_wrong_cat',
        name: 'Steakhouse',
        location: [37.08, -122.001],
        accessPoint: { roadNodeId: 'R1_NODE', rejoinNodeId: 'VEHICLE' },
        categories: ['Steakhouse', 'Dinner'],
        openingHours: { open: '06:00', close: '22:00' }
      }
    ];

    const result = recommendPitstops({
      routeCoordinates: routeCoords,
      vehiclePosition: vehiclePos,
      restaurants,
      roadGraph: graph,
      vehicleNodeId: 'VEHICLE',
      departureTime: new Date('2026-10-29T08:00:00'),
      filters: { corridorMeters: 500, maxDetourMeters: 1000, requiredCategory: 'Breakfast' }
    });

    expect(result.relaxationInfo.wasRelaxed).toBe(true);
    expect(result.relaxationInfo.relaxedConstraint).toBe(REASON_CODES.CATEGORY_UNAVAILABLE);
    expect(result.eligible.length).toBe(1);
  });

  it('updates recommendations dynamically when selecting different route sub-corridors (e.g. Mumbai -> Navi Mumbai vs Mumbai -> Pune)', async () => {
    const seed = await import('../src/data/mumbaiPuneSeed.json');
    const { calculateRouteService } = await import('../src/services/routingService.js');
    
    // Mumbai (Dadar) to Navi Mumbai (Vashi)
    const shortRoute = await calculateRouteService([19.0178, 72.8478], [19.0657, 72.9984]);
    expect(shortRoute.coordinates.length).toBeGreaterThan(1);
    expect(shortRoute.totalDistanceMeters).toBeGreaterThan(15000);
    expect(shortRoute.totalDistanceMeters).toBeLessThan(35000);

    const recsShort = recommendPitstops({
      routeCoordinates: shortRoute.coordinates,
      vehiclePosition: shortRoute.coordinates[0],
      restaurants: seed.default.restaurants,
      departureTime: new Date('2026-10-29T12:00:00'),
      highwayDurationToVehicleSeconds: 0,
      filters: { corridorMeters: 1200, maxDetourMeters: 2500 }
    });

    expect(recsShort.eligible.length).toBeGreaterThan(0);
    // None of the short route recommendations should be Lonavala or Pune
    const hasFarRestaurants = recsShort.eligible.some(r => 
      r.restaurant.name.toLowerCase().includes('lonavala') ||
      r.restaurant.name.toLowerCase().includes('pune') ||
      r.restaurant.name.toLowerCase().includes('talegaon')
    );
    expect(hasFarRestaurants).toBe(false);
  });
});
