import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getRepository, getRoutes } from '../data/restaurantRepository.js';
import { calculateRouteService, getDemoRouteService } from '../services/routingService.js';
import { fetchOsmRestaurantsAlongRoute } from '../services/osmOverpassService.js';
import { recommendPitstops, DEFAULT_WEIGHTS } from '../engine/recommendationEngine.js';
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

    // Build scoreBreakdown from scoreComponents (engine naming) — labels match actual factors
    const sc = item.scoreComponents || {};
    const scoreBreakdown = {
      detourScore:       sc.detourEfficiency      ?? 0,  // Detour Efficiency
      directionScore:    sc.directionCompatibility ?? 0,  // Direction Compatibility (bearing + turns)
      accessScore:       sc.roadAccessibility     ?? 0,  // Road Accessibility (GREEN/YELLOW/RED)
      foodEtaScore:      sc.foodAvailability       ?? 0,  // Food Availability at ETA
      timeScore:         sc.timeCompatibility      ?? 0,  // Time / Open-at-ETA
      preferenceScore:   sc.preferenceMatch        ?? 0   // User Preferences
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
  // Default to current time so meal windows and ETA calculations are accurate
  const [departureTime, setDepartureTime] = useState(() => new Date());
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
  // Live working graph snapshot — fed to the Dijkstra visualizer
  const [graphSnapshot, setGraphSnapshot] = useState(null);
  // Vehicle heading from engine meta
  const [vehicleHeading, setVehicleHeading] = useState(null);

  // Selection & preview
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [previewDetourRestaurantId, setPreviewDetourRestaurantId] = useState(null);
  const [compareList, setCompareList] = useState([]); // Max 5 items
  const [dataSourceTag, setDataSourceTag] = useState('Demo fallback');
  const [isOsmFetching, setIsOsmFetching] = useState(false);
  const [osmCount, setOsmCount] = useState(0);
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
  const runEngine = useCallback(async (currentRouteOrOverride = null, vehicleMetersOrDist = null, customFilters = null, customWeights = null, currentTime = null) => {
    const currentRoute = currentRouteOrOverride || route;
    const coords = currentRoute?.coordinates || currentRoute?.geometry;
    if (!coords || coords.length < 2) return;

    setIsEngineCalculating(true);
    try {
      const activeRoute = {
        ...currentRoute,
        coordinates: coords,
        totalDistanceMeters: currentRoute.totalDistanceMeters || currentRoute.distanceMeters || computePolylineDistanceMeters(coords)
      };

      const effectiveDist = (vehicleMetersOrDist !== null && vehicleMetersOrDist !== undefined) ? vehicleMetersOrDist : vehicleDistanceMeters;
      const effectiveFilters = customFilters || filters;
      const effectiveTime = currentTime || departureTime;

      const repo = getRepository();
      let baseRestaurants = await repo.getRestaurants({
        dietaryOption: effectiveFilters.dietaryPreference
        // Budget is NOT applied here: the repository matches price EXACTLY, which silently dropped every
        // other tier before the engine ran. The engine treats budget as a ceiling (<=) and scores it.
      });
      let restaurants = [...baseRestaurants];
      if (effectiveFilters.extraVenues && Array.isArray(effectiveFilters.extraVenues)) {
        restaurants = [...restaurants, ...effectiveFilters.extraVenues];
      }
      const roadGraph = await repo.getRoadGraph();

      // Compute vehicle position directly for effectiveDist along active route
      const currentVehicleState = interpolatePositionAlongRoute(coords, effectiveDist);
      const currentVehiclePos = currentVehicleState?.position || coords[0];

      // The vehicle's graph node is SNAPPED by the engine (last mainline node already passed);
      // nothing is hardcoded per kilometre any more.
      const vehicleNodeId = '';

      // Elapsed driving time at the vehicle, proportional to the route's own duration.
      const routeTotalSeconds = activeRoute.totalDurationSeconds || currentRoute.durationSeconds || 0;
      const highwayDurationToVehicleSeconds = routeTotalSeconds > 0 && activeRoute.totalDistanceMeters > 0
        ? Math.round(routeTotalSeconds * Math.min(1, effectiveDist / activeRoute.totalDistanceMeters))
        : Math.round(effectiveDist / 25);

      // Read custom weights from localStorage — guard: ensure all 6 keys exist and sum to 100
      let parsedWeights = customWeights;
      if (!parsedWeights) {
        try {
          const rawW = localStorage.getItem('waydine_weights');
          if (rawW) {
            const stored = JSON.parse(rawW);
            // Merge with defaults so all 6 keys are always present
            const merged = { ...DEFAULT_WEIGHTS, ...stored };
            const total = Object.values(merged).reduce((a, b) => a + b, 0);
            if (Math.abs(total - 100) < 1) {
              parsedWeights = merged;
            }
          }
        } catch {}
      }

      let customEngineConfig = {};
      try {
        const rawC = localStorage.getItem('waydine_engine_config');
        if (rawC) customEngineConfig = JSON.parse(rawC);
      } catch {}

      // Corridor: per brief = 200m. Use 500m as candidate buffer if user hasn't set a preference.
      const corridorM = customEngineConfig.corridorMeters || effectiveFilters.corridorMeters || 500;
      const maxDetourM = effectiveFilters.maxDetourMeters || customEngineConfig.maxDetourMeters || 2500;

      const results = recommendPitstops({
        routeCoordinates: coords,
        vehiclePosition: currentVehiclePos,
        restaurants,
        roadGraph,
        vehicleNodeId,
        departureTime: effectiveTime,
        highwayDurationToVehicleSeconds,
        filters: {
          corridorMeters: corridorM,
          maxDetourMeters: maxDetourM,
          requiredCategory: effectiveFilters.preferredCategory !== 'All' ? effectiveFilters.preferredCategory : '',
          preferences: {
            diet: effectiveFilters.dietaryPreference || '',
            maxPrice: effectiveFilters.budget && effectiveFilters.budget !== 'Any' ? effectiveFilters.budget : '',
            requireDriveThru: !!effectiveFilters.requireDriveThru
          }
        },
        ...(parsedWeights ? { weights: parsedWeights } : {})
      });

      // Normalize engine output to UI-friendly shapes
      const normalized = normalizeEngineResults(results);
      setEngineResults(normalized);

      // Store live graph snapshot for Dijkstra visualizer
      if (results.meta?.graphSnapshot) {
        setGraphSnapshot(results.meta.graphSnapshot);
      }
      // Store vehicle heading
      if (results.meta?.vehicleHeading) {
        setVehicleHeading(results.meta.vehicleHeading);
      }

      // Persist computed recommendations to Supabase / Local repository
      if (activeRoute?.id && results.eligible.length > 0) {
        getRepository().saveRecommendations(activeRoute.id, results.eligible).catch(() => {});
      }

      // Auto-select top recommendation if none selected or if previous selection not in new list
      if (results.eligible.length > 0) {
        if (!selectedRestaurantId || !results.eligible.some(r => r.restaurant.id === selectedRestaurantId)) {
          setSelectedRestaurantId(results.eligible[0].restaurant.id);
        }
      } else {
        setSelectedRestaurantId(null);
      }

      // relaxationInfo is safely preserved in engineResults for UI display without spamming toast loops
    } catch (err) {
      console.error('[JourneyContext] Engine error:', err);
      setError(err.message);
      addToast('Engine calculation error: ' + err.message, 'danger');
    } finally {
      setIsEngineCalculating(false);
    }
  }, [route, vehicleDistanceMeters, filters, departureTime, selectedRestaurantId, addToast]);

  // "Load Demo Journey" button action - instantly loads demo route & runs engine
  const loadDemoJourney = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const demoRoute = await getDemoRouteService();
      if (!demoRoute) throw new Error('Demo route unavailable');

      setRoute(demoRoute);
      getRepository().saveRoute(demoRoute).catch(() => {});
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
      setVehicleDistanceMeters(0);
      getRepository().saveRoute(calculatedRoute).catch(() => {});
      setDataSourceTag(calculatedRoute.dataSource === 'live-osrm' ? 'Live (OSRM)' : 'Demo fallback');

      addToast(`Route calculated (${(calculatedRoute.distanceMeters / 1000).toFixed(1)} km) via ${calculatedRoute.dataSource}`, 'success');
      await runEngine(calculatedRoute, 0, filters);
    } catch (err) {
      console.warn('[findBestPitstops] Route service failed, using fallback route:', err.message);
      try {
        const fallbackRoute = await calculateRouteService(startPoint.location, destinationPoint.location, { forceOffline: true });
        setRoute(fallbackRoute);
        setVehicleDistanceMeters(0);
        setDataSourceTag('Demo fallback');
        addToast(`Route calculated (${(fallbackRoute.distanceMeters / 1000).toFixed(1)} km) via estimated highway path`, 'warning');
        await runEngine(fallbackRoute, 0, filters);
      } catch (fallbackErr) {
        addToast('Unable to calculate route for the selected locations.', 'danger');
      }
    } finally {
      setIsLoading(false);
    }
  }, [startPoint, destinationPoint, filters, runEngine, addToast]);

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
      runEngine(route, vehicleDistanceMeters, updated, departureTime);
    }
  };

  const changeDepartureTime = (newTime) => {
    setDepartureTime(newTime);
    if (route) {
      runEngine(route, vehicleDistanceMeters, filters, newTime);
    }
  };

  const updateStartPoint = async (place) => {
    setStartPoint(place);
    if (destinationPoint && place.name !== destinationPoint.name) {
      try {
        setIsLoading(true);
        const calculatedRoute = await calculateRouteService(place.location, destinationPoint.location);
        setRoute(calculatedRoute);
        setVehicleDistanceMeters(0);
        await runEngine(calculatedRoute, 0, filters, departureTime);
      } catch (e) {
        console.warn('Recalculating route failed on start change:', e);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const updateDestinationPoint = async (place) => {
    setDestinationPoint(place);
    if (startPoint && place.name !== startPoint.name) {
      try {
        setIsLoading(true);
        const calculatedRoute = await calculateRouteService(startPoint.location, place.location);
        setRoute(calculatedRoute);
        setVehicleDistanceMeters(0);
        await runEngine(calculatedRoute, 0, filters, departureTime);
      } catch (e) {
        console.warn('Recalculating route failed on destination change:', e);
      } finally {
        setIsLoading(false);
      }
    }
  };


  const fetchLiveOsmVenues = async () => {
    if (!route || !route.coordinates || route.coordinates.length < 2) {
      addToast('Please select a route first to fetch live OSM venues', 'warning');
      return;
    }
    setIsOsmFetching(true);
    addToast('Querying OpenStreetMap Overpass API for real corridor venues...', 'info');
    try {
      const osmVenues = await fetchOsmRestaurantsAlongRoute(route.coordinates);
      if (osmVenues.length === 0) {
        addToast('No new venues found along this corridor in OpenStreetMap', 'info');
      } else {
        setOsmCount(osmVenues.length);
        addToast(`Found ${osmVenues.length} real venues from OpenStreetMap! Re-scoring corridor...`, 'success');
        updateFilters({ extraVenues: osmVenues });
      }
    } catch (err) {
      console.error('OSM fetch error:', err);
      addToast('Could not fetch from OpenStreetMap (Overpass API rate-limit/offline)', 'danger');
    } finally {
      setIsOsmFetching(false);
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
        setDepartureTime: changeDepartureTime,
        changeDepartureTime,
        updateStartPoint,
        updateDestinationPoint,
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
        runEngine,
        graphSnapshot,      // live Dijkstra-working-graph for visualizer
        vehicleHeading,      // current travel bearing + compass
        isOsmFetching,
        osmCount,
        fetchLiveOsmVenues
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
