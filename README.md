# WayDine – Smart Pitstop Intelligence & Route Optimization

> **"Your Journey. Your Direction. Your Perfect Pitstop."**

WayDine ranks restaurants along a planned highway route by how convenient they **actually** are, not by naive straight-line proximity.

> ⚠️ **Note on Coordinates**: All geographic coordinates and road network graphs bundled in the demo seeds are **approximate sample data** representing real-world highway corridors for testing and demonstration purposes.

---

## 🏆 Three Hackathon Tasks (Visibly Demonstrable)

1. **Route-Aware, Direction-Aware Discovery**
   - Lateral corridor filtering along dense route polyline.
   - Dynamic ahead-of-vehicle progression tracking (drops restaurants behind vehicle).
   - Travel direction and side-of-road determination.
   - Road accessibility classification: **GREEN** (direct off-ramp / service road), **YELLOW** (controlled signal or overpass), **RED** (prohibitive or dangerous median U-turn), and **UNVERIFIED** (no connected road graph).

2. **Detour & U-Turn Minimization**
   - Real road-network extra distance (meters) and travel duration (seconds) via Dijkstra.
   - Turn penalties and heavy U-turn penalties (+240s for hazardous median crossings).
   - Exponential detour efficiency decay curve.
   - Dijkstra's shortest path graph traversal over verified directed road topology.

3. **ETA-Based Food Recommendation**
   - Per-restaurant projected ETA based on departure time and highway drive duration.
   - Dynamic opening hours evaluation (including shifts crossing midnight).
   - Active meal service window identification (Breakfast, Lunch, Snacks, Dinner, Late Night).
   - Category availability matching at projected arrival time.

---

## 📊 Benchmark Test Cases (Mumbai -> Pune Demo Seed)

The Phase 2 dataset bundles 12 benchmark cases deliberately designed to test all edge cases of the engine:

| Case # | Restaurant Name | Deliberate Scenario | Expected Result | Reason / Status |
| :---: | :--- | :--- | :---: | :--- |
| **1** | Expressway Food Court Khalapur | Close to route, same carriageway | **Eligible** | Verified `GREEN` access (0 U-turns) |
| **2** | Median Barrier Mumbai-Bound Dhaba | Opposite carriageway across concrete median | **Rejected** | `INACCESSIBLE_RED` (Forbidden median crossing) |
| **3** | Lonavala Ghat View Restaurant | Overpass junction diversion | **Eligible** | Verified `YELLOW` access (1 legal U-turn) |
| **4** | Old Khopoli Valley Heritage Inn | Long diversion (3.4 km detour) | **Rejected** | `EXCESSIVE_DETOUR` (Exceeds 2500m max detour) |
| **5** | Twilight Sunset Grill & Bar | Evening dinner only (18:00–23:30) | **Rejected** | `CLOSED_AT_ETA` (Closed at 11:30 AM arrival) |
| **6** | Sunrise Early Waffle & Bakery | Open, but breakfast/waffles only | **Rejected** | `CATEGORY_UNAVAILABLE` (Lunch filter active) |
| **7** | Premier Express Pitstop & Roastery | Direct 80m plaza ramp, 4.9★, 24/7 | **Rank #1** | **Top Pick** (Score 100/100, `GREEN`) |
| **8** | Ghat Mystery Fruit Stand & Tea | Missing road network data | **Eligible** | `UNVERIFIED` (Never assumed accessible) |
| **9** | Night Owl 24/7 Ghat Diner | Shift closes past midnight (11:00–03:00) | **Eligible** | `GREEN` (Handles midnight crossover) |
| **10** | Green Earth Pure Veg & Vegan Cafe | Vegan diet, '$' budget | **Eligible** | `GREEN` (Satisfies vegan filter) |
| **11** | Royal Coastal Seafood Retreat | Coastal cuisine, '$$$$' luxury | **Eligible** | `GREEN` (High-end dine-in) |
| **12** | Express Burger & Shake Drive-Thru | Fast food, '$' budget, Drive-thru | **Eligible** | `GREEN` (Quick stop) |

---

## 🛡️ Repository Layer (`src/data/`)

- `IWayDineRepository`: JSDoc contract defining all required methods (`getRestaurants`, `getFoodAvailability`, `getAccessPoints`, `getRoadGraph`, `saveRoute`, `saveRecommendations`, `saveHistory`, `getPreferences`, `savePreferences`).
- `LocalSeedRepository` (DEFAULT): Reads `mumbaiPuneSeed.json`, persists to `localStorage` (or in-memory store in Node.js).
- `SupabaseRepository`: Enabled only when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are provided; otherwise gracefully falls back to `LocalSeedRepository`.
- `supabase/schema.sql`: Full multi-tenant schema with PKs, FKs, indexes, CHECK constraints, RLS policies, and guarded PostGIS extensions.

---

## 🚀 Quickstart & Checkpoint Commands

```bash
# 1. Install dependencies
npm install

# 2. Run all unit & integration tests (50/50 passing)
npm test

# 3. Run Phase 2 CLI Demo script
npm run demo
```
