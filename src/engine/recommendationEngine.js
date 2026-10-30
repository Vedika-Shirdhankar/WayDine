/**
 * @file recommendationEngine.js
 * Multi-criteria deterministic ranking engine with hard-constraint elimination,
 * documented constraint relaxation, and templated explanations.
 * Pure mathematical scoring - ZERO AI/ML/LLM.
 */

import { assertWeightsSumTo100 } from './validators.js';
import { corridorFilter, aheadFilter } from './restaurantFilter.js';
import { calculateDetour } from './detourCalculator.js';
import { computeEta, isOpenAt, getActiveCategories, matchesDiet, matchesBudget, matchesCuisine } from './foodRulesEngine.js';
import { RoadNetworkGraph } from './shortestPath.js';
import { buildGraphEvaluator, serializeGraph } from './graphDetour.js';
import { findNearestPointOnPolyline, bearing, progressAlongRoute } from './geoUtils.js';

/** Corridor the HACKATHON BRIEF asks for: restaurants within 200 m of the highway. */
export const STRICT_HIGHWAY_CORRIDOR_METERS = 200;

export const DEFAULT_WEIGHTS = {
  detourEfficiency: 25,
  directionCompatibility: 20,
  roadAccessibility: 20,
  foodAvailability: 15,
  timeCompatibility: 10,
  preferenceMatch: 10
};

export const REASON_CODES = {
  OUT_OF_CORRIDOR:      'OUT_OF_CORRIDOR',
  BEHIND_VEHICLE:       'BEHIND_VEHICLE',
  INACCESSIBLE_RED:     'INACCESSIBLE_RED',
  CLOSED_AT_ETA:        'CLOSED_AT_ETA',
  CATEGORY_UNAVAILABLE: 'CATEGORY_UNAVAILABLE',
  EXCESSIVE_DETOUR:     'EXCESSIVE_DETOUR',
  PREFERENCE_MISMATCH:  'PREFERENCE_MISMATCH',
  WRONG_SIDE_OF_ROAD:   'WRONG_SIDE_OF_ROAD'
};

export const RELAXATION_ORDER = [
  REASON_CODES.PREFERENCE_MISMATCH,
  REASON_CODES.CATEGORY_UNAVAILABLE,
  REASON_CODES.EXCESSIVE_DETOUR,
  REASON_CODES.INACCESSIBLE_RED,
  REASON_CODES.CLOSED_AT_ETA
];

