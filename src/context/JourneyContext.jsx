import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getRepository, getRoutes } from '../data/restaurantRepository.js';
import { calculateRouteService, getDemoRouteService } from '../services/routingService.js';
import { recommendPitstops } from '../engine/recommendationEngine.js';
import { interpolatePositionAlongRoute, computePolylineDistanceMeters } from '../engine/geoUtils.js';
import { useToast } from '../components/Toast.jsx';
import { formatTimeIST } from '../utils/indiaDefaults.js';

const JourneyContext = createContext(null);

/**
 * Normalize raw recommendPitstops() output into UI-ready shape.
 * Adds: detourResult (alias for detourResult), foodSuitability, scoreBreakdown, rationale.
 * @param {{ eligible: Array, rejected: Array, relaxationInfo: object }} raw
 * @returns {{ eligible: Array, rejected: Array, relaxationInfo: object }}
 */
function normalizeEngineResults(raw) {
  const eligible = (raw.eligible || []).map(item => {
    const dr = item.detourResult || {};
    const eta = item.eta ? new Date(item.eta) : new Date();
    const etaStr = formatTimeIST(eta);

    const isOpenAtEta = item.activeCategoriesAtEta?.length > 0 ||
      (item.restaurant.openingHours
        ? isOpenAtEtaCheck(eta, item.restaurant.openingHours)
        : true);

    const mealWindow = guessMealWindow(eta);

    const foodSuitability = {
      projectedEta: etaStr,
      isOpenAtEta,
      mealWindow,
      availableCategoriesAtEta: item.activeCategoriesAtEta || [],
      statusMessage: isOpenAtEta
        ? `Open at ETA. Active menu: ${(item.activeCategoriesAtEta || []).join(', ') || 'All categories'}.`
        : `Closed at your projected ${etaStr} arrival.`
    };

    // Build scoreBreakdown from scoreComponents (engine naming)
    const sc = item.scoreComponents || {};
    const scoreBreakdown = {
      detourScore:     sc.detourEfficiency      ?? 0,
      accessScore:     sc.roadAccessibility     ?? 0,
      ratingScore:     sc.directionCompatibility ?? 0,
      foodEtaScore:    sc.foodAvailability       ?? 0,
      preferenceScore: sc.timeCompatibility      ?? 0
    };

    return {
      ...item,
      detourResult: dr,
      // Alias for old component code using detourMetrics
      detourMetrics: {
        detourDistanceMeters: dr.detourDistanceMeters || 0,
        detourDurationSeconds: dr.detourDurationSeconds || 0,
        uTurnCount: dr.uTurnCount || 0,
        turnCount: dr.turnCount || 0,
        uTurnPenaltySeconds: dr.uTurnPenaltySeconds || 0
      },
      foodSuitability,
      scoreBreakdown,
      rationale: item.explanation || ''
    };
  });

  return {
    eligible,
    rejected: raw.rejected || [],
    relaxationInfo: raw.relaxationInfo || { wasRelaxed: false }
  };
}

/** Simple open check by hour range string "HH:MM-HH:MM" or object { open, close } */
function isOpenAtEtaCheck(eta, hours) {
  try {
    const parseHour = s => {
      if (!s) return 0;
      const [h, m] = s.split(':').map(Number);
      return h * 60 + (m || 0);
    };
    const etaMin = eta.getHours() * 60 + eta.getMinutes();
    const openMin  = parseHour(hours.open  || hours.opens  || '06:00');
    let closeMin   = parseHour(hours.close || hours.closes || '23:00');
    // Handle past-midnight
    if (closeMin < openMin) closeMin += 24 * 60;
    return etaMin >= openMin && etaMin <= closeMin;
  } catch { return true; }
}

/** Guess the meal window name from the ETA hour */
function guessMealWindow(eta) {
  const h = eta.getHours();
  if (h >= 6  && h < 11) return 'Breakfast';
  if (h >= 11 && h < 15) return 'Lunch';
  if (h >= 15 && h < 18) return 'Snacks';
  if (h >= 18 && h < 23) return 'Dinner';
  return 'Late Night';
}

