import React, { useState } from 'react';
import {
  Navigation,
  MapPin,
  Car,
  Clock,
  SlidersHorizontal,
  Coffee,
  Sparkles,
  Zap,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { useJourneyEngine } from '../../context/JourneyContext.jsx';

const PRESET_PLACES = [
  { name: 'Mumbai (Eastern Express)', location: [19.0760, 72.8777] },
  { name: 'Kalamboli Interchange (KM 25)', location: [19.0144, 73.1025] },
  { name: 'Khalapur Toll Plaza (KM 60)', location: [18.8412, 73.2845] },
  { name: 'Lonavala Ghat Overpass (KM 95)', location: [18.7525, 73.4086] },
  { name: 'Talegaon Toll Plaza (KM 125)', location: [18.7235, 73.6621] },
  { name: 'Pune (Kiwale / Wakad)', location: [18.5204, 73.8567] }
];

export function JourneyPlanner() {
  const {
    startPoint,
    setStartPoint,
    destinationPoint,
    setDestinationPoint,
    departureTime,
    setDepartureTime,
    travelMode,
    setTravelMode,
    vehicleDistanceMeters,
    setVehicleProgressDistance,
    vehicleProgressPercent,
    totalRouteMeters,
    filters,
    updateFilters,
    loadDemoJourney,
    findBestPitstops,
    isLoading,
    isEngineCalculating
  } = useJourneyEngine();

  const [validationError, setValidationError] = useState('');

  const handleStartChange = (e) => {
    const place = PRESET_PLACES.find(p => p.name === e.target.value);
    if (place) {
      if (place.name === destinationPoint.name) {
        setValidationError('Start and destination cannot be identical.');
      } else {
        setValidationError('');
        setStartPoint(place);
      }
    }
  };

  const handleDestChange = (e) => {
    const place = PRESET_PLACES.find(p => p.name === e.target.value);
    if (place) {
      if (place.name === startPoint.name) {
        setValidationError('Start and destination cannot be identical.');
      } else {
        setValidationError('');
        setDestinationPoint(place);
      }
    }
  };

  const handleTimeChange = (e) => {
    const [h, m] = e.target.value.split(':').map(Number);
    const updated = new Date(departureTime);
    updated.setHours(h, m, 0, 0);
    setDepartureTime(updated);
  };

  const timeString = `${String(departureTime.getHours()).padStart(2, '0')}:${String(departureTime.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="bg-card border border-borderSubtle rounded-2xl p-4 sm:p-5 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-borderSubtle pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-textMain">Journey Planner</h3>
            <p className="text-[10px] text-muted">Corridor parameters & route discovery</p>
          </div>
        </div>

        <button
          onClick={loadDemoJourney}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary hover:bg-borderStrong border border-borderSubtle text-accent text-xs font-semibold transition-all cursor-pointer"
          title="Instantly resets to the Mumbai -> Pune demo journey"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>Demo Trip</span>
        </button>
      </div>

      {validationError && (
        <div className="p-2.5 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Start and Destination Selection */}
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted font-medium flex items-center gap-1.5 mb-1">
            <MapPin className="w-3.5 h-3.5 text-accent" />
            <span>Origin Point</span>
          </label>
          <select
            value={startPoint.name}
            onChange={handleStartChange}
            className="w-full bg-secondary border border-borderSubtle rounded-xl px-3 py-2 text-xs font-medium text-textMain focus:outline-none focus:border-accent"
          >
            {PRESET_PLACES.map(p => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-muted font-medium flex items-center gap-1.5 mb-1">
            <MapPin className="w-3.5 h-3.5 text-danger" />
            <span>Destination Point</span>
          </label>
          <select
            value={destinationPoint.name}
            onChange={handleDestChange}
            className="w-full bg-secondary border border-borderSubtle rounded-xl px-3 py-2 text-xs font-medium text-textMain focus:outline-none focus:border-accent"
          >
            {PRESET_PLACES.map(p => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Vehicle Progress Scrubber Along Route */}
      <div className="space-y-2 pt-2 border-t border-borderSubtle">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted font-medium flex items-center gap-1.5">
            <Car className="w-3.5 h-3.5 text-accent" />
            <span>Vehicle Position Along Route</span>
          </span>
          <span className="font-mono text-accent font-bold">
            {(vehicleDistanceMeters / 1000).toFixed(1)} km ({vehicleProgressPercent}%)
          </span>
        </div>
        <input
          type="range"
          min="0"
          max={totalRouteMeters || 148500}
          step="500"
          value={vehicleDistanceMeters}
          onChange={(e) => setVehicleProgressDistance(Number(e.target.value))}
          className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
        />
        <div className="flex justify-between text-[10px] text-muted font-mono">
          <span>Start (0 km)</span>
          <span>KM 65 (Khalapur)</span>
          <span>Dest ({((totalRouteMeters || 148500) / 1000).toFixed(0)} km)</span>
        </div>
      </div>

      {/* Detour, Meal Window, Budget & Dietary Filters */}
      <div className="space-y-3 pt-2 border-t border-borderSubtle">
        {/* Max Acceptable Detour */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted font-medium">Max Acceptable Detour</span>
            <span className="font-mono text-accent font-bold">{filters.maxDetourMeters} m</span>
          </div>
          <input
            type="range"
            min="300"
            max="4000"
            step="100"
            value={filters.maxDetourMeters}
            onChange={(e) => updateFilters({ maxDetourMeters: Number(e.target.value) })}
            className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
          />
        </div>

        {/* Departure Time */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-muted font-medium block mb-1">Departure Time</label>
            <input
              type="time"
              value={timeString}
              onChange={handleTimeChange}
              className="w-full bg-secondary border border-borderSubtle rounded-lg px-2.5 py-1.5 text-xs font-mono text-textMain"
            />
          </div>

          <div>
            <label className="text-[11px] text-muted font-medium block mb-1">Travel Mode</label>
            <select
              value={travelMode}
              onChange={(e) => {
                setTravelMode(e.target.value);
                updateFilters({ travelMode: e.target.value });
              }}
              className="w-full bg-secondary border border-borderSubtle rounded-lg px-2.5 py-1.5 text-xs text-textMain"
            >
              <option value="car">Car (Default)</option>
              <option value="express">Highway Express</option>
              <option value="truck">Commercial Truck</option>
            </select>
          </div>
        </div>

        {/* Preferred Category & Diet */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-muted font-medium block mb-1">Food Category</label>
            <select
              value={filters.preferredCategory}
              onChange={(e) => updateFilters({ preferredCategory: e.target.value })}
              className="w-full bg-secondary border border-borderSubtle rounded-lg px-2.5 py-1.5 text-xs text-textMain"
            >
              <option value="All">All Categories</option>
              <option value="Lunch">Lunch</option>
              <option value="Breakfast">Breakfast</option>
              <option value="Burgers">Burgers / Fast Food</option>
              <option value="Coffee">Coffee & Cafe</option>
              <option value="Pizza">Pizza</option>
              <option value="Quick Bites">Quick Bites</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-muted font-medium block mb-1">Dietary Preference</label>
            <select
              value={filters.dietaryPreference}
              onChange={(e) => updateFilters({ dietaryPreference: e.target.value })}
              className="w-full bg-secondary border border-borderSubtle rounded-lg px-2.5 py-1.5 text-xs text-textMain"
            >
              <option value="">Any Diet</option>
              <option value="Vegetarian">Vegetarian</option>
              <option value="Vegan">Vegan</option>
              <option value="Halal">Halal</option>
              <option value="Gluten-Free">Gluten-Free</option>
            </select>
          </div>
        </div>

        {/* Budget */}
        <div>
          <label className="text-[11px] text-muted font-medium block mb-1">Budget Tier</label>
          <div className="grid grid-cols-4 gap-1.5">
            {['$', '$$', '$$$', '$$$$'].map(tier => (
              <button
                key={tier}
                onClick={() => updateFilters({ budget: tier })}
                className={`py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  filters.budget === tier
                    ? 'bg-accent text-background shadow-glow-accent'
                    : 'bg-secondary text-muted hover:text-textMain border border-borderSubtle'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Prominent Action Button */}
      <div className="pt-2">
        <button
          onClick={findBestPitstops}
          disabled={isLoading || isEngineCalculating || Boolean(validationError)}
          className="w-full py-3 rounded-xl bg-accent text-background font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-accentHover transition-all shadow-glow-accent cursor-pointer disabled:opacity-50"
        >
          {isEngineCalculating ? (
            <>
              <RotateCcw className="w-4 h-4 animate-spin" />
              <span>Optimizing Pitstops...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Find Best Pitstops</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
