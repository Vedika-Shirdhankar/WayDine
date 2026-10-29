/**
 * @file typedefs.js
 * Comprehensive JSDoc type definitions for WayDine route intelligence engine.
 * Units: Distance in meters (distanceMeters), Duration in seconds (durationSeconds).
 * Standard coordinate order: [latitude, longitude].
 */

/**
 * Coordinate pair [latitude, longitude].
 * Latitude: -90 to +90. Longitude: -180 to +180.
 * @typedef {[number, number]} LatLng
 */

/**
 * @typedef {Object} RouteManeuver
 * @property {string} type - e.g. "turn", "new name", "depart", "arrive", "on ramp", "off ramp"
 * @property {string} [modifier] - e.g. "left", "right", "straight", "slight right", "uturn"
 * @property {LatLng} location - [lat, lng]
 */

/**
 * @typedef {Object} RouteStep
 * @property {string} instruction
 * @property {number} distanceMeters
 * @property {number} durationSeconds
 * @property {string} name - Road or street name
 * @property {RouteManeuver} maneuver
 */

/**
 * Planned driving route.
 * @typedef {Object} Route
 * @property {string} id - Unique route ID
 * @property {string} name - e.g. "San Francisco to Monterey (CA-1 / US-101)"
 * @property {LatLng[]} coordinates - Dense polyline array of [lat, lng] coordinates
 * @property {number} totalDistanceMeters - Total route distance in meters
 * @property {number} totalDurationSeconds - Total driving duration in seconds
 * @property {RouteStep[]} steps - Turn-by-turn steps
 * @property {'Live (OSRM/OSM)' | 'Sample/Demo'} source - Provenance label
 */

/**
 * Opening hours specification for a restaurant.
 * Times in 24-hour HH:MM format.
 * @typedef {Object} OpeningHours
 * @property {string} open - e.g. "07:00"
 * @property {string} close - e.g. "22:00"
 * @property {number[]} [daysOfWeek] - 0 (Sun) - 6 (Sat). Defaults to all days.
 */

/**
 * Road accessibility classification:
 * - 'GREEN': Direct off-ramp / service road / same side, no hazardous U-turn
 * - 'YELLOW': Overpass or traffic light left turn, minor detour (< 5 mins)
 * - 'RED': Requires cross-median U-turn or high-friction detour (> 10 mins)
 * - 'Unverified': Not verified by local road network topology
 * @typedef {'GREEN' | 'YELLOW' | 'RED' | 'Unverified'} AccessibilityClass
 */

/**
 * Road side relative to vehicle direction of travel.
 * @typedef {'same_side' | 'opposite_side' | 'median'} RoadSide
 */

/**
 * Candidate restaurant along corridor.
 * @typedef {Object} Restaurant
 * @property {string} id
 * @property {string} name
 * @property {LatLng} location - [latitude, longitude]
 * @property {string} address
 * @property {number} rating - 1.0 to 5.0
 * @property {number} reviewCount
 * @property {'$' | '$$' | '$$$' | '$$$$'} priceRange
 * @property {string} cuisineType
 * @property {string[]} categories - e.g. ["Breakfast", "Coffee", "Quick Bites", "Burgers"]
 * @property {OpeningHours} openingHours
 * @property {number} averageDineMinutes - Typical stop time (e.g. 15 for drive-thru, 45 for dine-in)
 * @property {boolean} hasDriveThru
 * @property {boolean} isVegetarianFriendly
 * @property {string} highwayExit - Nearest highway exit or mile marker
 * @property {RoadSide} roadSide
 * @property {AccessibilityClass} accessClass
 * @property {string} [accessReason] - Explaining why GREEN/YELLOW/RED/Unverified
 * @property {'Database' | 'Sample/Demo' | 'Live (OSRM/OSM)'} source
 */

/**
 * Calculated detour metrics using road graph or verified paths.
 * @typedef {Object} DetourMetrics
 * @property {number} detourDistanceMeters - Additional road distance added to journey (round-trip)
 * @property {number} detourDurationSeconds - Additional driving time added to journey (round-trip)
 * @property {number} uTurnCount - Number of U-turns required (heavily penalized)
 * @property {number} turnCount - Number of turns (left/right off highway)
 * @property {number} uTurnPenaltySeconds - Total time penalty added due to U-turns
 * @property {number} detourPenaltyScore - Normalized score 0-100 (100 = 0 detour, 0 = severe detour)
 * @property {LatLng[]} detourPathCoordinates - Road path geometry to & from restaurant
 * @property {LatLng} nearestRoutePoint - Point on route where vehicle diverges
 * @property {number} distanceAlongRouteMeters - Distance from start of route to exit point
 */

/**
 * Food and meal availability evaluation at projected arrival time.
 * @typedef {Object} FoodSuitability
 * @property {string} projectedEta - ISO timestamp or formatted local time of arrival
 * @property {number} etaSecondsFromStart - Seconds from departure
 * @property {boolean} isCurrentlyOpen - Is open right now
 * @property {boolean} isOpenAtEta - Is open when driver actually reaches the restaurant
 * @property {string} mealWindow - "Breakfast" | "Lunch" | "Afternoon Snack" | "Dinner" | "Late Night"
 * @property {string[]} availableCategoriesAtEta - Categories actively served during this window
 * @property {boolean} requestedCategoryAvailable - Matches user's preferred category at ETA
 * @property {number} timingMatchScore - Normalized score 0-100
 * @property {string} statusMessage - Clear human-readable explanation
 */

/**
 * Complete pitstop recommendation ranking.
 * @typedef {Object} PitstopRecommendation
 * @property {Restaurant} restaurant
 * @property {DetourMetrics} detourMetrics
 * @property {FoodSuitability} foodSuitability
 * @property {number} finalScore - Deterministic overall score 0-100
 * @property {Object} scoreBreakdown
 * @property {number} scoreBreakdown.detourScore - Weighted component
 * @property {number} scoreBreakdown.accessScore - Road accessibility component
 * @property {number} scoreBreakdown.ratingScore - Quality/rating component
 * @property {number} scoreBreakdown.foodEtaScore - ETA & meal availability component
 * @property {number} scoreBreakdown.preferenceBonus - User filter/category bonus
 * @property {number} rank - 1-based rank
 * @property {string} rationale - Clear explanation of rank & convenience
 */

export {};