function formatTime12h(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutesStr} ${ampm}`;
}

export function buildTemplatedExplanation(restaurant, detourResult, eta, activeCategories) {
  const dist = detourResult.detourDistanceMeters;
  const distText = dist < 1000 ? `${dist} m` : `${(dist / 1000).toFixed(1)} km`;
  const uTurnText = detourResult.uTurnCount === 0 ? 'needs no U-turn' : `requires ${detourResult.uTurnCount} U-turn`;
  const timeText = formatTime12h(eta);
  const catText = activeCategories.length > 0 ? activeCategories.slice(0, 2).join(' / ') : 'menu';

  return `Recommended because it adds only ${distText}, ${uTurnText}, and serves ${catText} at your ${timeText} arrival.`;
}

/**
 * User-preference fit (0-100): 60% explicit preferences (budget tier, cuisine) + 40% rating.
 * With no explicit preferences every restaurant gets 100 for the explicit part, so rating alone
 * breaks ties instead of a wall of identical scores.
 */
export function computePreferenceScore(restaurant, prefs = {}) {
  const parts = [];
  if (prefs.maxPrice) parts.push(matchesBudget(restaurant, prefs.maxPrice) ? 100 : 30);
  if (Array.isArray(prefs.cuisines) && prefs.cuisines.length > 0) {
    parts.push(matchesCuisine(restaurant, prefs.cuisines) ? 100 : 40);
  }
  const explicit = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 100;
  const rating = Math.round(((restaurant.rating ?? 3.5) / 5) * 100);
  return Math.round(0.6 * explicit + 0.4 * rating);
}

/** Hard preference rules: dietary requirement and drive-thru are must-haves, not soft scores. */
export function violatesHardPreference(restaurant, prefs = {}) {
  if (prefs.diet && !matchesDiet(restaurant, prefs.diet)) return `Does not offer "${prefs.diet}" options.`;
  if (prefs.requireDriveThru && !restaurant.hasDriveThru) return 'No drive-thru service.';
  return null;
}

/**
 * Compute angular difference between two bearings (0-180°).
 * 0 = same direction, 180 = opposite direction.
 */
function angularDiff(bearingA, bearingB) {
  const diff = Math.abs(bearingA - bearingB) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Direction compatibility score (0-100) combining:
 *  - Bearing alignment: how well the restaurant's bearing from vehicle matches travel heading (Task B)
 *  - Turn penalty: U-turn and excessive turns reduce score
 *
 * @param {Object} params
 * @param {number} params.vehicleHeadingDeg - Vehicle travel bearing in degrees (0-360)
 * @param {number|null} params.restaurantBearingDeg - Bearing from vehicle to restaurant (0-360)
 * @param {number} params.uTurnCount
 * @param {number} params.turnCount
 * @returns {number} 0-100
 */
export function computeDirectionScore({ vehicleHeadingDeg, restaurantBearingDeg, uTurnCount, turnCount }) {
  // --- Bearing component (60% of direction score) ---
  let bearingScore = 100;
  if (vehicleHeadingDeg != null && restaurantBearingDeg != null) {
    const diff = angularDiff(vehicleHeadingDeg, restaurantBearingDeg);
    // diff=0 → score=100, diff=90 → score=50, diff=180 → score=0
    bearingScore = Math.max(0, Math.round(100 * (1 - diff / 180)));
  }

  // --- Turn penalty component (40% of direction score) ---
  let turnScore = 100;
  if (uTurnCount > 0) {
    turnScore = Math.max(0, 100 - uTurnCount * 45);
  } else if (turnCount > 2) {
    turnScore = Math.max(40, 100 - (turnCount - 2) * 15);
  }

  return Math.round(0.6 * bearingScore + 0.4 * turnScore);
}

export function calculateComponentScores({
  detourResult,
  maxDetourMeters,
  activeCategories,
  requiredCategory,
  isOpen,
  preferenceMatch = 100,
  vehicleHeadingDeg = null,
  restaurantBearingDeg = null
}) {
  const dist = Math.max(0, detourResult.detourDistanceMeters || 0);
  const detourEfficiency = Math.max(0, Math.min(100, Math.round(100 * (1 - dist / (maxDetourMeters || 2000)))));

  // Real bearing-based direction compatibility (Task B)
  const directionCompatibility = computeDirectionScore({
    vehicleHeadingDeg,
    restaurantBearingDeg,
    uTurnCount: detourResult.uTurnCount || 0,
    turnCount:  detourResult.turnCount  || 0
  });

  let roadAccessibility = 40;
  if (detourResult.accessibilityClass === 'GREEN')  roadAccessibility = 100;
  else if (detourResult.accessibilityClass === 'YELLOW') roadAccessibility = 65;
  else if (detourResult.accessibilityClass === 'RED')    roadAccessibility = 15;

  let foodAvailability = 50;
  if (requiredCategory) {
    const hasCategory = activeCategories.some(c => c.toLowerCase().includes(requiredCategory.toLowerCase()));
    foodAvailability = hasCategory ? 100 : 30;
  } else if (activeCategories.length > 0) {
    foodAvailability = 85;
  }

  const timeCompatibility = isOpen ? 100 : 10;

  return {
    detourEfficiency,
    directionCompatibility,
    roadAccessibility,
    foodAvailability,
    timeCompatibility,
    preferenceMatch
  };
}

export function recommendPitstops({
  routeCoordinates,
  vehiclePosition,
  restaurants,
  roadGraph = null,
  vehicleNodeId = '',
  departureTime = new Date(),
  highwayDurationToVehicleSeconds = 0,
  filters = {},
  weights = DEFAULT_WEIGHTS,
  relaxConstraint = null,
  detourMode = 'graph'
}) {
  assertWeightsSumTo100(weights);

  // Use 200m as per hackathon brief; wider candidate pre-filter is handled separately
  const corridorMeters    = filters.corridorMeters    || STRICT_HIGHWAY_CORRIDOR_METERS;
  const maxDetourMeters   = filters.maxDetourMeters   || 2500;
  const requiredCategory  = filters.requiredCategory  || '';
  const rejectOppositeSide = !!filters.rejectOppositeSide; // Task B hard filter

  const ignoreCategory    = relaxConstraint === REASON_CODES.CATEGORY_UNAVAILABLE;
  const ignoreDetourLimit = relaxConstraint === REASON_CODES.EXCESSIVE_DETOUR;
  const ignoreRedAccess   = relaxConstraint === REASON_CODES.INACCESSIBLE_RED;
  const ignoreClosed      = relaxConstraint === REASON_CODES.CLOSED_AT_ETA;
  const ignorePreferences = relaxConstraint === REASON_CODES.PREFERENCE_MISMATCH;
  const prefs = filters.preferences || {};

  const eligible = [];
  const rejected = [];

  // ---- Graph context: ONE vehicle Dijkstra tree shared by every candidate ----------------------
  let graphEval = null;
  let graphSnapshot = null;
  if (detourMode === 'graph' && roadGraph instanceof RoadNetworkGraph && roadGraph.nodes.size > 0) {
    const pre = [];
    for (const r of restaurants) {
      try {
        // Pre-filter with a wider buffer so small corridors don't silently drop everything
        if (corridorFilter(routeCoordinates, [r], Math.max(corridorMeters, 500)).length === 0) continue;
        if (aheadFilter(routeCoordinates, vehiclePosition, [r], 50).length === 0) continue;
        pre.push(r);
      } catch { /* invalid restaurant geometry is rejected in main loop */ }
    }
    try {
      graphEval = buildGraphEvaluator({
        graph: roadGraph,
        routeCoordinates,
        vehiclePosition,
        restaurants: pre,
        preferredVehicleNodeId: vehicleNodeId,
        highwayDurationToVehicleSeconds
      });
      // Serialize the working graph (with inferred spurs) for the Dijkstra visualizer
      if (graphEval) {
        graphSnapshot = serializeGraph(graphEval.workGraph, graphEval.mainline);
      }
    } catch (err) {
      graphEval = null;
    }
  }

  // Travel heading at the vehicle, derived from the route polyline (not hardcoded).
  let vehicleHeading = null;
  try {
    const here = findNearestPointOnPolyline(vehiclePosition, routeCoordinates);
    const segStart = routeCoordinates[here.segmentIndex];
    const seg = routeCoordinates[Math.min(here.segmentIndex + 1, routeCoordinates.length - 1)];
    const deg = Math.round(bearing(segStart, seg));
    const compass = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
    const prog = progressAlongRoute(routeCoordinates, vehiclePosition);
    vehicleHeading = { degrees: deg, compass, progressMeters: Math.round(prog) };
  } catch { /* heading is informational only */ }

  for (const restaurant of restaurants) {
    // ── Corridor filter (Task A: 200 m hard threshold per brief) ─────────────────
    const corridorMatches = corridorFilter(routeCoordinates, [restaurant], corridorMeters);
    if (corridorMatches.length === 0) {
      rejected.push({
        restaurant,
        reasonCode: REASON_CODES.OUT_OF_CORRIDOR,
        reasonMessage: `Restaurant is beyond the ${corridorMeters}m lateral corridor from the highway.`
      });
      continue;
    }

    // ── Ahead filter (Task A: no backward travel) ─────────────────────────────────
    const aheadMatches = aheadFilter(routeCoordinates, vehiclePosition, [restaurant], 50);
    if (aheadMatches.length === 0) {
      rejected.push({
        restaurant,
        reasonCode: REASON_CODES.BEHIND_VEHICLE,
        reasonMessage: 'Restaurant is behind current vehicle progress along the route.'
      });
      continue;
    }

    // ── Hard preference filter ─────────────────────────────────────────────────────
    if (!ignorePreferences) {
      const violation = violatesHardPreference(restaurant, prefs);
      if (violation) {
        rejected.push({
          restaurant,
          reasonCode: REASON_CODES.PREFERENCE_MISMATCH,
          reasonMessage: violation
        });
        continue;
      }
    }

    // ── Side-of-road hard filter (Task B) ─────────────────────────────────────────
    // Bearing from vehicle to restaurant
    let restaurantBearingDeg = null;
    try {
      restaurantBearingDeg = Math.round(bearing(vehiclePosition, restaurant.location));
    } catch {}

    const proj = findNearestPointOnPolyline(restaurant.location, routeCoordinates);
    const sideOfRoad = proj.sideOfRoad; // 'left' | 'right' | 'on-route'

    // India drives on the LEFT. 'right' = opposite carriageway.
    // Reject if user opted in and graph confirms a U-turn is needed.
    if (rejectOppositeSide && sideOfRoad === 'right') {
      rejected.push({
        restaurant,
        reasonCode: REASON_CODES.WRONG_SIDE_OF_ROAD,
        reasonMessage: 'Restaurant is on the opposite carriageway (right side in left-hand traffic). Excluded to avoid U-turn / highway crossing.'
      });
      continue;
    }

    // ── Graph detour computation ────────────────────────────────────────────────────
    let detourResult;
    let etaOffsetSeconds = null;
    if (graphEval) {
      const g = graphEval.resultFor(restaurant);
      if (g.unmapped) {
        detourResult = calculateDetour(null, '', '', '', 0);
        detourResult.accessibilityReason = g.reason;
      } else {
        detourResult = g;
        etaOffsetSeconds = g.etaOffsetSeconds;
      }
    } else {
      const accessNodeId  = restaurant.accessPoint?.roadNodeId  || restaurant.id;
      const rejoinNodeId  = restaurant.accessPoint?.rejoinNodeId || vehicleNodeId;
      detourResult = calculateDetour(roadGraph, vehicleNodeId, accessNodeId, rejoinNodeId, 0);
    }

    // ── RED access filter ──────────────────────────────────────────────────────────
    if (!ignoreRedAccess && detourResult.accessibilityClass === 'RED') {
      rejected.push({
        restaurant,
        reasonCode: REASON_CODES.INACCESSIBLE_RED,
        reasonMessage: 'Inaccessible or requires prohibited median barrier crossing / dangerous U-turn.'
      });
      continue;
    }

    // ── Excessive detour filter ────────────────────────────────────────────────────
    if (!ignoreDetourLimit && detourResult.detourDistanceMeters > maxDetourMeters) {
      rejected.push({
        restaurant,
        reasonCode: REASON_CODES.EXCESSIVE_DETOUR,
        reasonMessage: `Detour of ${detourResult.detourDistanceMeters}m exceeds maximum allowed ${maxDetourMeters}m.`
      });
      continue;
    }

    // ── ETA & opening hours (Task C) ───────────────────────────────────────────────
    const eta = etaOffsetSeconds !== null
      ? computeEta(departureTime, etaOffsetSeconds, 0)
      : computeEta(departureTime, highwayDurationToVehicleSeconds, detourResult.detourDurationSeconds);
    const isOpen = restaurant.openingHours
      ? isOpenAt(eta, restaurant.openingHours.open, restaurant.openingHours.close)
      : true;

    if (!ignoreClosed && !isOpen) {
      rejected.push({
        restaurant,
        reasonCode: REASON_CODES.CLOSED_AT_ETA,
        reasonMessage: `Restaurant is closed at projected ETA (${formatTime12h(eta)}).`
      });
      continue;
    }

    // ── Meal window / food category (Task C) ──────────────────────────────────────
    const activeCategories = getActiveCategories(eta, restaurant);
    const hasCategory = requiredCategory
      ? activeCategories.some(c => c.toLowerCase().includes(requiredCategory.toLowerCase()))
      : true;

    if (!ignoreCategory && !hasCategory) {
      rejected.push({
        restaurant,
        reasonCode: REASON_CODES.CATEGORY_UNAVAILABLE,
        reasonMessage: `Requested category "${requiredCategory}" is not served at projected ETA window.`
      });
      continue;
    }

    // ── Component scoring ──────────────────────────────────────────────────────────
    const scoreComponents = calculateComponentScores({
      detourResult,
      maxDetourMeters,
      activeCategories,
      requiredCategory,
      isOpen,
      preferenceMatch: computePreferenceScore(restaurant, prefs),
      vehicleHeadingDeg:    vehicleHeading?.degrees ?? null,
      restaurantBearingDeg
    });

    const finalScore = Math.max(0, Math.min(100, Math.round(
      (weights.detourEfficiency    * scoreComponents.detourEfficiency    +
       weights.directionCompatibility * scoreComponents.directionCompatibility +
       weights.roadAccessibility   * scoreComponents.roadAccessibility   +
       weights.foodAvailability    * scoreComponents.foodAvailability    +
       weights.timeCompatibility   * scoreComponents.timeCompatibility   +
       (weights.preferenceMatch || 0) * scoreComponents.preferenceMatch) / 100
    )));

    const explanation = buildTemplatedExplanation(restaurant, detourResult, eta, activeCategories);

    eligible.push({
      restaurant,
      distanceFromRouteMeters: Math.round(proj.distanceFromRouteMeters),
      withinStrictCorridor: proj.distanceFromRouteMeters <= STRICT_HIGHWAY_CORRIDOR_METERS,
      sideOfRoad,
      restaurantBearingDeg,
      // Flag: opposite side but graph shows no crossover — data may be wrong
      sideWarning: (sideOfRoad === 'right' && detourResult.uTurnCount === 0 && detourResult.accessibilityClass === 'GREEN')
        ? 'Restaurant lies on the opposite carriageway, yet the mapped access path has no crossover - verify ramp data.'
        : null,
      finalScore,
      scoreComponents,
      detourResult,
      eta,
      activeCategoriesAtEta: activeCategories,
      explanation,
      rank: 0
    });
  }

  // ── Graceful degradation: sequential constraint relaxation ─────────────────────
  if (eligible.length === 0 && !relaxConstraint && rejected.length > 0) {
    for (const constraintToRelax of RELAXATION_ORDER) {
      const retryResult = recommendPitstops({
        routeCoordinates, vehiclePosition, restaurants, roadGraph, vehicleNodeId,
        departureTime, highwayDurationToVehicleSeconds, filters, weights,
        relaxConstraint: constraintToRelax, detourMode
      });
      if (retryResult.eligible.length > 0) {
        return {
          eligible: retryResult.eligible,
          rejected: retryResult.rejected,
          meta: { ...retryResult.meta, graphSnapshot },
          relaxationInfo: { wasRelaxed: true, relaxedConstraint: constraintToRelax }
        };
      }
    }
  }

  eligible.sort((a, b) => b.finalScore - a.finalScore);
  eligible.forEach((item, index) => { item.rank = index + 1; });

  return {
    eligible,
    rejected,
    meta: {
      detourMode: graphEval ? 'graph' : 'legacy',
      vehicleHeading,
      vehicleSnap: graphEval ? graphEval.snap : null,
      mainlineNodeCount: graphEval ? graphEval.mainline.size : 0,
      graphSnapshot   // ← live working graph for the visualizer
    },
    relaxationInfo: {
      wasRelaxed: Boolean(relaxConstraint),
      relaxedConstraint: relaxConstraint || undefined
    }
  };
}
