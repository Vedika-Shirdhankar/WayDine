import { describe, it, expect } from 'vitest';
import {
  validateLatLng,
  haversineDistanceMeters,
  bearingDegrees,
  crossTrackDistanceMeters,
  projectPointOnSegment,
  findNearestPointOnPolyline,
  isAheadOfVehicle
} from '../src/engine/geoUtils.js';
import { RoadNetworkGraph, dijkstraShortestPath, MANEUVER_PENALTIES } from '../src/engine/shortestPath.js';
import { calculateDetourMetrics, calculateDetourScore } from '../src/engine/detourCalculator.js';
import {
  parseTimeToMinutes,
  isWithinOpeningHours,
  getMealWindow,
  evaluateFoodSuitability
} from '../src/engine/foodRulesEngine.js';
import {
  filterCorridorRestaurants,
  filterAheadOfVehicle,
  determineRestaurantAccessibility
} from '../src/engine/restaurantFilter.js';
import { calculatePitstopScore, rankCorridorPitstops } from '../src/engine/recommendationEngine.js';

describe('1. geoUtils: Geospatial Math & Input Validation', () => {
  it('validates coordinates correctly and throws on invalid inputs', () => {
    expect(() => validateLatLng([37.7749, -122.4194])).not.toThrow();
    expect(() => validateLatLng([95, -122])).toThrow(RangeError);
    expect(() => validateLatLng([37, 200])).toThrow(RangeError);
    expect(() => validateLatLng('invalid')).toThrow(TypeError);
    expect(() => validateLatLng([NaN, -122])).toThrow(TypeError);
  });

  it('computes accurate Haversine distance in meters', () => {
    // SF (37.7749, -122.4194) to Oakland (37.8044, -122.2712) ~ 13.5 km
    const dist = haversineDistanceMeters([37.7749, -122.4194], [37.8044, -122.2712]);
    expect(dist).toBeGreaterThan(12000);
    expect(dist).toBeLessThan(15000);
  });

  it('computes initial bearing', () => {
    // Due North
    const northBearing = bearingDegrees([37.0, -122.0], [38.0, -122.0]);
    expect(Math.round(northBearing)).toBe(0);

    // Due East
    const eastBearing = bearingDegrees([0, 0], [0, 1]);
    expect(Math.round(eastBearing)).toBe(90);
  });

  it('projects points onto segments and identifies side of travel', () => {
    const start = [37.0, -122.0];
    const end = [37.1, -122.0]; // heading north

    // Point to the right (East)
    const rightPoint = [37.05, -121.99];
    const rightCrossTrack = crossTrackDistanceMeters(rightPoint, start, end);
    expect(rightCrossTrack).toBeGreaterThan(0);

    // Point to the left (West)
    const leftPoint = [37.05, -122.01];
    const leftCrossTrack = crossTrackDistanceMeters(leftPoint, start, end);
    expect(leftCrossTrack).toBeLessThan(0);
  });

  it('determines if candidate is ahead or behind vehicle along polyline', () => {
    const polyline = [
      [37.0, -122.0],
      [37.1, -122.0],
      [37.2, -122.0]
    ];
    // Ahead: near [37.15, -122.0]
    expect(isAheadOfVehicle([37.15, -122.0], polyline, 5000)).toBe(true);

    // Behind: vehicle is at 20km, candidate is at 5km
    expect(isAheadOfVehicle([37.02, -122.0], polyline, 20000)).toBe(false);
  });
});

describe('2. shortestPath: Road Network Graph & Dijkstra Traversal', () => {
  it('finds shortest path and computes turn penalties and U-turns', () => {
    const graph = new RoadNetworkGraph();
    // A: highway exit
    graph.addNode('A', [37.77, -122.41]);
    // B: intersection
    graph.addNode('B', [37.78, -122.41]);
    // C: restaurant on opposite side requiring U-turn
    graph.addNode('C', [37.78, -122.42]);

    graph.addEdge('A', 'B', { distanceMeters: 500, speedKmh: 50 });
    graph.addEdge('B', 'C', { distanceMeters: 200, speedKmh: 30, isUTurn: true });

    const result = dijkstraShortestPath(graph, 'A', 'C');
    expect(result).not.toBeNull();
    expect(result.uTurnCount).toBe(1);
    expect(result.durationSeconds).toBeGreaterThan(MANEUVER_PENALTIES.U_TURN_PENALTY_SECONDS);
  });

  it('respects median barriers when no turning cut exists', () => {
    const graph = new RoadNetworkGraph();
    graph.addNode('N1', [37.77, -122.41]);
    graph.addNode('N2', [37.77, -122.42]);

    // Edge has physical median barrier
    graph.addEdge('N1', 'N2', { distanceMeters: 50, speedKmh: 50, hasMedianBarrier: true });

    const path = dijkstraShortestPath(graph, 'N1', 'N2');
    expect(path).toBeNull();
  });
});

describe('3. detourCalculator: Real Extra Distance & Detour Scores', () => {
  it('penalizes high detour duration exponentially', () => {
    const scoreZero = calculateDetourScore(0);
    const scoreShort = calculateDetourScore(180); // 3 mins
    const scoreLong = calculateDetourScore(1200); // 20 mins

    expect(scoreZero).toBe(100);
    expect(scoreShort).toBeGreaterThan(70);
    expect(scoreLong).toBeLessThan(25);
  });

  it('calculates detour metrics with opposite-side U-turn penalty on divided highway', () => {
    const restaurant = {
      id: 'r1',
      name: 'Highway Diner',
      location: [37.775, -122.425],
      sideOfRoad: 'left' // opposite side
    };
    const nearestRoutePoint = [37.775, -122.42];

    const metrics = calculateDetourMetrics(restaurant, nearestRoutePoint, null, { isDividedHighway: true });
    expect(metrics.uTurnCount).toBe(1);
    expect(metrics.uTurnPenaltySeconds).toBe(MANEUVER_PENALTIES.U_TURN_PENALTY_SECONDS);
  });
});

