/**
 * @file repositoryInterface.js
 * JSDoc definitions and contract interface for the WayDine data access layer.
 */

/**
 * @typedef {Object} RepositoryFilter
 * @property {string} [cuisine]
 * @property {string} [dietaryOption]
 * @property {'$' | '$$' | '$$$' | '$$$$'} [priceRange]
 * @property {boolean} [hasDriveThru]
 */

/**
 * @typedef {Object} UserPreferences
 * @property {string[]} preferredCuisines
 * @property {string[]} dietaryRestrictions
 * @property {number} maxDetourMinutes
 * @property {boolean} requireDriveThru
 * @property {boolean} requireOpenAtEta
 * @property {string} preferredPriceRange
 * @property {Object} weights
 */

/**
 * Abstract Repository Interface defining the required persistence contract.
 */
export class IWayDineRepository {
  /**
   * Fetches restaurants matching optional filters.
   * @param {RepositoryFilter} [filter]
   * @returns {Promise<Array<import('../types/typedefs.js').Restaurant>>}
   */
  async getRestaurants(filter = {}) {
    throw new Error('Method not implemented: getRestaurants');
  }

  /**
   * Fetches food availability windows for a restaurant.
   * @param {string} restaurantId
   * @returns {Promise<Array<import('../types/typedefs.js').FoodWindow>>}
   */
  async getFoodAvailability(restaurantId) {
    throw new Error('Method not implemented: getFoodAvailability');
  }

  /**
   * Fetches access points for a restaurant.
   * @param {string} restaurantId
   * @returns {Promise<Array<import('../types/typedefs.js').AccessPoint>>}
   */
  async getAccessPoints(restaurantId) {
    throw new Error('Method not implemented: getAccessPoints');
  }

  /**
   * Reconstructs and returns the active RoadNetworkGraph.
   * @returns {Promise<import('../engine/shortestPath.js').RoadNetworkGraph>}
   */
  async getRoadGraph() {
    throw new Error('Method not implemented: getRoadGraph');
  }

  /**
   * Persists a planned driving route.
   * @param {any} route
   * @returns {Promise<{ success: boolean, id: string }>}
   */
  async saveRoute(route) {
    throw new Error('Method not implemented: saveRoute');
  }

  /**
   * Persists computed pitstop recommendations.
   * @param {string} routeId
   * @param {Array<import('../types/typedefs.js').RecommendationResult>} recommendations
   * @returns {Promise<{ success: boolean, count: number }>}
   */
  async saveRecommendations(routeId, recommendations) {
    throw new Error('Method not implemented: saveRecommendations');
  }

  /**
   * Saves a user pitstop selection to journey history.
   * @param {Object} entry
   * @returns {Promise<{ success: boolean, id: string }>}
   */
  async saveHistory(entry) {
    throw new Error('Method not implemented: saveHistory');
  }

  /**
   * Fetches user preferences by user ID.
   * @param {string} userId
   * @returns {Promise<UserPreferences>}
   */
  async getPreferences(userId) {
    throw new Error('Method not implemented: getPreferences');
  }

  /**
   * Saves user preferences for a user ID.
   * @param {string} userId
   * @param {UserPreferences} preferences
   * @returns {Promise<{ success: boolean }>}
   */
  async savePreferences(userId, preferences) {
    throw new Error('Method not implemented: savePreferences');
  }
}