export function JourneyProvider({ children }) {
  const { addToast } = useToast();

  // Route & Journey state
  const [route, setRoute] = useState(null);
  const [routesList, setRoutesList] = useState([]);
  const [startPoint, setStartPoint] = useState({ name: 'Mumbai (Eastern Express)', location: [19.0760, 72.8777] });
  const [destinationPoint, setDestinationPoint] = useState({ name: 'Pune (Kiwale / Wakad)', location: [18.5204, 73.8567] });
  const [departureTime, setDepartureTime] = useState(() => new Date('2026-10-29T11:00:00'));
  const [travelMode, setTravelMode] = useState('car'); // 'car' | 'express' | 'truck'

  // Vehicle progress simulation
  const [vehicleDistanceMeters, setVehicleDistanceMeters] = useState(25000); // Default at Kalamboli (KM 25)

  // Filters
  const [filters, setFilters] = useState({
    maxDetourMeters: 2500,
    preferredCategory: 'Lunch',
    dietaryPreference: '',
    budget: '$$',
    travelMode: 'car'
  });

  // Engine output
  const [engineResults, setEngineResults] = useState({
    eligible: [],
    rejected: [],
    relaxationInfo: { wasRelaxed: false }
  });

  // Selection & preview
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [previewDetourRestaurantId, setPreviewDetourRestaurantId] = useState(null);
  const [compareList, setCompareList] = useState([]); // Max 5 items
  const [dataSourceTag, setDataSourceTag] = useState('Demo fallback');
  const [isLoading, setIsLoading] = useState(false);
  const [isEngineCalculating, setIsEngineCalculating] = useState(false);
  const [error, setError] = useState(null);

  // Load route presets on mount
  useEffect(() => {
    getRoutes().then(list => setRoutesList(list)).catch(() => {});
  }, []);

  // Compute interpolated vehicle position
  const vehicleState = useMemo(() => {
    if (!route?.coordinates || route.coordinates.length < 2) {
      return { position: [19.0144, 73.1025], bearing: 0, segmentIndex: 0 };
    }
    return interpolatePositionAlongRoute(route.coordinates, vehicleDistanceMeters);
  }, [route, vehicleDistanceMeters]);

  const totalRouteMeters = useMemo(() => {
    if (!route?.coordinates || route.coordinates.length < 2) return 148500;
    return route.totalDistanceMeters || computePolylineDistanceMeters(route.coordinates);
  }, [route]);

  const vehicleProgressPercent = totalRouteMeters > 0
    ? Math.min(100, Math.round((vehicleDistanceMeters / totalRouteMeters) * 100))
    : 0;

  // Run the core engine with current route & filters
  const runEngine = useCallback(async (currentRoute, vehicleMeters = vehicleDistanceMeters, currentFilters = filters) => {
    if (!currentRoute?.coordinates || currentRoute.coordinates.length < 2) return;

    setIsEngineCalculating(true);
    try {
      const repo = getRepository();
      const restaurants = await repo.getRestaurants({
        dietaryOption: currentFilters.dietaryPreference,
        priceRange: currentFilters.budget !== 'Any' ? currentFilters.budget : undefined
      });
      const roadGraph = await repo.getRoadGraph();
      const demoParams = await repo.getDemoParameters();

      // Estimate vehicle node
      const vehicleNodeId = demoParams?.vehicleNodeId || 'NODE_KALAMBOLI';
      const highwayDurationToVehicleSeconds = Math.round(vehicleMeters / 25); // ~90 km/h

      // Read custom weights or engine config from localStorage if configured
      let customWeights = undefined;
      try {
        const rawW = localStorage.getItem('waydine_weights');
        if (rawW) {
          const parsed = JSON.parse(rawW);
          const total = Object.values(parsed).reduce((a, b) => a + b, 0);
          if (total === 100) customWeights = parsed;
        }
      } catch {}

      let customEngineConfig = {};
      try {
        const rawC = localStorage.getItem('waydine_engine_config');
        if (rawC) customEngineConfig = JSON.parse(rawC);
      } catch {}

      const corridorM = customEngineConfig.corridorMeters || 500;
      const maxDetourM = currentFilters.maxDetourMeters || customEngineConfig.maxDetourMeters || 2500;

      const results = recommendPitstops({
        routeCoordinates: currentRoute.coordinates,
        vehiclePosition: vehicleState.position,
        restaurants,
        roadGraph,
        vehicleNodeId,
        departureTime,
        highwayDurationToVehicleSeconds,
        filters: {
          corridorMeters: corridorM,
          maxDetourMeters: maxDetourM,
          requiredCategory: currentFilters.preferredCategory !== 'All' ? currentFilters.preferredCategory : ''
        },
        ...(customWeights ? { weights: customWeights } : {})
      });

      // Normalize engine output to UI-friendly shapes
      const normalized = normalizeEngineResults(results);
      setEngineResults(normalized);

      // Auto-select top recommendation if none selected
      if (results.eligible.length > 0) {
        if (!selectedRestaurantId || !results.eligible.some(r => r.restaurant.id === selectedRestaurantId)) {
          setSelectedRestaurantId(results.eligible[0].restaurant.id);
        }
      }

      if (results.relaxationInfo?.wasRelaxed) {
        addToast(`Constraint relaxed: ${results.relaxationInfo.relaxedConstraint} (broadened criteria to surface options)`, 'warning');
      }
    } catch (err) {
      console.error('[JourneyContext] Engine error:', err);
      setError(err.message);
      addToast('Engine calculation error: ' + err.message, 'danger');
    } finally {
      setIsEngineCalculating(false);
    }
  }, [vehicleDistanceMeters, filters, vehicleState.position, departureTime, selectedRestaurantId, addToast]);

  // "Load Demo Journey" button action - instantly loads demo route & runs engine
  const loadDemoJourney = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const demoRoute = await getDemoRouteService();
      if (!demoRoute) throw new Error('Demo route unavailable');

      setRoute(demoRoute);
      setStartPoint({ name: demoRoute.origin?.name || 'Mumbai', location: demoRoute.coordinates[0] });
      const lastCoord = demoRoute.coordinates[demoRoute.coordinates.length - 1];
      setDestinationPoint({ name: demoRoute.destination?.name || 'Pune', location: lastCoord });

      setVehicleDistanceMeters(25000); // KM 25 Kalamboli
      setDataSourceTag('Demo fallback');

      addToast('Mumbai to Pune Demo Journey loaded (148.5 km, Sample/Demo)', 'success');
      await runEngine(demoRoute, 25000, filters);
    } catch (err) {
      console.error('[loadDemoJourney] Error:', err);
      setError(err.message);
      addToast('Failed to load demo journey: ' + err.message, 'danger');
    } finally {
      setIsLoading(false);
    }
  }, [runEngine, filters, addToast]);

  // "Find Best Pitstops" button action
  const findBestPitstops = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Calculate route via routingService
      const calculatedRoute = await calculateRouteService(startPoint.location, destinationPoint.location);
      setRoute(calculatedRoute);
      setDataSourceTag(calculatedRoute.dataSource === 'live-osrm' ? 'Live (OSRM)' : 'Demo fallback');

      addToast(`Route calculated (${(calculatedRoute.distanceMeters / 1000).toFixed(1)} km) via ${calculatedRoute.dataSource}`, 'success');
      await runEngine(calculatedRoute, vehicleDistanceMeters, filters);
    } catch (err) {
      console.warn('[findBestPitstops] Route service failed, using fallback route:', err.message);
      await loadDemoJourney();
    } finally {
      setIsLoading(false);
    }
  }, [startPoint, destinationPoint, vehicleDistanceMeters, filters, runEngine, loadDemoJourney, addToast]);

  // Initialize demo journey on first mount
  useEffect(() => {
    loadDemoJourney();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update vehicle distance
  const setVehicleProgressPercent = (percent) => {
    const clampedPct = Math.max(0, Math.min(100, percent));
    const meters = (clampedPct / 100) * totalRouteMeters;
    setVehicleDistanceMeters(meters);
    if (route) {
      runEngine(route, meters, filters);
    }
  };

  const setVehicleProgressDistance = (meters) => {
    const clamped = Math.max(0, Math.min(totalRouteMeters, meters));
    setVehicleDistanceMeters(clamped);
    if (route) {
      runEngine(route, clamped, filters);
    }
  };

  // Compare List management (max 5)
  const toggleCompareRestaurant = (restaurant) => {
    if (!restaurant) return;
    setCompareList(prev => {
      const exists = prev.some(r => r.id === restaurant.id);
      if (exists) {
        addToast(`Removed ${restaurant.name} from comparison`, 'info');
        return prev.filter(r => r.id !== restaurant.id);
      }
      if (prev.length >= 5) {
        addToast('Comparison limit reached (max 5 restaurants)', 'warning');
        return prev;
      }
      addToast(`Added ${restaurant.name} to comparison (${prev.length + 1}/5)`, 'success');
      return [...prev, restaurant];
    });
  };

  const updateFilters = (newFilters) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    if (route) {
      runEngine(route, vehicleDistanceMeters, updated);
    }
  };

  const selectedRecommendation = useMemo(() => {
    if (!selectedRestaurantId) return engineResults.eligible[0] || null;
    return engineResults.eligible.find(r => r.restaurant.id === selectedRestaurantId) ||
           engineResults.eligible[0] || null;
  }, [engineResults.eligible, selectedRestaurantId]);

  return (
    <JourneyContext.Provider
      value={{
        route,
        routesList,
        startPoint,
        setStartPoint,
        destinationPoint,
        setDestinationPoint,
        departureTime,
        setDepartureTime,
        travelMode,
        setTravelMode,
        vehicleDistanceMeters,
        vehiclePosition: vehicleState.position,
        vehicleBearing: vehicleState.bearing,
        vehicleProgressPercent,
        totalRouteMeters,
        setVehicleProgressDistance,
        setVehicleProgressPercent,
        filters,
        updateFilters,
        engineResults,
        selectedRestaurantId,
        setSelectedRestaurantId,
        selectedRecommendation,
        previewDetourRestaurantId,
        setPreviewDetourRestaurantId,
        compareList,
        toggleCompareRestaurant,
        dataSourceTag,
        isLoading,
        isEngineCalculating,
        error,
        loadDemoJourney,
        findBestPitstops,
        runEngine
      }}
    >
      {children}
    </JourneyContext.Provider>
  );
}

export function useJourneyEngine() {
  const context = useContext(JourneyContext);
  if (!context) {
    throw new Error('useJourneyEngine must be used within JourneyProvider');
  }
  return context;
}
