/**
 * @file foodRulesEngine.js
 * Implements Hackathon Task 3: ETA-based food recommendation.
 * Evaluates per-restaurant ETA, operational hours, meal service windows,
 * and category availability at projected arrival time.
 * Pure deterministic rule engine - NO AI/LLM inference.
 */

/**
 * Standard meal service windows based on 24-hour clock.
 */
export const MEAL_WINDOWS = {
  BREAKFAST: {
    id: 'Breakfast',
    startHour: 6,
    endHour: 11,
    name: 'Breakfast Window (6:00 AM - 11:00 AM)',
    suitableCategories: ['Breakfast', 'Coffee', 'Bakery', 'Bagels', 'Pancakes', 'Quick Bites', 'Drive-Thru']
  },
  LUNCH: {
    id: 'Lunch',
    startHour: 11,
    endHour: 15,
    name: 'Lunch Window (11:00 AM - 3:00 PM)',
    suitableCategories: ['Burgers', 'Sandwiches', 'Salads', 'Bowls', 'Pizza', 'Quick Bites', 'Mexican', 'Fast Food', 'Drive-Thru']
  },
  AFTERNOON_SNACK: {
    id: 'Afternoon Snack / Coffee',
    startHour: 15,
    endHour: 18,
    name: 'Afternoon Snack Window (3:00 PM - 6:00 PM)',
    suitableCategories: ['Coffee', 'Bakery', 'Desserts', 'Smoothies', 'Quick Bites', 'Tea', 'Drive-Thru']
  },
  DINNER: {
    id: 'Dinner',
    startHour: 18,
    endHour: 22,
    name: 'Dinner Window (6:00 PM - 10:00 PM)',
    suitableCategories: ['Dinner', 'Steakhouse', 'Italian', 'Wood-fired Pizza', 'Burgers', 'Seafood', 'Mexican', 'Fine Dining']
  },
  LATE_NIGHT: {
    id: 'Late Night',
    startHour: 22,
    endHour: 6,
    name: 'Late Night Window (10:00 PM - 6:00 AM)',
    suitableCategories: ['24/7 Diner', 'Late Night Bites', 'Fast Food', 'Drive-Thru', 'Burgers', 'Pizza']
  }
};

/**
 * Parses "HH:MM" string into minutes from midnight (0 - 1439).
 * @param {string} timeStr - "HH:MM"
 * @returns {number} Minutes
 */
export function parseTimeToMinutes(timeStr) {
  if (typeof timeStr !== 'string' || !timeStr.includes(':')) {
    throw new TypeError(`[foodRulesEngine] Invalid time format: ${timeStr}. Expected "HH:MM"`);
  }
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new RangeError(`[foodRulesEngine] Invalid hour/minute: ${timeStr}`);
  }
  return h * 60 + m;
}

/**
 * Checks if a given time falls within opening hours.
 * Handles shifts that cross midnight (e.g. open 20:00, close 03:00).
 *
 * @param {import('../types/typedefs.js').OpeningHours} openingHours
 * @param {Date} targetTime
 * @returns {boolean}
 */
export function isWithinOpeningHours(openingHours, targetTime) {
  if (!openingHours || !openingHours.open || !openingHours.close) {
    // If no explicit hours, consider unverified/fallback open
    return true;
  }
  if (!(targetTime instanceof Date) || Number.isNaN(targetTime.getTime())) {
    throw new TypeError('[foodRulesEngine] targetTime must be a valid Date instance.');
  }

  // Check day of week if specified
  if (Array.isArray(openingHours.daysOfWeek)) {
    const day = targetTime.getDay();
    if (!openingHours.daysOfWeek.includes(day)) {
      return false;
    }
  }

  const openMinutes = parseTimeToMinutes(openingHours.open);
  const closeMinutes = parseTimeToMinutes(openingHours.close);
  const targetMinutes = targetTime.getHours() * 60 + targetTime.getMinutes();

  if (openMinutes <= closeMinutes) {
    // Normal same-day operating hours (e.g. 07:00 to 22:00)
    return targetMinutes >= openMinutes && targetMinutes <= closeMinutes;
  } else {
    // Crosses midnight (e.g. 21:00 to 04:00)
    return targetMinutes >= openMinutes || targetMinutes <= closeMinutes;
  }
}

/**
 * Determines the active meal window name for a given arrival time.
 * @param {Date} arrivalTime
 * @returns {typeof MEAL_WINDOWS[keyof typeof MEAL_WINDOWS]}
 */
