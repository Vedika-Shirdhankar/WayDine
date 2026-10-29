/**
 * @file recommendationEngine.js
 * Multi-criteria deterministic ranking engine for highway pitstops.
 * Replaces naive straight-line proximity with route-aware, turn-penalized,
 * ETA-verified pitstop intelligence.
 *
 * ZERO AI/ML/LLM - Strictly mathematical weighted scoring model.
 */

import { discoverCorridorRestaurants } from './restaurantFilter.js';
import { calculateDetourMetrics } from './detourCalculator.js';
import { evaluateFoodSuitability } from './foodRulesEngine.js';
import { haversineDistanceMeters } from './geoUtils.js';

/**
 * Default multi-factor scoring weights (sum to 1.0).
 */
export const DEFAULT_WEIGHTS = {
  detour: 0.35,     // Heavy weight on minimal detour & zero U-turns
  access: 0.25,     // Direct off-ramp (GREEN) vs dangerous median U-turn (RED)
  rating: 0.15,     // Quality / customer reviews
  foodEta: 0.15,    // Operating status & meal suitability at projected arrival
  preference: 0.10  // User filters (Drive-thru, Vegetarian, specific food)
};

/**
 * Accessibility class baseline scores.
 */
const ACCESSIBILITY_SCORES = {
  GREEN: 100,       // Same side, direct ramp
  YELLOW: 65,       // Controlled signalized turn or overpass
  RED: 15,          // Divided median / dangerous U-turn
  Unverified: 35    // Unproven road-graph connectivity
};

/**
 * Computes deterministic multi-factor pitstop score for a candidate.
 *
 * @param {Object} params
 * @param {import('../types/typedefs.js').DetourMetrics} params.detourMetrics
 * @param {string} params.accessClass
 * @param {number} params.rating - 1.0 to 5.0
 * @param {import('../types/typedefs.js').FoodSuitability} params.foodSuitability
 * @param {boolean} params.matchesPreferences
 * @param {typeof DEFAULT_WEIGHTS} [params.weights]
 * @returns {{
 *   finalScore: number,
 *   scoreBreakdown: {
 *     detourScore: number,
 *     accessScore: number,
 *     ratingScore: number,
 *     foodEtaScore: number,
 *     preferenceScore: number
 *   }
 * }}
 */
export function calculatePitstopScore({
  detourMetrics,
  accessClass,
  rating,
  foodSuitability,
  matchesPreferences,
  weights = DEFAULT_WEIGHTS
}) {
  const w = { ...DEFAULT_WEIGHTS, ...weights };

  // 1. Detour component (0-100)
  const detourScore = detourMetrics?.detourPenaltyScore ?? 50;

  // 2. Accessibility component (0-100)
  const accessScore = ACCESSIBILITY_SCORES[accessClass] ?? ACCESSIBILITY_SCORES.Unverified;

  // 3. Rating component (1.0 - 5.0 normalized to 20 - 100)
  const clampedRating = Math.max(1, Math.min(5, rating || 3.5));
  const ratingScore = Math.round((clampedRating / 5) * 100);

  // 4. Food ETA component (0-100)
  const foodEtaScore = foodSuitability?.timingMatchScore ?? 50;

  // 5. User preference bonus (0-100)
  const preferenceScore = matchesPreferences ? 100 : 40;

  // Weighted total
  const rawScore =
    w.detour * detourScore +
    w.access * accessScore +
    w.rating * ratingScore +
    w.foodEta * foodEtaScore +
    w.preference * preferenceScore;

  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore * 10) / 10));

  return {
    finalScore,
    scoreBreakdown: {
      detourScore: Math.round(detourScore),
      accessScore: Math.round(accessScore),
      ratingScore: Math.round(ratingScore),
      foodEtaScore: Math.round(foodEtaScore),
      preferenceScore: Math.round(preferenceScore)
    }
  };
}

/**
 * Builds a deterministic human-readable rationale for the ranking.
 *
 * @param {number} rank
 * @param {import('../types/typedefs.js').Restaurant} restaurant
 * @param {import('../types/typedefs.js').DetourMetrics} detour
 * @param {import('../types/typedefs.js').FoodSuitability} food
 * @returns {string}
 */
export function buildRankingRationale(rank, restaurant, detour, food) {
  const detourMinutes = (detour.detourDurationSeconds / 60).toFixed(1);
  const uTurnNote = detour.uTurnCount > 0 ? ` [${detour.uTurnCount} U-turn required]` : ' [0 U-turns]';
  const openStatus = food.isOpenAtEta ? `Open at ETA ${food.projectedEta} (${food.mealWindow})` : `Closed at ETA (${food.projectedEta})`;
  const accessLabel = restaurant.accessClass;

  return `Rank #${rank}: ${accessLabel} access corridor. Adds +${detourMinutes} min extra driving${uTurnNote}. ${openStatus}.`;
}

