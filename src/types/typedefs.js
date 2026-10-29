/**
 * @file typedefs.js
 * Comprehensive JSDoc type definitions for the WayDine core engine (Phase 1).
 * Units:
 *   - Coordinates: [latitude, longitude] in degrees
 *   - Distances: meters
 *   - Durations / Times: seconds (or Date instances where specified)
 *   - Weights: sum to 100
 */

/**
 * Coordinate pair [latitude, longitude].
 * Latitude: -90 to +90. Longitude: -180 to +180.
 * @typedef {[number, number]} LatLng
 */

/**
 * Route segment connecting two consecutive waypoints along a route.
 * @typedef {Object} RouteSegment
 * @property {LatLng} start - [lat, lng] of segment origin
 * @property {LatLng} end - [lat, lng] of segment destination
 * @property {number} distanceMeters - Distance of this segment in meters
 * @property {number} cumulativeDistanceMeters - Distance from route start to segment end in meters
 * @property {number} segmentIndex - 0-based index of segment in route
 * @property {number} bearing - Initial bearing in degrees (0-360)
 */

/**
 * Road network node representing an intersection, ramp, or access point.
 * @typedef {Object} RoadNode
 * @property {string} id - Unique node identifier
 * @property {LatLng} location - [latitude, longitude]
 * @property {string} [name] - Human readable descriptor
 */

/**
 * Directed edge in the road network graph.
 * @typedef {Object} RoadEdge
 * @property {string} from - Source node ID
 * @property {string} to - Destination node ID
 * @property {number} distanceMeters - Length of edge in meters
 * @property {number} durationSeconds - Traversal time in seconds
 * @property {number} [speedKmh] - Speed limit in km/h
 * @property {boolean} [oneWay=true] - Whether edge is one-way
 * @property {boolean} [isUTurn=false] - Whether this edge represents a U-turn
 * @property {boolean} [isTurn=false] - Whether this edge involves a turn
 * @property {boolean} [isForbidden=false] - Whether this maneuver is prohibited
 */

/**
 * Road network graph structure.
 * @typedef {Object} RoadGraph
 * @property {Map<string, RoadNode>} nodes - Node map by ID
 * @property {Map<string, RoadEdge[]>} adjacencyList - Edge list by node ID
 * @property {Set<string>} [forbiddenTurns] - Set of "fromNode->viaNode->toNode" strings for turn restrictions
 */

/**
 * Designated vehicular access point for a restaurant from the road network.
 * @typedef {Object} AccessPoint
 * @property {string} id - Access point identifier
 * @property {LatLng} location - [lat, lng] of entry driveway / off-ramp
 * @property {string} roadNodeId - Nearest road network node ID
 * @property {string} [rejoinNodeId] - Road network node ID for re-entering the route
 */

/**
 * Food service window configuration.
 * @typedef {Object} FoodWindow
 * @property {string} name - e.g. "Breakfast", "Lunch", "Snacks", "Dinner"
 * @property {number} startHour - 0-23
 * @property {number} endHour - 0-23
 * @property {string[]} categories - Categories served in this window
 */

/**
 * Candidate restaurant for pitstop intelligence ranking.
 * @typedef {Object} Restaurant
 * @property {string} id
 * @property {string} name
 * @property {LatLng} location - [lat, lng]
 * @property {AccessPoint} [accessPoint] - Specific vehicular access point
 * @property {number} [rating] - Rating 1.0 - 5.0
 * @property {'$' | '$$' | '$$$' | '$$$$'} [priceRange]
 * @property {string} [cuisineType]
 * @property {string[]} [categories] - e.g. ["Burgers", "Coffee", "Breakfast"]
 * @property {string[]} [dietaryOptions] - e.g. ["Vegetarian", "Vegan", "Halal"]
 * @property {{ open: string, close: string }} [openingHours] - "HH:MM" 24h format
 * @property {FoodWindow[]} [customFoodWindows] - Custom meal windows overriding defaults
 * @property {'Database' | 'Sample/Demo' | 'Live (OSRM/OSM)'} [source]
 */

/**
 * Accessibility classification.
 * - 'GREEN': Reachable on current carriageway, no U-turn
 * - 'YELLOW': Junction diversion or short legal U-turn
 * - 'RED': Prohibited crossing, median barrier, or backward travel
 * - 'UNVERIFIED': No road-graph connectivity proof
 * @typedef {'GREEN' | 'YELLOW' | 'RED' | 'UNVERIFIED'} AccessibilityClass
 */

/**
 * Detour calculation result from road graph Dijkstra.
 * @typedef {Object} DetourResult
 * @property {number} detourDistanceMeters - Net additional distance in meters
 * @property {number} detourDurationSeconds - Net additional driving time in seconds
 * @property {number} turnCount - Extra non-highway turns
 * @property {number} uTurnCount - Extra U-turns
 * @property {'Excellent' | 'Very Good' | 'Moderate' | 'High' | 'Excessive'} detourClassification
 * @property {AccessibilityClass} accessibilityClass
 * @property {string[]} pathNodeIds - Dijkstra traversed node path
 * @property {string} [accessibilityReason] - Explanation
 */

/**
 * Final recommendation result for a candidate restaurant.
 * @typedef {Object} RecommendationResult
 * @property {Restaurant} restaurant
 * @property {number} finalScore - Normalized composite score 0-100
 * @property {Object} scoreComponents - Each component normalized 0-100
 * @property {number} scoreComponents.detourEfficiency - 30% weight
 * @property {number} scoreComponents.directionCompatibility - 25% weight
 * @property {number} scoreComponents.roadAccessibility - 20% weight
 * @property {number} scoreComponents.foodAvailability - 15% weight
 * @property {number} scoreComponents.timeCompatibility - 10% weight
 * @property {DetourResult} detourResult
 * @property {Date} eta
 * @property {string[]} activeCategoriesAtEta
 * @property {string} explanation - Templated deterministic rationale
 * @property {number} rank - 1-based rank
 */

/**
 * Engine configuration options.
 * @typedef {Object} EngineConfig
 * @property {number} [corridorMeters=200] - Corridor width candidate selection
 * @property {number} [behindToleranceMeters=50] - Buffer for ahead-of-vehicle check
 * @property {number} [maxDetourMeters=2000] - Hard constraint detour limit
 * @property {number} [uTurnPenaltyMeters=1000] - Penalty meters equivalent for U-turns
 * @property {number} [uTurnPenaltySeconds=240] - Penalty seconds for U-turns
 * @property {number} [turnPenaltySeconds=30] - Penalty seconds for standard turns
 * @property {Object} [weights] - Scoring component weights summing to 100
 * @property {number} [weights.detourEfficiency=30]
 * @property {number} [weights.directionCompatibility=25]
 * @property {number} [weights.roadAccessibility=20]
 * @property {number} [weights.foodAvailability=15]
 * @property {number} [weights.timeCompatibility=10]
 */

export {};
