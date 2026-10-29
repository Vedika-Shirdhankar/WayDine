/**
 * @file recommendationEngine.js
 * Multi-criteria deterministic ranking engine with hard-constraint elimination,
 * documented constraint relaxation, and templated explanations.
 * Pure mathematical scoring - ZERO AI/ML/LLM.
 */

import { assertWeightsSumTo100 } from './validators.js';
import { corridorFilter, aheadFilter, discoverCorridorRestaurants } from './restaurantFilter.js';
import { calculateDetour, calculateDetourMetrics } from './detourCalculator.js';
import { computeEta, isOpenAt, getActiveCategories, evaluateFoodSuitability } from './foodRulesEngine.js';

export const DEFAULT_WEIGHTS = {
  detourEfficiency: 30,
  directionCompatibility: 25,
  roadAccessibility: 20,
  foodAvailability: 15,
  timeCompatibility: 10
};

export const REASON_CODES = {
  OUT_OF_CORRIDOR: 'OUT_OF_CORRIDOR',
  BEHIND_VEHICLE: 'BEHIND_VEHICLE',
  INACCESSIBLE_RED: 'INACCESSIBLE_RED',
  CLOSED_AT_ETA: 'CLOSED_AT_ETA',
  CATEGORY_UNAVAILABLE: 'CATEGORY_UNAVAILABLE',
  EXCESSIVE_DETOUR: 'EXCESSIVE_DETOUR'
};

export const RELAXATION_ORDER = [
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

export function calculateComponentScores({
  detourResult,
  maxDetourMeters,
  activeCategories,
  requiredCategory,
  isOpen
}) {
  const dist = Math.max(0, detourResult.detourDistanceMeters || 0);
  const detourEfficiency = Math.max(0, Math.min(100, Math.round(100 * (1 - dist / (maxDetourMeters || 2000)))));

  let directionCompatibility = 100;
  if (detourResult.uTurnCount > 0) {
    directionCompatibility = Math.max(0, 100 - detourResult.uTurnCount * 45);
  } else if (detourResult.turnCount > 2) {
    directionCompatibility = Math.max(40, 100 - (detourResult.turnCount - 2) * 15);
  }

  let roadAccessibility = 40;
  if (detourResult.accessibilityClass === 'GREEN') roadAccessibility = 100;
  else if (detourResult.accessibilityClass === 'YELLOW') roadAccessibility = 65;
  else if (detourResult.accessibilityClass === 'RED') roadAccessibility = 15;

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
    timeCompatibility
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
  relaxConstraint = null
}) {
  assertWeightsSumTo100(weights);

  const corridorMeters = filters.corridorMeters || 500;
  const maxDetourMeters = filters.maxDetourMeters || 2500;
  const requiredCategory = filters.requiredCategory || '';

  const ignoreCategory = relaxConstraint === REASON_CODES.CATEGORY_UNAVAILABLE;
  const ignoreDetourLimit = relaxConstraint === REASON_CODES.EXCESSIVE_DETOUR;
  const ignoreRedAccess = relaxConstraint === REASON_CODES.INACCESSIBLE_RED;
  const ignoreClosed = relaxConstraint === REASON_CODES.CLOSED_AT_ETA;

  const eligible = [];
  const rejected = [];

  for (const restaurant of restaurants) {
    const corridorMatches = corridorFilter(routeCoordinates, [restaurant], corridorMeters);
    if (corridorMatches.length === 0) {
      rejected.push({
        restaurant,
        reasonCode: REASON_CODES.OUT_OF_CORRIDOR,
        reasonMessage: `Restaurant is beyond lateral corridor threshold of ${corridorMeters}m.`
      });
      continue;
    }

    const aheadMatches = aheadFilter(routeCoordinates, vehiclePosition, [restaurant], 50);
    if (aheadMatches.length === 0) {
      rejected.push({
        restaurant,
        reasonCode: REASON_CODES.BEHIND_VEHICLE,
        reasonMessage: 'Restaurant is behind current vehicle progress along the route.'
      });
      continue;
    }

    const accessNodeId = restaurant.accessPoint?.roadNodeId || restaurant.id;
    const rejoinNodeId = restaurant.accessPoint?.rejoinNodeId || vehicleNodeId;

    const detourResult = calculateDetour(
      roadGraph,
      vehicleNodeId,
      accessNodeId,
      rejoinNodeId,
      0
    );

    if (!ignoreRedAccess && detourResult.accessibilityClass === 'RED') {
      rejected.push({
        restaurant,
        reasonCode: REASON_CODES.INACCESSIBLE_RED,
        reasonMessage: 'Inaccessible or requires prohibited median barrier crossing / dangerous U-turn.'
      });
      continue;
    }

    if (!ignoreDetourLimit && detourResult.detourDistanceMeters > maxDetourMeters) {
      rejected.push({
        restaurant,
        reasonCode: REASON_CODES.EXCESSIVE_DETOUR,
        reasonMessage: `Detour of ${detourResult.detourDistanceMeters}m exceeds maximum allowed ${maxDetourMeters}m.`
      });
      continue;
    }

    const eta = computeEta(departureTime, highwayDurationToVehicleSeconds, detourResult.detourDurationSeconds);
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

    const scoreComponents = calculateComponentScores({
      detourResult,
      maxDetourMeters,
      activeCategories,
      requiredCategory,
      isOpen
    });

    const finalScore = Math.max(0, Math.min(100, Math.round(
      (weights.detourEfficiency * scoreComponents.detourEfficiency +
       weights.directionCompatibility * scoreComponents.directionCompatibility +
       weights.roadAccessibility * scoreComponents.roadAccessibility +
       weights.foodAvailability * scoreComponents.foodAvailability +
       weights.timeCompatibility * scoreComponents.timeCompatibility) / 100
    )));

    const explanation = buildTemplatedExplanation(restaurant, detourResult, eta, activeCategories);

    eligible.push({
      restaurant,
      finalScore,
      scoreComponents,
      detourResult,
      eta,
      activeCategoriesAtEta: activeCategories,
      explanation,
      rank: 0
    });
  }

  if (eligible.length === 0 && !relaxConstraint && rejected.length > 0) {
    for (const constraintToRelax of RELAXATION_ORDER) {
      const retryResult = recommendPitstops({
        routeCoordinates,
        vehiclePosition,
        restaurants,
        roadGraph,
        vehicleNodeId,
        departureTime,
        highwayDurationToVehicleSeconds,
        filters,
        weights,
        relaxConstraint: constraintToRelax
      });

      if (retryResult.eligible.length > 0) {
        return {
          eligible: retryResult.eligible,
          rejected: retryResult.rejected,
          relaxationInfo: {
            wasRelaxed: true,
            relaxedConstraint: constraintToRelax
          }
        };
      }
    }
  }

  eligible.sort((a, b) => b.finalScore - a.finalScore);
  eligible.forEach((item, index) => {
    item.rank = index + 1;
  });

  return {
    eligible,
    rejected,
    relaxationInfo: {
      wasRelaxed: Boolean(relaxConstraint),
      relaxedConstraint: relaxConstraint || undefined
    }
  };
}

