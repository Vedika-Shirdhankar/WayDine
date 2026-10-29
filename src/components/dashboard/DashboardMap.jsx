import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Radio, Eye, CheckCircle2, CornerDownRight, AlertTriangle, Compass } from 'lucide-react';
import { useJourneyEngine } from '../../context/JourneyContext.jsx';

// Leaflet DivIcon Creators (fixes Vite default icon path bug)
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

function createEndpointIcon(label, isDestination = false) {
  const bg = isDestination ? '#FF5D67' : '#35D07F';
  return L.divIcon({
    className: 'endpoint-marker',
    html: `
      <div class="flex flex-col items-center">
        <div style="background-color: ${bg};" class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold text-background shadow-md">
          ${label}
        </div>
        <div style="border-top-color: ${bg};" class="w-0 h-0 border-x-3 border-x-transparent border-t-[5px]"></div>
      </div>
    `,
    iconSize: [40, 24],
    iconAnchor: [20, 24]
  });
}

function createRestaurantMarkerIcon({ accessClass, isExcessiveDetour, isSelected, rank }) {
  let color = '#94A3B8'; // UNVERIFIED (grey)
  let glow = 'rgba(148, 163, 184, 0.4)';

  if (isExcessiveDetour) {
    color = '#FF8C42'; // Orange for High / Excessive detour
    glow = 'rgba(255, 140, 66, 0.5)';
  } else if (accessClass === 'GREEN') {
    color = '#35D07F'; // Green
    glow = 'rgba(53, 208, 127, 0.5)';
  } else if (accessClass === 'YELLOW') {
    color = '#FFB84D'; // Yellow
    glow = 'rgba(255, 184, 77, 0.5)';
  } else if (accessClass === 'RED') {
    color = '#FF5D67'; // Red
    glow = 'rgba(255, 93, 103, 0.5)';
  }

  const border = isSelected ? 'border-2 border-white scale-125' : 'border border-background';

  return L.divIcon({
    className: 'restaurant-custom-marker',
    html: `
      <div class="relative flex flex-col items-center transition-transform duration-200">
        <div style="background-color: ${color}; box-shadow: 0 0 12px ${glow};" class="w-6 h-6 rounded-full ${border} flex items-center justify-center text-background font-black text-[10px]">
          ${rank || '•'}
        </div>
        <div style="border-top-color: ${color};" class="w-0 h-0 border-x-3 border-x-transparent border-t-[5px]"></div>
      </div>
    `,
    iconSize: [26, 32],
    iconAnchor: [13, 30]
  });
}

