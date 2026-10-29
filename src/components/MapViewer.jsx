import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, Clock, AlertTriangle, ShieldCheck, HelpCircle, Utensils } from 'lucide-react';

// Leaflet default icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Helper component to auto-fit bounds on route change
function MapBoundsUpdater({ coordinates }) {
  const map = useMap();
  useEffect(() => {
    if (coordinates && coordinates.length > 1) {
      const bounds = L.latLngBounds(coordinates);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [coordinates, map]);
  return null;
}

// Custom vehicle marker icon
function createVehicleIcon(bearing = 0) {
  return L.divIcon({
    className: 'vehicle-marker',
    html: `
      <div style="transform: rotate(${bearing}deg); transition: transform 0.2s linear;" class="relative flex items-center justify-center w-8 h-8">
        <div class="absolute inset-0 rounded-full bg-accent/30 animate-ping"></div>
        <div class="relative w-7 h-7 rounded-full bg-accent border-2 border-background flex items-center justify-center shadow-lg shadow-accent/50 text-background">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12 2 19 21 12 17 5 21 12 2"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

// Custom restaurant pin icon color-coded by accessibility
function createRestaurantIcon(accessClass, rank, isSelected) {
  let bgColor = '#94A3B8'; // Unverified
  let ringColor = 'rgba(148, 163, 184, 0.4)';

  if (accessClass === 'GREEN') {
    bgColor = '#35D07F';
    ringColor = 'rgba(53, 208, 127, 0.5)';
  } else if (accessClass === 'YELLOW') {
    bgColor = '#FFB84D';
    ringColor = 'rgba(255, 184, 77, 0.5)';
  } else if (accessClass === 'RED') {
    bgColor = '#FF5D67';
    ringColor = 'rgba(255, 93, 103, 0.5)';
  }

  const scale = isSelected ? 'scale(1.2)' : 'scale(1)';
  const border = isSelected ? 'border-2 border-white' : 'border border-background';

  return L.divIcon({
    className: 'restaurant-marker',
    html: `
      <div style="transform: ${scale}; transition: transform 0.2s ease;" class="relative flex flex-col items-center group cursor-pointer">
        <div style="background-color: ${bgColor}; box-shadow: 0 0 12px ${ringColor};" class="w-7 h-7 rounded-full ${border} flex items-center justify-center text-background font-black text-xs shadow-md">
          ${rank || '•'}
        </div>
        <div style="border-top-color: ${bgColor};" class="w-0 h-0 border-x-4 border-x-transparent border-t-[6px]"></div>
      </div>
    `,
    iconSize: [28, 36],
    iconAnchor: [14, 34]
  });
}

export function MapViewer({
  route,
  recommendations = [],
  selectedRecommendation,
  onSelectRestaurant,
  vehiclePosition,
  vehicleBearing,
  hoveredRestaurantId
}) {
  const coordinates = route?.coordinates || [];
  const center = coordinates[0] || [37.5, -122.2];

  // Active detour coordinates to display
  const activeDetourPath = useMemo(() => {
    const active = recommendations.find(r => r.restaurant.id === hoveredRestaurantId) || selectedRecommendation;
    return active?.detourMetrics?.detourPathCoordinates || null;
  }, [hoveredRestaurantId, selectedRecommendation, recommendations]);

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden border border-borderSubtle shadow-2xl bg-card">
      <MapContainer
        center={center}
        zoom={10}
        scrollWheelZoom={true}
        className="w-full h-full z-10"
      >
        {/* CartoDB Dark Matter Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        <MapBoundsUpdater coordinates={coordinates} />

        {/* 3km Corridor glow buffer */}
        {coordinates.length > 1 && (
          <Polyline
            positions={coordinates}
            pathOptions={{
              color: '#38BDF8',
              weight: 24,
              opacity: 0.08,
              lineCap: 'round',
              lineJoin: 'round'
            }}
          />
        )}

        {/* Main Highway Route Line */}
        {coordinates.length > 1 && (
          <Polyline
            positions={coordinates}
            pathOptions={{
              color: '#B8F34A',
              weight: 5,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round'
            }}
          />
        )}

        {/* Real Detour Loop Preview */}
        {activeDetourPath && activeDetourPath.length > 1 && (
          <Polyline
            positions={activeDetourPath}
            pathOptions={{
              color: '#FFB84D',
              weight: 4,
              opacity: 0.95,
              dashArray: '6, 8',
              lineCap: 'round'
            }}
          />
        )}

        {/* Vehicle Marker */}
        {vehiclePosition && vehiclePosition[0] !== 0 && (
          <Marker
            position={vehiclePosition}
            icon={createVehicleIcon(vehicleBearing)}
            zIndexOffset={1000}
          >
            <Popup className="dark-popup">
              <div className="text-xs p-1">
                <p className="font-bold text-accent">Vehicle Current Position</p>
                <p className="text-muted text-[10px]">Filtering pitstops ahead of vehicle</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Restaurant Pitstop Pins */}
        {recommendations.map((rec) => {
          const isSelected = selectedRecommendation?.restaurant.id === rec.restaurant.id;
          return (
            <Marker
              key={rec.restaurant.id}
              position={rec.restaurant.location}
              icon={createRestaurantIcon(rec.restaurant.accessClass, rec.rank, isSelected)}
              eventHandlers={{
                click: () => onSelectRestaurant(rec.restaurant.id)
              }}
            >
              <Popup className="dark-popup">
                <div className="text-xs space-y-1.5 p-1 min-w-[180px]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-textMain">{rec.restaurant.name}</span>
                    <span className="font-mono text-accent font-bold">#{rec.rank}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                        rec.restaurant.accessClass === 'GREEN'
                          ? 'bg-success/20 text-success'
                          : rec.restaurant.accessClass === 'YELLOW'
                          ? 'bg-warning/20 text-warning'
                          : rec.restaurant.accessClass === 'RED'
                          ? 'bg-danger/20 text-danger'
                          : 'bg-muted/20 text-muted'
                      }`}
                    >
                      {rec.restaurant.accessClass}
                    </span>
                    <span className="text-muted">{rec.restaurant.cuisineType}</span>
                  </div>
                  <div className="text-[11px] text-muted space-y-0.5">
                    <p>Detour: +{(rec.detourMetrics.detourDurationSeconds / 60).toFixed(1)} min</p>
                    <p>ETA: {rec.foodSuitability.projectedEta} ({rec.foodSuitability.mealWindow})</p>
                  </div>
                  <button
                    onClick={() => onSelectRestaurant(rec.restaurant.id)}
                    className="w-full mt-2 py-1 bg-accent/20 hover:bg-accent/30 text-accent font-semibold rounded text-[11px] transition-colors"
                  >
                    View Detour & Score Analysis
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-secondary/90 backdrop-blur-md p-2.5 rounded-xl border border-borderSubtle text-[11px] space-y-1.5 shadow-xl pointer-events-auto">
        <div className="font-semibold text-textMain text-[10px] uppercase tracking-wider text-muted font-mono">
          Road Access Class (Task 1 & 2)
        </div>
        <div className="flex flex-wrap gap-2.5 items-center">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-success"></span>
            <span className="text-textMain font-medium">GREEN (Direct Ramp)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-warning"></span>
            <span className="text-textMain font-medium">YELLOW (Overpass/Turn)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-danger"></span>
            <span className="text-textMain font-medium">RED (Median U-turn)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-muted"></span>
            <span className="text-textMain font-medium">Unverified</span>
          </div>
        </div>
      </div>
    </div>
  );
}
