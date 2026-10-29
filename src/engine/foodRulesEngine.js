/**
 * @file foodRulesEngine.js
 * ETA computation, operating hours validation, meal window management, and food suitability matching.
 */

export const DEFAULT_MEAL_WINDOWS = [
  {
    name: 'Breakfast',
    id: 'Breakfast',
    startHour: 6,
    endHour: 11,
    categories: ['Breakfast', 'Coffee', 'Bakery', 'Bagels', 'Pancakes', 'Quick Bites'],
    suitableCategories: ['Breakfast', 'Coffee', 'Bakery', 'Bagels', 'Pancakes', 'Quick Bites', 'Drive-Thru']
  },
  {
    name: 'Lunch',
    id: 'Lunch',
    startHour: 11,
    endHour: 15,
    categories: ['Lunch', 'Burgers', 'Sandwiches', 'Salads', 'Bowls', 'Pizza', 'Fast Food', 'Quick Bites'],
    suitableCategories: ['Burgers', 'Sandwiches', 'Salads', 'Bowls', 'Pizza', 'Quick Bites', 'Mexican', 'Fast Food', 'Drive-Thru']
  },
  {
    name: 'Snacks',
    id: 'Afternoon Snack / Coffee',
    startHour: 15,
    endHour: 18,
    categories: ['Snacks', 'Coffee', 'Bakery', 'Desserts', 'Smoothies', 'Tea', 'Quick Bites'],
    suitableCategories: ['Coffee', 'Bakery', 'Desserts', 'Smoothies', 'Quick Bites', 'Tea', 'Drive-Thru']
  },
  {
    name: 'Dinner',
    id: 'Dinner',
    startHour: 18,
    endHour: 23,
    categories: ['Dinner', 'Steakhouse', 'Italian', 'Pizza', 'Burgers', 'Seafood', 'Fine Dining'],
    suitableCategories: ['Dinner', 'Steakhouse', 'Italian', 'Wood-fired Pizza', 'Burgers', 'Seafood', 'Mexican', 'Fine Dining']
  },
  {
    name: 'Late Night',
    id: 'Late Night',
    startHour: 23,
    endHour: 6,
    categories: ['Late Night', '24/7 Diner', 'Fast Food', 'Burgers', 'Pizza'],
    suitableCategories: ['24/7 Diner', 'Late Night Bites', 'Fast Food', 'Drive-Thru', 'Burgers', 'Pizza']
  }
];

export function computeEta(departureTime, timeToAccessPointSeconds, detourTimeSeconds = 0) {
  if (!(departureTime instanceof Date) || Number.isNaN(departureTime.getTime())) {
    throw new TypeError('[foodRulesEngine] departureTime must be a valid Date object.');
  }
  const totalOffsetMs = (timeToAccessPointSeconds + detourTimeSeconds) * 1000;
  return new Date(departureTime.getTime() + totalOffsetMs);
}

export function timeStringToMinutes(timeStr) {
  if (typeof timeStr !== 'string' || !timeStr.includes(':')) {
    throw new TypeError(`[foodRulesEngine] Invalid time string: ${timeStr}. Expected "HH:MM".`);
  }
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new RangeError(`[foodRulesEngine] Time values out of bounds: ${timeStr}`);
  }
  return h * 60 + m;
}

export const parseTimeToMinutes = timeStringToMinutes;

export function isOpenAt(eta, openingTime, closingTime) {
  if (!(eta instanceof Date) || Number.isNaN(eta.getTime())) {
    throw new TypeError('[foodRulesEngine] eta must be a valid Date.');
  }

  const openMinutes = timeStringToMinutes(openingTime);
  const closeMinutes = timeStringToMinutes(closingTime);
  const targetMinutes = eta.getHours() * 60 + eta.getMinutes();

  if (openMinutes <= closeMinutes) {
    return targetMinutes >= openMinutes && targetMinutes <= closeMinutes;
  } else {
    return targetMinutes >= openMinutes || targetMinutes <= closeMinutes;
  }
}

export function isWithinOpeningHours(openingHours, targetTime) {
  if (!openingHours || !openingHours.open || !openingHours.close) {
    return true;
  }
  return isOpenAt(targetTime, openingHours.open, openingHours.close);
}

