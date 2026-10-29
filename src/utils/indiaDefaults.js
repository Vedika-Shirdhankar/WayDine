/**
 * @file indiaDefaults.js
 * India-specific formatting utilities used across all UI components.
 * - Currency in INR (₹)
 * - Times in IST (Asia/Kolkata)
 * - Distances in m under 1 km, km above
 * - Traffic: LEFT (India drives on the left)
 */

/** Map Western $ tier symbols to ₹ */
export const PRICE_TIER_MAP = { '$': '₹', '$$': '₹₹', '$$$': '₹₹₹', '$$$$': '₹₹₹₹' };

/** Price tier descriptions */
export const PRICE_TIER_DESC = {
  '₹':    'under ₹300 for two',
  '₹₹':   '₹300–700 for two',
  '₹₹₹':  '₹700+ for two',
  '₹₹₹₹': 'Fine dining'
};

/**
 * Convert a Western $ price string to ₹ notation.
 * @param {string} price - e.g. '$', '$$', '$$$', '$$$$'
 * @returns {string} e.g. '₹', '₹₹', '₹₹₹', '₹₹₹₹'
 */
export function toRupeeTier(price) {
  return PRICE_TIER_MAP[price] || price || '₹₹';
}

/**
 * Format a distance in meters using India conventions.
 * Under 1 km → "X m", 1 km or more → "X.X km"
 * @param {number} meters
 * @returns {string}
 */
export function formatDistance(meters) {
  if (meters == null || isNaN(meters)) return '? m';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format a Date as IST time (HH:MM AM/PM) — Asia/Kolkata timezone.
 * @param {Date|string} date
 * @returns {string}
 */
export function formatTimeIST(date) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d);
  } catch {
    return '--:--';
  }
}

/**
 * Format a Date as IST date + time.
 * @param {Date|string} date
 * @returns {string}
 */
export function formatDateTimeIST(date) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      day: '2-digit',
      month: 'short'
    }).format(d);
  } catch {
    return '--';
  }
}

/**
 * Format extra time in minutes (rounded).
 * @param {number} seconds
 * @returns {string} e.g. "+18 min"
 */
export function formatExtraMinutes(seconds) {
  if (seconds == null || isNaN(seconds)) return '? min';
  const m = Math.round(seconds / 60);
  return `+${m} min`;
}

/**
 * India drives on the LEFT. Road side labels for UI display.
 * @param {'left'|'right'|string} side - side from engine (left/right relative to direction of travel)
 * @returns {string}
 */
export function formatRoadSide(side) {
  if (!side) return 'Unknown';
  const s = side.toLowerCase();
  if (s === 'left')  return 'Left side (with traffic, India)';
  if (s === 'right') return 'Right side (against oncoming, India)';
  if (s === 'on-route') return 'On the route';
  return side;
}

/**
 * Accessibility class display config.
 * @param {'GREEN'|'YELLOW'|'RED'|'UNVERIFIED'} cls
 * @returns {{ label: string, colorClass: string, bgClass: string, description: string }}
 */
export function accessClassConfig(cls) {
  switch (cls) {
    case 'GREEN':
      return {
        label: 'GREEN',
        colorClass: 'text-success',
        bgClass: 'bg-success/15 border-success/40 text-success',
        description: 'Direct access from current carriageway — no U-turn, few turns.'
      };
    case 'YELLOW':
      return {
        label: 'YELLOW',
        colorClass: 'text-warning',
        bgClass: 'bg-warning/15 border-warning/40 text-warning',
        description: 'Requires junction diversion or a short legal U-turn.'
      };
    case 'RED':
      return {
        label: 'RED',
        colorClass: 'text-danger',
        bgClass: 'bg-danger/15 border-danger/40 text-danger',
        description: 'Prohibited: median barrier crossing or backward travel. Do not attempt.'
      };
    case 'UNVERIFIED':
    default:
      return {
        label: 'UNVERIFIED',
        colorClass: 'text-muted',
        bgClass: 'bg-muted/15 border-muted/40 text-muted',
        description: 'No road-graph data. Cannot verify accessibility — shown as Unverified.'
      };
  }
}

/** Detour classification badge colors */
export function detourClassConfig(cls) {
  switch (cls) {
    case 'Excellent':  return { colorClass: 'text-success',  bgClass: 'bg-success/15 border-success/40' };
    case 'Very Good':  return { colorClass: 'text-accent',   bgClass: 'bg-accent/15 border-accent/40' };
    case 'Moderate':   return { colorClass: 'text-warning',  bgClass: 'bg-warning/15 border-warning/40' };
    case 'High':       return { colorClass: 'text-orange-400', bgClass: 'bg-orange-500/15 border-orange-500/40' };
    case 'Excessive':  return { colorClass: 'text-danger',   bgClass: 'bg-danger/15 border-danger/40' };
    default:           return { colorClass: 'text-muted',    bgClass: 'bg-muted/15 border-muted/40' };
  }
}

/** Map mealWindow name to a color */
export const MEAL_WINDOW_COLORS = {
  Breakfast:   '#FFB84D',
  Lunch:       '#35D07F',
  Snacks:      '#FF8C42',
  Dinner:      '#38BDF8',
  'Late Night':'#A78BFA'
};