/**
 * End-to-end pitstop ranking pipeline.
 *
 * @param {Object} input
 * @param {import('../types/typedefs.js').Route} input.route
 * @param {import('../types/typedefs.js').Restaurant[]} input.restaurants
 * @param {number} [input.vehicleProgressDistanceMeters=0]
 * @param {Date} [input.departureTime]
 * @param {import('./shortestPath.js').RoadNetworkGraph|null} [input.roadGraph]
 * @param {Object} [input.filters]
 * @param {number} [input.filters.maxDetourMinutes=15]
 * @param {string} [input.filters.preferredCategory='']
 * @param {boolean} [input.filters.requireDriveThru=false]
 * @param {boolean} [input.filters.requireOpenAtEta=true]
 * @param {string[]} [input.filters.allowedAccessClasses] - ['GREEN', 'YELLOW', 'RED', 'Unverified']
 * @param {typeof DEFAULT_WEIGHTS} [input.weights]
 * @returns {import('../types/typedefs.js').PitstopRecommendation[]}
 */
export function rankCorridorPitstops({
  route,
  restaurants,
  vehicleProgressDistanceMeters = 0,
  departureTime = new Date(),
  roadGraph = null,
  filters = {},
  weights = DEFAULT_WEIGHTS
}) {
  if (!route || !Array.isArray(route.coordinates)) {
    throw new TypeError('[recommendationEngine] Invalid route parameter.');
  }
  if (!Array.isArray(restaurants)) {
    throw new TypeError('[recommendationEngine] restaurants must be an array.');
  }

  const maxDetourMinutes = filters.maxDetourMinutes ?? 20;
  const maxDetourSeconds = maxDetourMinutes * 60;
  const preferredCategory = filters.preferredCategory || '';
  const requireDriveThru = !!filters.requireDriveThru;
  const requireOpenAtEta = filters.requireOpenAtEta !== false;
  const allowedAccessClasses = filters.allowedAccessClasses || ['GREEN', 'YELLOW', 'RED', 'Unverified'];

  // Step 1: Hackathon Task 1 - Route & direction-aware corridor discovery
  const candidates = discoverCorridorRestaurants(
    restaurants,
    route.coordinates,
    vehicleProgressDistanceMeters,
    { maxCorridorMeters: 5000, roadGraph }
  );

  const evaluated = [];

  for (const candidate of candidates) {
    // Check accessibility filter
    if (!allowedAccessClasses.includes(candidate.accessClass)) {
      continue;
    }

    // Check Drive-thru filter if requested
    if (requireDriveThru && !candidate.hasDriveThru) {
      continue;
    }

    // Step 2: Hackathon Task 2 - Detour & U-turn calculations
    const detourMetrics = calculateDetourMetrics(
      candidate,
      candidate.nearestRoutePoint,
      roadGraph
    );

    // Filter out candidates exceeding maximum detour threshold
    if (detourMetrics.detourDurationSeconds > maxDetourSeconds) {
      continue;
    }

    // Step 3: Hackathon Task 3 - ETA-based food recommendation
    // Estimate highway duration to candidate's exit point
    const highwayRatio = candidate.distanceAlongRouteMeters / (route.totalDistanceMeters || 1);
    const durationToPointSeconds = Math.round((route.totalDurationSeconds || 0) * highwayRatio);

    const foodSuitability = evaluateFoodSuitability(
      candidate,
      departureTime,
      durationToPointSeconds,
      preferredCategory
    );

    if (requireOpenAtEta && !foodSuitability.isOpenAtEta) {
      continue;
    }

    // Preference matching
    let matchesPreferences = true;
    if (preferredCategory) {
      matchesPreferences = foodSuitability.requestedCategoryAvailable;
    }

    // Step 4: Multi-criteria deterministic score
    const { finalScore, scoreBreakdown } = calculatePitstopScore({
      detourMetrics,
      accessClass: candidate.accessClass,
      rating: candidate.rating,
      foodSuitability,
      matchesPreferences,
      weights
    });

    evaluated.push({
      restaurant: candidate,
      detourMetrics,
      foodSuitability,
      finalScore,
      scoreBreakdown,
      rank: 0,
      rationale: ''
    });
  }

  // Sort by finalScore descending (highest convenience first)
  evaluated.sort((a, b) => b.finalScore - a.finalScore);

  // Assign ranks & rationales
  return evaluated.map((item, index) => {
    const rank = index + 1;
    return {
      ...item,
      rank,
      rationale: buildRankingRationale(rank, item.restaurant, item.detourMetrics, item.foodSuitability)
    };
  });
}