describe('4. foodRulesEngine: ETA & Meal Category Logic', () => {
  it('correctly parses time and evaluates opening hours', () => {
    expect(parseTimeToMinutes('08:30')).toBe(510);
    expect(parseTimeToMinutes('23:15')).toBe(1395);

    const normalHours = { open: '07:00', close: '21:00' };
    const morningDate = new Date('2026-10-29T08:30:00');
    const midnightDate = new Date('2026-10-29T23:30:00');

    expect(isWithinOpeningHours(normalHours, morningDate)).toBe(true);
    expect(isWithinOpeningHours(normalHours, midnightDate)).toBe(false);

    // Crosses midnight
    const lateHours = { open: '20:00', close: '03:00' };
    const nightDate = new Date('2026-10-29T01:30:00');
    expect(isWithinOpeningHours(lateHours, nightDate)).toBe(true);
  });

  it('determines meal windows based on arrival time', () => {
    const lunchDate = new Date('2026-10-29T12:30:00');
    expect(getMealWindow(lunchDate).id).toBe('Lunch');

    const breakfastDate = new Date('2026-10-29T08:00:00');
    expect(getMealWindow(breakfastDate).id).toBe('Breakfast');
  });

  it('evaluates food category suitability at projected ETA', () => {
    const restaurant = {
      id: 'diner-1',
      name: 'Route 66 Diner',
      categories: ['Breakfast', 'Coffee', 'Pancakes'],
      openingHours: { open: '06:00', close: '14:00' }
    };

    // Departure at 7:00 AM, 1 hour drive (3600s) -> 8:00 AM arrival
    const departure = new Date('2026-10-29T07:00:00');
    const result = evaluateFoodSuitability(restaurant, departure, 3600, 'Breakfast');

    expect(result.isOpenAtEta).toBe(true);
    expect(result.mealWindow).toBe('Breakfast');
    expect(result.requestedCategoryAvailable).toBe(true);
    expect(result.timingMatchScore).toBeGreaterThanOrEqual(90);
  });
});

describe('5. restaurantFilter: Hackathon Task 1 Accessibility Rules', () => {
  it('labels restaurant as Unverified when road graph has no coverage', () => {
    const restaurant = {
      id: 'unverified-1',
      name: 'Mystery Shack',
      location: [37.77, -122.42],
      graphVerified: false
    };

    const access = determineRestaurantAccessibility(restaurant, [37.77, -122.41], null);
    expect(access.accessClass).toBe('Unverified');
    expect(access.graphVerified).toBe(false);
  });

  it('classifies GREEN when direct graph path exists without U-turn', () => {
    const graph = new RoadNetworkGraph();
    graph.addNode('HWY', [37.77, -122.41]);
    graph.addNode('RAMP', [37.771, -122.412]);
    graph.addNode('REST', [37.772, -122.413]);

    graph.addEdge('HWY', 'RAMP', { distanceMeters: 100, speedKmh: 45 });
    graph.addEdge('RAMP', 'REST', { distanceMeters: 50, speedKmh: 35 });

    const restaurant = {
      id: 'green-rest',
      location: [37.772, -122.413]
    };

    const access = determineRestaurantAccessibility(restaurant, [37.77, -122.41], graph);
    expect(access.accessClass).toBe('GREEN');
    expect(access.graphVerified).toBe(true);
  });
});

describe('6. recommendationEngine: Deterministic Multi-Factor Scoring', () => {
  it('prioritizes convenient pitstops over distant high-rated ones', () => {
    const route = {
      id: 'test-route',
      coordinates: [
        [37.0, -122.0],
        [37.1, -122.0],
        [37.2, -122.0]
      ],
      totalDistanceMeters: 22000,
      totalDurationSeconds: 1200
    };

    const restaurants = [
      {
        id: 'r_close_convenient',
        name: 'Exit 12 Quick Stop',
        location: [37.05, -122.001],
        rating: 4.2,
        accessClass: 'GREEN',
        graphVerified: true,
        categories: ['Coffee', 'Quick Bites'],
        openingHours: { open: '06:00', close: '22:00' },
        hasDriveThru: true
      },
      {
        id: 'r_far_high_rated',
        name: 'Five Star Gourmet (High Detour)',
        location: [37.05, -122.04], // 3.5 km off highway
        rating: 4.9,
        accessClass: 'RED',
        graphVerified: true,
        categories: ['Fine Dining'],
        openingHours: { open: '17:00', close: '22:00' },
        hasDriveThru: false
      }
    ];

    const ranked = rankCorridorPitstops({
      route,
      restaurants,
      departureTime: new Date('2026-10-29T08:00:00'),
      filters: { requireOpenAtEta: false }
    });

    expect(ranked.length).toBe(2);
    // Exit 12 Quick Stop must rank #1 due to minimal detour and GREEN accessibility
    expect(ranked[0].restaurant.id).toBe('r_close_convenient');
    expect(ranked[0].finalScore).toBeGreaterThan(ranked[1].finalScore);
  });
});