export function getMealWindow(arrivalTime) {
  if (!(arrivalTime instanceof Date) || Number.isNaN(arrivalTime.getTime())) {
    throw new TypeError('[foodRulesEngine] arrivalTime must be a valid Date instance.');
  }

  const hour = arrivalTime.getHours();

  if (hour >= 6 && hour < 11) return MEAL_WINDOWS.BREAKFAST;
  if (hour >= 11 && hour < 15) return MEAL_WINDOWS.LUNCH;
  if (hour >= 15 && hour < 18) return MEAL_WINDOWS.AFTERNOON_SNACK;
  if (hour >= 18 && hour < 22) return MEAL_WINDOWS.DINNER;
  return MEAL_WINDOWS.LATE_NIGHT;
}

/**
 * Formats a Date object into a readable local 12-hour time string "h:mm A".
 * @param {Date} date
 * @returns {string}
 */
export function formatTime12h(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // hour 0 is 12 AM
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutesStr} ${ampm}`;
}

/**
 * Full ETA-based food suitability calculation for a candidate restaurant.
 *
 * @param {import('../types/typedefs.js').Restaurant} restaurant
 * @param {Date} departureDate - Vehicle trip start time
 * @param {number} travelDurationSecondsToPoint - Driving duration to restaurant
 * @param {string} [preferredCategory] - Optional user preference filter
 * @returns {import('../types/typedefs.js').FoodSuitability}
 */
export function evaluateFoodSuitability(
  restaurant,
  departureDate,
  travelDurationSecondsToPoint,
  preferredCategory = ''
) {
  if (!restaurant) {
    throw new TypeError('[foodRulesEngine] Invalid restaurant.');
  }
  if (!(departureDate instanceof Date) || Number.isNaN(departureDate.getTime())) {
    throw new TypeError('[foodRulesEngine] departureDate must be a valid Date.');
  }
  if (typeof travelDurationSecondsToPoint !== 'number' || travelDurationSecondsToPoint < 0) {
    throw new RangeError(`[foodRulesEngine] travelDurationSecondsToPoint must be non-negative. Received: ${travelDurationSecondsToPoint}`);
  }

  const arrivalTimestamp = departureDate.getTime() + travelDurationSecondsToPoint * 1000;
  const arrivalDate = new Date(arrivalTimestamp);
  const now = new Date();

  const isCurrentlyOpen = isWithinOpeningHours(restaurant.openingHours, now);
  const isOpenAtEta = isWithinOpeningHours(restaurant.openingHours, arrivalDate);
  const mealWindow = getMealWindow(arrivalDate);

  const restaurantCategories = Array.isArray(restaurant.categories) ? restaurant.categories : [];
  const availableCategoriesAtEta = restaurantCategories.filter(cat =>
    mealWindow.suitableCategories.some(sc => sc.toLowerCase() === cat.toLowerCase())
  );

  let requestedCategoryAvailable = true;
  if (preferredCategory && preferredCategory.trim() !== '') {
    const target = preferredCategory.trim().toLowerCase();
    requestedCategoryAvailable = restaurantCategories.some(c => c.toLowerCase().includes(target));
  }

  // Scoring logic:
  // - Open at ETA: +60 points
  // - Category fits meal window: +25 points
  // - Requested category matched: +15 points
  // - Closed at ETA: 0 points (or heavy penalty)
  let timingMatchScore = 0;
  let statusMessage = '';

  if (!isOpenAtEta) {
    timingMatchScore = 10;
    const hours = restaurant.openingHours
      ? `(${restaurant.openingHours.open} - ${restaurant.openingHours.close})`
      : '';
    statusMessage = `Closed at projected ETA ${formatTime12h(arrivalDate)} ${hours}`;
  } else {
    timingMatchScore = 60;

    if (availableCategoriesAtEta.length > 0) {
      timingMatchScore += 25;
    } else {
      timingMatchScore += 10;
    }

    if (requestedCategoryAvailable) {
      timingMatchScore += 15;
    }

    statusMessage = `Open at ETA ${formatTime12h(arrivalDate)} (${mealWindow.id} Menu Active)`;
  }

  return {
    projectedEta: formatTime12h(arrivalDate),
    etaSecondsFromStart: travelDurationSecondsToPoint,
    isCurrentlyOpen,
    isOpenAtEta,
    mealWindow: mealWindow.id,
    availableCategoriesAtEta,
    requestedCategoryAvailable,
    timingMatchScore: Math.min(100, Math.round(timingMatchScore)),
    statusMessage
  };
}