export function calculatePitstopScore({
  detourMetrics,
  accessClass,
  rating,
  foodSuitability,
  matchesPreferences
}) {
  const detourScore = detourMetrics?.detourPenaltyScore ?? 50;
  const accessScore = accessClass === 'GREEN' ? 100 : accessClass === 'YELLOW' ? 65 : accessClass === 'RED' ? 15 : 40;
  const ratingScore = Math.round(((rating || 3.5) / 5) * 100);
  const foodEtaScore = foodSuitability?.timingMatchScore ?? 50;
  const preferenceScore = matchesPreferences ? 100 : 40;

  const rawScore =
    0.35 * detourScore +
    0.25 * accessScore +
    0.15 * ratingScore +
    0.15 * foodEtaScore +
    0.10 * preferenceScore;

  return {
    finalScore: Math.round(rawScore * 10) / 10,
    scoreBreakdown: {
      detourScore: Math.round(detourScore),
      accessScore: Math.round(accessScore),
      ratingScore: Math.round(ratingScore),
      foodEtaScore: Math.round(foodEtaScore),
      preferenceScore: Math.round(preferenceScore)
    }
  };
}

export function rankCorridorPitstops({
  route,
  restaurants,
  vehicleProgressDistanceMeters = 0,
  departureTime = new Date(),
  roadGraph = null,
  filters = {}
}) {
  const candidates = discoverCorridorRestaurants(
    restaurants,
    route.coordinates,
    vehicleProgressDistanceMeters,
    { maxCorridorMeters: 5000, roadGraph }
  );

  const evaluated = [];

  for (const candidate of candidates) {
    const detourMetrics = calculateDetourMetrics(
      candidate,
      candidate.nearestRoutePoint,
      roadGraph
    );

    const foodSuitability = evaluateFoodSuitability(
      candidate,
      departureTime,
      candidate.distanceAlongRouteMeters ? Math.round(candidate.distanceAlongRouteMeters / 25) : 0
    );

    const { finalScore, scoreBreakdown } = calculatePitstopScore({
      detourMetrics,
      accessClass: candidate.accessClass,
      rating: candidate.rating,
      foodSuitability,
      matchesPreferences: true
    });

    evaluated.push({
      restaurant: candidate,
      detourMetrics,
      foodSuitability,
      finalScore,
      scoreBreakdown,
      rank: 0,
      rationale: `Rank: ${candidate.accessClass} access. Adds +${(detourMetrics.detourDurationSeconds / 60).toFixed(1)}m detour.`
    });
  }

  evaluated.sort((a, b) => b.finalScore - a.finalScore);
  evaluated.forEach((item, index) => {
    item.rank = index + 1;
  });

  return evaluated;
}