function MapBoundsController({ coordinates }) {
  const map = useMap();
  useEffect(() => {
    if (coordinates && coordinates.length > 1) {
      map.invalidateSize();
      const bounds = L.latLngBounds(coordinates);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [coordinates, map]);
  return null;
}

function RecenterControl({ coordinates }) {
  const map = useMap();
  const handleRecenter = (e) => {
    e.stopPropagation();
    if (coordinates && coordinates.length > 1) {
      map.invalidateSize();
      const bounds = L.latLngBounds(coordinates);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  };

  return (
    <div className="absolute top-3 left-14 z-[1000] pointer-events-auto">
      <button
        type="button"
        onClick={handleRecenter}
        className="px-3 py-1.5 bg-secondary/90 hover:bg-secondary text-textMain border border-borderSubtle hover:border-accent rounded-xl text-xs font-semibold shadow-xl transition-all flex items-center gap-1.5 backdrop-blur-md cursor-pointer"
        title="Fit map to full Mumbai-Pune route"
      >
        <Compass className="w-3.5 h-3.5 text-accent" />
        <span>Recenter Route</span>
      </button>
    </div>
  );
}

export function DashboardMap() {
  const {
    route,
    vehiclePosition,
    vehicleBearing,
    engineResults,
    selectedRestaurantId,
    setSelectedRestaurantId,
    selectedRecommendation,
    previewDetourRestaurantId,
    setPreviewDetourRestaurantId,
    dataSourceTag
  } = useJourneyEngine();

  const coordinates = route?.coordinates || [];
  const center = coordinates[0] || [19.0760, 72.8777];

  // Combined candidates (eligible + rejected for complete map visibility)
  const mapCandidates = useMemo(() => {
    const list = [];
    engineResults.eligible.forEach(item => {
      list.push({
        ...item.restaurant,
        accessClass: item.detourResult?.accessibilityClass || 'GREEN',
        isExcessive: item.detourResult?.detourClassification === 'Excessive' || item.detourResult?.detourClassification === 'High',
        rank: item.rank,
        score: item.finalScore,
        detourMeters: item.detourResult?.detourDistanceMeters,
        detourSeconds: item.detourResult?.detourDurationSeconds,
        explanation: item.explanation,
        isEligible: true
      });
    });

    engineResults.rejected.forEach(item => {
      const isRed = item.reasonCode === 'INACCESSIBLE_RED';
      const isExcessive = item.reasonCode === 'EXCESSIVE_DETOUR';
      list.push({
        ...item.restaurant,
        accessClass: isRed ? 'RED' : item.restaurant.accessPoint?.accessClass || 'UNVERIFIED',
        isExcessive,
        rank: null,
        rejectionReason: item.reasonMessage,
        isEligible: false
      });
    });

    return list;
  }, [engineResults]);

  // Active Detour Preview Path
  const activeDetourPath = useMemo(() => {
    const targetId = previewDetourRestaurantId || selectedRestaurantId;
    if (!targetId) return null;

    const match = engineResults.eligible.find(r => r.restaurant.id === targetId);
    if (match) {
      // Create path from route to restaurant and back
      const nearest = match.restaurant.location;
      const vehiclePos = vehiclePosition;
      return [vehiclePos, nearest, vehiclePos];
    }
    return null;
  }, [previewDetourRestaurantId, selectedRestaurantId, engineResults.eligible, vehiclePosition]);

  return (
    <div className="relative w-full h-[520px] lg:h-full min-h-[500px] rounded-2xl overflow-hidden border border-borderSubtle bg-card shadow-2xl">
      <MapContainer
        center={center}
        zoom={10}
        minZoom={7}
        maxZoom={18}
        scrollWheelZoom={false}
        className="w-full h-full z-10"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <MapBoundsController coordinates={coordinates} />
        <RecenterControl coordinates={coordinates} />

        {/* 200m Highway Corridor Buffer Swath */}
        {coordinates.length > 1 && (
          <Polyline
            positions={coordinates}
            pathOptions={{
              color: '#38BDF8',
              weight: 22,
              opacity: 0.12,
              lineCap: 'round',
              lineJoin: 'round'
            }}
          />
        )}

        {/* Planned Highway Route Line */}
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

        {/* Preview Detour Path */}
        {activeDetourPath && (
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

        {/* Start Point Marker */}
        {coordinates.length > 0 && (
          <Marker position={coordinates[0]} icon={createEndpointIcon('START')}>
            <Popup className="dark-popup">
              <span className="text-xs font-bold text-textMain">Origin Departure Point</span>
            </Popup>
          </Marker>
        )}

        {/* Destination Marker */}
        {coordinates.length > 1 && (
          <Marker position={coordinates[coordinates.length - 1]} icon={createEndpointIcon('DEST', true)}>
            <Popup className="dark-popup">
              <span className="text-xs font-bold text-textMain">Destination Arrival Point</span>
            </Popup>
          </Marker>
        )}

        {/* Current Vehicle Position Marker */}
        {vehiclePosition && vehiclePosition[0] !== 0 && (
          <Marker position={vehiclePosition} icon={createVehicleIcon(vehicleBearing)} zIndexOffset={1000}>
            <Popup className="dark-popup">
              <div className="text-xs p-1">
                <span className="font-bold text-accent block">Current Vehicle Location</span>
                <span className="text-[10px] text-muted">Venues behind vehicle are dynamically filtered</span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Restaurant Pitstop Markers */}
        {mapCandidates.map((venue) => {
          const isSelected = selectedRestaurantId === venue.id;
          return (
            <Marker
              key={venue.id}
              position={venue.location}
              icon={createRestaurantMarkerIcon({
                accessClass: venue.accessClass,
                isExcessiveDetour: venue.isExcessive,
                isSelected,
                rank: venue.rank
              })}
              eventHandlers={{
                click: () => {
                  setSelectedRestaurantId(venue.id);
                  setPreviewDetourRestaurantId(venue.id);
                }
              }}
            >
              <Popup className="dark-popup">
                <div className="text-xs space-y-1.5 p-1 min-w-[190px]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-textMain">{venue.name}</span>
                    {venue.rank && <span className="font-mono text-accent font-bold">#{venue.rank}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                      venue.accessClass === 'GREEN' ? 'bg-success/20 text-success' :
                      venue.accessClass === 'YELLOW' ? 'bg-warning/20 text-warning' :
                      venue.accessClass === 'RED' ? 'bg-danger/20 text-danger' :
                      venue.isExcessive ? 'bg-orange-500/20 text-orange-400' : 'bg-muted/20 text-muted'
                    }`}>
                      {venue.isExcessive ? 'Excessive Detour' : venue.accessClass}
                    </span>
                    <span className="text-muted">{venue.cuisineType}</span>
                  </div>
                  {venue.isEligible ? (
                    <div className="text-[11px] text-muted space-y-0.5 font-mono">
                      <p>Score: <strong className="text-accent">{venue.score}/100</strong></p>
                      <p>Detour: +{venue.detourMeters} m (+{Math.round(venue.detourSeconds / 60)} min)</p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-danger font-mono">{venue.rejectionReason}</p>
                  )}
                  <button
                    onClick={() => {
                      setSelectedRestaurantId(venue.id);
                      setPreviewDetourRestaurantId(venue.id);
                    }}
                    className="w-full mt-1.5 py-1 bg-accent/20 hover:bg-accent/30 text-accent font-semibold rounded text-[11px] transition-colors flex items-center justify-center gap-1"
                  >
                    <CornerDownRight className="w-3 h-3" />
                    <span>Select & Preview Detour</span>
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Route Deviation Alert */}
      {selectedRecommendation?.detourResult && (selectedRecommendation.detourResult.uTurnCount > 0 || (selectedRecommendation.detourResult.detourDistanceMeters || 0) > 1500) && (
        <div className="absolute top-3 right-3 z-[1000] bg-secondary/95 backdrop-blur-md p-3 rounded-xl border border-warning/40 text-xs shadow-2xl pointer-events-auto max-w-xs flex items-start gap-2.5 animate-slide-up">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono uppercase font-bold text-warning block">Route Deviation Alert</span>
            <p className="text-[11px] text-textMain leading-tight">
              <strong>{selectedRecommendation.restaurant.name}</strong> adds +{((selectedRecommendation.detourResult.detourDistanceMeters || 0) / 1000).toFixed(1)} km
              {selectedRecommendation.detourResult.uTurnCount > 0 ? ' and requires a legal highway U-turn.' : ' detour.'}
            </p>
          </div>
        </div>
      )}

      {/* Map Legend & Provenance Badge Overlay */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-secondary/90 backdrop-blur-md p-3 rounded-xl border border-borderSubtle text-[11px] space-y-2 shadow-2xl pointer-events-auto max-w-xs">
        <div className="flex items-center justify-between border-b border-borderSubtle pb-1">
          <span className="text-[10px] font-mono uppercase font-bold text-muted">Road Accessibility</span>
          <span className="text-[10px] font-mono text-accent font-semibold">{dataSourceTag}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-success"></span>
            <span className="text-textMain font-medium">GREEN (Direct)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-warning"></span>
            <span className="text-textMain font-medium">YELLOW (Turn/U-Turn)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-danger"></span>
            <span className="text-textMain font-medium">RED (Median Barrier)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-400"></span>
            <span className="text-textMain font-medium">Excessive Detour</span>
          </div>
          <div className="flex items-center gap-1.5 col-span-2">
            <span className="w-2.5 h-2.5 rounded-full bg-muted"></span>
            <span className="text-textMain font-medium">UNVERIFIED (No Road Graph)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
