import { useState, useEffect, useRef, useMemo } from 'react';
import { interpolatePositionAlongRoute, computePolylineDistanceMeters } from '../engine/geoUtils.js';

export function useSimulation(activeRoute) {
  const [vehicleDistanceMeters, setVehicleDistanceMeters] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(10); // 10x real-time speed
  const animationFrameRef = useRef(null);
  const lastTimeRef = useRef(null);

  const totalRouteMeters = useMemo(() => {
    if (!activeRoute?.coordinates || activeRoute.coordinates.length < 2) return 0;
    return activeRoute.totalDistanceMeters || computePolylineDistanceMeters(activeRoute.coordinates);
  }, [activeRoute]);

  // Interpolated position and bearing
  const vehicleState = useMemo(() => {
    if (!activeRoute?.coordinates || activeRoute.coordinates.length < 2) {
      return { position: [0, 0], bearing: 0, segmentIndex: 0 };
    }
    return interpolatePositionAlongRoute(activeRoute.coordinates, vehicleDistanceMeters);
  }, [activeRoute, vehicleDistanceMeters]);

  // Reset when route changes
  useEffect(() => {
    setVehicleDistanceMeters(0);
    setIsPlaying(false);
  }, [activeRoute?.id]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying || totalRouteMeters <= 0) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      lastTimeRef.current = null;
      return;
    }

    const step = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaTimeSeconds = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      // Base highway speed ~90 km/h = 25 m/s
      const baseSpeedMs = 25;
      const distanceStepMeters = baseSpeedMs * speedMultiplier * deltaTimeSeconds;

      setVehicleDistanceMeters(prev => {
        const nextDist = prev + distanceStepMeters;
        if (nextDist >= totalRouteMeters) {
          setIsPlaying(false);
          return totalRouteMeters;
        }
        return nextDist;
      });

      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, speedMultiplier, totalRouteMeters]);

  const togglePlay = () => setIsPlaying(prev => !prev);
  const reset = () => {
    setIsPlaying(false);
    setVehicleDistanceMeters(0);
  };
  const seekDistance = (meters) => {
    setVehicleDistanceMeters(Math.max(0, Math.min(meters, totalRouteMeters)));
  };
  const seekPercent = (pct) => {
    seekDistance((pct / 100) * totalRouteMeters);
  };

  const progressPercent = totalRouteMeters > 0
    ? Math.min(100, Math.round((vehicleDistanceMeters / totalRouteMeters) * 100))
    : 0;

  return {
    vehicleDistanceMeters,
    vehiclePosition: vehicleState.position,
    vehicleBearing: vehicleState.bearing,
    progressPercent,
    isPlaying,
    speedMultiplier,
    setSpeedMultiplier,
    togglePlay,
    reset,
    seekDistance,
    seekPercent,
    totalRouteMeters
  };
}
