import { useState, useEffect, useCallback } from 'react';
import { getRoutes, getRouteById } from '../data/restaurantRepository.js';
import { loadRoute, calculateCustomRoute } from '../services/routingService.js';

export function useRoutePlanning(initialRouteId = 'route-sf-monterey') {
  const [routesList, setRoutesList] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(initialRouteId);
  const [activeRoute, setActiveRoute] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveRoutingEnabled, setLiveRoutingEnabled] = useState(true);

  // Load available presets
  useEffect(() => {
    let mounted = true;
    getRoutes().then(routes => {
      if (mounted) {
        setRoutesList(routes);
      }
    });
    return () => { mounted = false; };
  }, []);

  // Fetch or calculate active route
  const refreshRoute = useCallback(async (routeId, useLive = liveRoutingEnabled) => {
    setIsLoading(true);
    setError(null);
    try {
      const route = await loadRoute(routeId, !useLive);
      setActiveRoute(route);
    } catch (err) {
      setError(err.message || 'Failed to calculate route.');
    } finally {
      setIsLoading(false);
    }
  }, [liveRoutingEnabled]);

  useEffect(() => {
    refreshRoute(selectedRouteId, liveRoutingEnabled);
  }, [selectedRouteId, liveRoutingEnabled, refreshRoute]);

  const selectRoute = (id) => {
    setSelectedRouteId(id);
  };

  const setCustomRoute = async (startCoord, endCoord, name) => {
    setIsLoading(true);
    setError(null);
    try {
      const custom = await calculateCustomRoute(startCoord, endCoord, name);
      setActiveRoute(custom);
      setSelectedRouteId(custom.id);
    } catch (err) {
      setError(err.message || 'Failed to calculate custom route.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    routesList,
    selectedRouteId,
    activeRoute,
    isLoading,
    error,
    liveRoutingEnabled,
    setLiveRoutingEnabled,
    selectRoute,
    setCustomRoute,
    refreshRoute
  };
}
