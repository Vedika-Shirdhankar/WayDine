import { useState, useEffect, useMemo } from 'react';
import { getRestaurants, getRoadGraph } from '../data/restaurantRepository.js';
import { rankCorridorPitstops, DEFAULT_WEIGHTS } from '../engine/recommendationEngine.js';

export function usePitstopEngine(activeRoute, vehicleDistanceMeters = 0) {
  const [allRestaurants, setAllRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter criteria
  const [maxDetourMinutes, setMaxDetourMinutes] = useState(15);
  const [preferredCategory, setPreferredCategory] = useState('');
  const [requireDriveThru, setRequireDriveThru] = useState(false);
  const [requireOpenAtEta, setRequireOpenAtEta] = useState(true);
  const [allowedAccessClasses, setAllowedAccessClasses] = useState(['GREEN', 'YELLOW', 'RED', 'Unverified']);
  const [departureTime, setDepartureTime] = useState(() => new Date());
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);

  // Load candidate restaurants
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getRestaurants({ routeId: activeRoute?.id })
      .then(data => {
        if (mounted) {
          setAllRestaurants(data);
          setIsLoading(false);
        }
      })
      .catch(err => {
        if (mounted) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => { mounted = false; };
  }, [activeRoute?.id]);

  // Road network graph instance (getRoadGraph is async: resolve it, don't memoise the Promise)
  const [roadGraph, setRoadGraph] = useState(null);
  useEffect(() => {
    let mounted = true;
    getRoadGraph().then(g => { if (mounted) setRoadGraph(g); }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Compute recommendations
  const recommendations = useMemo(() => {
    if (!activeRoute?.coordinates || activeRoute.coordinates.length < 2 || allRestaurants.length === 0) {
      return [];
    }

    try {
      return rankCorridorPitstops({
        route: activeRoute,
        restaurants: allRestaurants,
        vehicleProgressDistanceMeters: vehicleDistanceMeters,
        departureTime,
        roadGraph,
        filters: {
          maxDetourMinutes,
          preferredCategory,
          requireDriveThru,
          requireOpenAtEta,
          allowedAccessClasses
        },
        weights
      });
    } catch (err) {
      console.error('[usePitstopEngine] Ranking failure:', err);
      return [];
    }
  }, [
    activeRoute,
    allRestaurants,
    vehicleDistanceMeters,
    departureTime,
    roadGraph,
    maxDetourMinutes,
    preferredCategory,
    requireDriveThru,
    requireOpenAtEta,
    allowedAccessClasses,
    weights
  ]);

  // Selected recommendation details
  const selectedRecommendation = useMemo(() => {
    if (!selectedRestaurantId) return recommendations[0] || null;
    return recommendations.find(r => r.restaurant.id === selectedRestaurantId) || recommendations[0] || null;
  }, [recommendations, selectedRestaurantId]);

  return {
    recommendations,
    selectedRecommendation,
    selectedRestaurantId,
    setSelectedRestaurantId,
    isLoading,
    error,
    filters: {
      maxDetourMinutes,
      setMaxDetourMinutes,
      preferredCategory,
      setPreferredCategory,
      requireDriveThru,
      setRequireDriveThru,
      requireOpenAtEta,
      setRequireOpenAtEta,
      allowedAccessClasses,
      setAllowedAccessClasses,
      departureTime,
      setDepartureTime
    },
    weights,
    setWeights,
    totalCount: allRestaurants.length
  };
}