export function getMealWindowAt(eta, customWindows = null) {
  if (!(eta instanceof Date) || Number.isNaN(eta.getTime())) {
    throw new TypeError('[foodRulesEngine] eta must be a valid Date.');
  }

  const windows = Array.isArray(customWindows) && customWindows.length > 0
    ? customWindows
    : DEFAULT_MEAL_WINDOWS;

  const hour = eta.getHours();

  for (const w of windows) {
    if (w.startHour <= w.endHour) {
      if (hour >= w.startHour && hour < w.endHour) {
        return w;
      }
    } else {
      if (hour >= w.startHour || hour < w.endHour) {
        return w;
      }
    }
  }

  return windows[0];
}

export const getMealWindow = getMealWindowAt;

export function getActiveCategories(eta, restaurant) {
  if (!restaurant) return [];

  const window = getMealWindowAt(eta, restaurant.customFoodWindows);
  const restaurantCategories = Array.isArray(restaurant.categories) ? restaurant.categories : [];

  const matched = restaurantCategories.filter(cat =>
    window.categories.some(wc => wc.toLowerCase() === cat.toLowerCase()) ||
    (window.suitableCategories && window.suitableCategories.some(sc => sc.toLowerCase() === cat.toLowerCase()))
  );

  return matched.length > 0 ? matched : restaurantCategories;
}

export function matchesDiet(restaurant, requiredDiet) {
  if (!requiredDiet || requiredDiet.trim() === '') return true;
  if (!restaurant) return false;

  const target = requiredDiet.trim().toLowerCase();
  const options = Array.isArray(restaurant.dietaryOptions) ? restaurant.dietaryOptions : [];
  const categories = Array.isArray(restaurant.categories) ? restaurant.categories : [];

  return options.some(opt => opt.toLowerCase().includes(target)) ||
         categories.some(c => c.toLowerCase().includes(target));
}

export function matchesBudget(restaurant, maxPriceRange) {
  if (!maxPriceRange) return true;
  if (!restaurant || !restaurant.priceRange) return true;

  const levels = { '$': 1, '$$': 2, '$$$': 3, '$$$$': 4 };
  const restaurantLevel = levels[restaurant.priceRange] || 2;
  const maxLevel = levels[maxPriceRange] || 4;

  return restaurantLevel <= maxLevel;
}

export function matchesCuisine(restaurant, preferredCuisines) {
  if (!preferredCuisines) return true;
  const list = Array.isArray(preferredCuisines) ? preferredCuisines : [preferredCuisines];
  if (list.length === 0 || list.every(c => !c || c === 'All')) return true;

  if (!restaurant) return false;
  const cuisine = (restaurant.cuisineType || '').toLowerCase();
  const categories = (restaurant.categories || []).map(c => c.toLowerCase());

  return list.some(pref => {
    const p = pref.toLowerCase();
    return cuisine.includes(p) || categories.some(c => c.includes(p));
  });
}

export function formatTime12h(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutesStr} ${ampm}`;
}

export function evaluateFoodSuitability(restaurant, departureDate, travelDurationSecondsToPoint, preferredCategory = '') {
  const arrivalDate = computeEta(departureDate, travelDurationSecondsToPoint);
  const now = new Date();

  const isCurrentlyOpen = isWithinOpeningHours(restaurant.openingHours, now);
  const isOpenAtEta = isWithinOpeningHours(restaurant.openingHours, arrivalDate);
  const mealWindow = getMealWindowAt(arrivalDate, restaurant.customFoodWindows);

  const availableCategoriesAtEta = getActiveCategories(arrivalDate, restaurant);
  let requestedCategoryAvailable = true;
  if (preferredCategory && preferredCategory.trim() !== '') {
    const target = preferredCategory.trim().toLowerCase();
    requestedCategoryAvailable = (restaurant.categories || []).some(c => c.toLowerCase().includes(target));
  }

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
    if (availableCategoriesAtEta.length > 0) timingMatchScore += 25;
    else timingMatchScore += 10;
    if (requestedCategoryAvailable) timingMatchScore += 15;
    statusMessage = `Open at ETA ${formatTime12h(arrivalDate)} (${mealWindow.name || mealWindow.id} Menu Active)`;
  }

  return {
    projectedEta: formatTime12h(arrivalDate),
    etaSecondsFromStart: travelDurationSecondsToPoint,
    isCurrentlyOpen,
    isOpenAtEta,
    mealWindow: mealWindow.name || mealWindow.id,
    availableCategoriesAtEta,
    requestedCategoryAvailable,
    timingMatchScore: Math.min(100, Math.round(timingMatchScore)),
    statusMessage
  };
}
