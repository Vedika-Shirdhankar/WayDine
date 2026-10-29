/**
 * @file validators.js
 * Runtime input validation utilities for WayDine core engine.
 */

/**
 * Validates whether an input is a valid [latitude, longitude] pair.
 * Checks for:
 *  - Array of at least 2 finite numbers
 *  - No NaN
 *  - Latitude in [-90, 90]
 *  - Longitude in [-180, 180]
 *  - Detectable swapped lat/lng (e.g. |lat| > 90 and |lng| <= 90)
 *
 * @param {any} coord
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidLatLng(coord) {
  if (!Array.isArray(coord) || coord.length < 2) return false;
  const [lat, lng] = coord;

  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false;

  // Swapped lat/lng detection: if latitude exceeds 90 but longitude could be latitude
  if (Math.abs(lat) > 90) {
    return false; // Invalid latitude or swapped
  }
  if (Math.abs(lng) > 180) {
    return false;
  }

  return true;
}

/**
 * Asserts that a value is a valid finite positive number (> 0).
 * Throws TypeError or RangeError if not.
 *
 * @param {any} val
 * @param {string} [name='Value']
 * @throws {TypeError|RangeError}
 */
export function assertPositiveNumber(val, name = 'Value') {
  if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
    throw new TypeError(`[validators] ${name} must be a finite number. Received: ${val}`);
  }
  if (val <= 0) {
    throw new RangeError(`[validators] ${name} must be strictly positive (> 0). Received: ${val}`);
  }
}

/**
 * Asserts that a dictionary or object of weights sums exactly to 100 (within floating point epsilon).
 * Throws Error if invalid.
 *
 * @param {Record<string, number>} weights
 * @throws {TypeError|Error}
 */
export function assertWeightsSumTo100(weights) {
  if (!weights || typeof weights !== 'object') {
    throw new TypeError('[validators] Weights must be an object.');
  }

  const values = Object.values(weights);
  if (values.length === 0) {
    throw new Error('[validators] Weights object must not be empty.');
  }

  let sum = 0;
  for (const w of values) {
    if (typeof w !== 'number' || Number.isNaN(w) || !Number.isFinite(w) || w < 0) {
      throw new TypeError(`[validators] Weight values must be non-negative finite numbers. Received: ${w}`);
    }
    sum += w;
  }

  if (Math.abs(sum - 100) > 0.001) {
    throw new Error(`[validators] Weights must sum to 100. Current sum: ${sum}`);
  }
}
