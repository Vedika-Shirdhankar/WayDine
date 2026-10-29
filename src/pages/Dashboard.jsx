import React, { useState } from 'react';
import { useRoutePlanning } from '../hooks/useRoutePlanning.js';
import { usePitstopEngine } from '../hooks/usePitstopEngine.js';
import { useSimulation } from '../hooks/useSimulation.js';
import { MapViewer } from '../components/MapViewer.jsx';
import { SimulationBar } from '../components/SimulationBar.jsx';
import { FilterControls } from '../components/FilterControls.jsx';
import { RestaurantCard } from '../components/RestaurantCard.jsx';
import { ScoreBreakdownModal } from '../components/ScoreBreakdownModal.jsx';
import { DetourComparisonChart } from '../components/DetourComparisonChart.jsx';
import { Navbar } from '../components/Navbar.jsx';
import { Compass, Route, Clock, Navigation, AlertCircle, RefreshCw, Layers } from 'lucide-react';

export function Dashboard() {
  const {
    routesList,
    selectedRouteId,
    activeRoute,
    isLoading: isRouteLoading,
    error: routeError,
    liveRoutingEnabled,
    setLiveRoutingEnabled,
    selectRoute,
    refreshRoute
  } = useRoutePlanning('route-sf-monterey');

  const {
    vehicleDistanceMeters,
    vehiclePosition,
    vehicleBearing,
    progressPercent,
    isPlaying,
    speedMultiplier,
    setSpeedMultiplier,
    togglePlay,
    reset,
    seekPercent,
    totalRouteMeters
  } = useSimulation(activeRoute);

  const {
    recommendations,
    selectedRecommendation,
    selectedRestaurantId,
    setSelectedRestaurantId,
    isLoading: isEngineLoading,
    error: engineError,
    filters,
    totalCount
  } = usePitstopEngine(activeRoute, vehicleDistanceMeters);

  const [hoveredRestaurantId, setHoveredRestaurantId] = useState(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  const handleSelectRestaurant = (id) => {
    setSelectedRestaurantId(id);
    setIsInspectorOpen(true);
  };

  const formattedTotalHours = activeRoute?.totalDurationSeconds
    ? `${Math.floor(activeRoute.totalDurationSeconds / 3600)}h ${Math.round((activeRoute.totalDurationSeconds % 3600) / 60)}m`
    : '0h 0m';

  const formattedTotalKm = activeRoute?.totalDistanceMeters
    ? `${(activeRoute.totalDistanceMeters / 1000).toFixed(1)} km`
    : '0 km';

  return (
    <div className="min-h-screen flex flex-col bg-background text-textMain">
      <Navbar
        routesList={routesList}
        selectedRouteId={selectedRouteId}
        onSelectRoute={selectRoute}
        liveRoutingEnabled={liveRoutingEnabled}
        onToggleLiveRouting={() => setLiveRoutingEnabled(prev => !prev)}
        activeRouteSource={activeRoute?.source || 'Sample/Demo'}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 space-y-6">
        {/* Route Overview Header Stats */}
        <div className="bg-card/70 border border-borderSubtle rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent/15 text-accent border border-accent/30 shadow-glow-accent">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-textMain tracking-tight">
                  {activeRoute?.name || 'Loading Highway Corridor...'}
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/20 text-accent font-bold">
                  {activeRoute?.source || 'Corridor'}
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Route corridor scanned for real-road detour friction, turn penalties, and ETA suitability.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="bg-secondary/80 px-3 py-1.5 rounded-xl border border-borderSubtle">
              <span className="text-muted block text-[10px]">Total Distance</span>
              <span className="text-textMain font-bold">{formattedTotalKm}</span>
            </div>
            <div className="bg-secondary/80 px-3 py-1.5 rounded-xl border border-borderSubtle">
              <span className="text-muted block text-[10px]">Total Drive Time</span>
              <span className="text-accent font-bold">{formattedTotalHours}</span>
            </div>
            <div className="bg-secondary/80 px-3 py-1.5 rounded-xl border border-borderSubtle">
              <span className="text-muted block text-[10px]">Ahead in Corridor</span>
              <span className="text-success font-bold">{recommendations.length} Pitstops</span>
            </div>
          </div>
        </div>

        {/* Loading / Error states */}
        {isRouteLoading && (
          <div className="p-8 rounded-2xl bg-card border border-borderSubtle flex items-center justify-center gap-3 text-accent font-mono text-sm">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Calculating highway route geometry...</span>
          </div>
        )}

        {routeError && (
          <div className="p-4 rounded-2xl bg-danger/15 border border-danger/30 text-danger text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{routeError}</span>
          </div>
        )}

        {/* Main Dashboard Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (7 cols): Map + Simulation + Detour Chart */}
          <div className="lg:col-span-7 space-y-5">
            {/* Interactive Map */}
            <div className="h-[460px] w-full">
              <MapViewer
                route={activeRoute}
                recommendations={recommendations}
                selectedRecommendation={selectedRecommendation}
                onSelectRestaurant={handleSelectRestaurant}
                vehiclePosition={vehiclePosition}
                vehicleBearing={vehicleBearing}
                hoveredRestaurantId={hoveredRestaurantId}
              />
            </div>

            {/* Simulation Scrubber Bar */}
            <SimulationBar
              progressPercent={progressPercent}
              isPlaying={isPlaying}
              speedMultiplier={speedMultiplier}
              setSpeedMultiplier={setSpeedMultiplier}
              onTogglePlay={togglePlay}
              onReset={reset}
              onSeekPercent={seekPercent}
              vehicleDistanceMeters={vehicleDistanceMeters}
              totalRouteMeters={totalRouteMeters}
            />

            {/* Filter & Criteria Panel */}
            <FilterControls
              filters={filters}
              totalCandidatesCount={totalCount}
              returnedCount={recommendations.length}
            />

            {/* Detour Comparison Chart */}
            <DetourComparisonChart
              recommendations={recommendations}
              onSelectRestaurant={handleSelectRestaurant}
            />
          </div>

          {/* Right Column (5 cols): Ranked Pitstop Intelligence Cards */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-textMain flex items-center gap-2">
                  <Compass className="w-4 h-4 text-accent" />
                  <span>Optimized Pitstop Rankings</span>
                </h2>
                <p className="text-[11px] text-muted">
                  Ranked by road convenience, verified ramps & meal availability
                </p>
              </div>
              <span className="text-[11px] font-mono text-accent bg-accent/15 px-2 py-0.5 rounded-full border border-accent/30 font-bold">
                {recommendations.length} Ranked
              </span>
            </div>

            {/* Empty state */}
            {recommendations.length === 0 && !isEngineLoading && (
              <div className="p-8 rounded-2xl bg-card border border-borderSubtle text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-secondary mx-auto flex items-center justify-center text-muted">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-textMain">No Pitstops Match Current Filters</h4>
                <p className="text-xs text-muted max-w-xs mx-auto">
                  Try increasing the maximum detour time slider, resetting the vehicle position, or enabling additional accessibility classes.
                </p>
              </div>
            )}

            {/* Recommendations List */}
            <div className="space-y-3 max-h-[960px] overflow-y-auto pr-1">
              {recommendations.map((rec) => (
                <RestaurantCard
                  key={rec.restaurant.id}
                  recommendation={rec}
                  isSelected={selectedRecommendation?.restaurant.id === rec.restaurant.id}
                  onSelect={() => handleSelectRestaurant(rec.restaurant.id)}
                  onMouseEnter={() => setHoveredRestaurantId(rec.restaurant.id)}
                  onMouseLeave={() => setHoveredRestaurantId(null)}
                />
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Detailed Math & Algorithm Proof Modal */}
      {isInspectorOpen && selectedRecommendation && (
        <ScoreBreakdownModal
          recommendation={selectedRecommendation}
          onClose={() => setIsInspectorOpen(false)}
        />
      )}
    </div>
  );
}
