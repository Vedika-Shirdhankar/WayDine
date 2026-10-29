# WayDine – Smart Pitstop Intelligence & Route Optimization

> **"Your Journey. Your Direction. Your Perfect Pitstop."**

WayDine ranks restaurants along a planned highway route by how convenient they **actually** are, not by naive straight-line proximity.

---

## 🏆 Three Hackathon Tasks (Visibly Demonstrable)

1. **Route-Aware, Direction-Aware Discovery**
   - Perpendicular corridor filtering along the dense polyline.
   - Dynamic ahead-of-vehicle progression tracking (filters out passed venues as the vehicle drives).
   - Side-of-travel determination (same side vs opposite side).
   - Road accessibility classification: **GREEN** (direct off-ramp / service road), **YELLOW** (controlled signal or overpass), **RED** (prohibitive or dangerous median U-turn), and **Unverified** (no connected road graph).

2. **Detour & U-Turn Minimization**
   - Real road-network extra round-trip distance (meters) and travel duration (seconds).
   - Turn penalties and heavy U-turn penalties (+240s for hazardous median crossings).
   - Exponential penalty decay curve for detour scores (0–100).
   - Dijkstra's shortest path graph traversal over verified road topologies.

3. **ETA-Based Food Recommendation**
   - Per-restaurant projected ETA based on departure time and highway drive duration.
   - Dynamic opening hours evaluation (including shifts crossing midnight).
   - Active meal service window identification (Breakfast, Lunch, Afternoon Snack, Dinner, Late Night).
   - Category availability matching at projected arrival time.

---

## 🛡️ Hard Rules & Integrity Compliance

- **NO AI/ML/LLMs**: Only graph algorithms (Dijkstra), geospatial spherical mathematics (Haversine, cross-track, along-track projection), database queries, and deterministic weighted scoring.
- **Zero Hallucinated Data**: Every data source is explicitly tagged in the UI: `"Live (OSRM/OSM)"`, `"Database"`, or `"Sample/Demo"`.
- **Road-Graph Accessibility Support**: Venues without verified road graph connectivity are strictly labeled `"Unverified"`.
- **Zero API Keys & Zero Supabase Setup Required**: Runs 100% self-contained out-of-the-box using the public OSRM router with seamless offline fallback cache and seed data.
- **Strict Units & Validation**: `[lat, lng]` ordering standardized everywhere; distance in meters (`distanceMeters`), duration in seconds (`durationSeconds`); runtime type validation on all engine functions.

---

## 🛠️ Tech Stack

- **Frontend**: React 18 (ES Modules, JavaScript, no TypeScript) + Vite + Tailwind CSS
- **Mapping**: Leaflet + React-Leaflet with CartoDB Dark Matter tiles
- **Icons & UI**: Lucide React + Tailwind theme styled according to the dark navigation palette
- **Data Visualization**: Recharts (Detour vs Convenience Score chart)
- **Routing**: OpenStreetMap OSRM Public Driving API + Offline Corridor Generator
- **Testing**: Vitest unit test suite

---

## 🚀 Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Run unit tests (15/15 passing)
npm run test

# 3. Start development server
npm run dev

# 4. Build production bundle
npm run build
```

---

## 📁 Architecture

```
WayDine/
├── src/
│   ├── engine/                # Pure mathematical functions (zero React, zero network)
│   │   ├── geoUtils.js             # Haversine, bearing, cross-track, segment projection
│   │   ├── shortestPath.js         # Road network graph & Dijkstra shortest path
│   │   ├── detourCalculator.js     # Real detour distance/time & U-turn penalty math
│   │   ├── foodRulesEngine.js      # Opening hours, meal windows & ETA food rules
│   │   ├── restaurantFilter.js     # Corridor buffer, ahead filter & accessibility class
│   │   ├── recommendationEngine.js # Multi-criteria deterministic scoring formula
│   │   └── routeEngine.js          # OSRM public client & offline corridor route fallback
│   ├── data/                  # Seeds & repository abstraction
│   │   ├── seedRestaurants.json   # High-fidelity highway restaurant database records
│   │   ├── sampleRoutes.json      # Highway corridor presets (US-101, I-95, Mumbai-Pune)
│   │   ├── roadNetworkGraph.json  # Ramps, frontage roads, medians & turn barriers
│   │   └── restaurantRepository.js# Data repository with optional Supabase fallback
│   ├── services/
│   │   └── routingService.js      # OSRM & route caching service
│   ├── hooks/
│   │   ├── useRoutePlanning.js    # Route selection & OSRM toggle hook
│   │   ├── usePitstopEngine.js    # Filter criteria & recommendation state hook
│   │   └── useSimulation.js       # Real-time highway driving simulation hook
│   ├── components/            # UI components
│   │   ├── Navbar.jsx             # Brand, route switcher, OSRM status & nav tabs
│   │   ├── MapViewer.jsx          # Leaflet dark map, pins, corridor glow & detour preview
│   │   ├── SimulationBar.jsx      # Driving scrubber, play/pause & speed multiplier
│   │   ├── FilterControls.jsx     # Max detour slider, category filter & access pills
│   │   ├── RestaurantCard.jsx     # Ranked pitstop card with convenience score
│   │   ├── ScoreBreakdownModal.jsx# Exact mathematical formula breakdown modal
│   │   ├── DetourComparisonChart.jsx # Recharts detour vs convenience plot
│   │   └── Toast.jsx              # System notifications
│   ├── pages/
│   │   ├── Dashboard.jsx          # Central navigation command center
│   │   ├── EngineLab.jsx          # Interactive test sandbox for hackathon judges
│   │   └── RoadGraphViewer.jsx    # Visual proof of road graph vertices, edges & barriers
│   ├── types/
│   │   └── typedefs.js            # JSDoc type definitions
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── test/
│   └── engine.test.js         # Complete Vitest engine test suite
├── package.json
├── tailwind.config.js
└── vite.config.js
```
