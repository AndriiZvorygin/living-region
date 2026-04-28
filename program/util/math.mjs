export const EPSILON = 1e-9;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function clamp01(value) {
  return clamp(value, 0, 1);
}

export function safeDivide(numerator, denominator, fallback = 0) {
  if (Math.abs(denominator) < EPSILON) {
    return fallback;
  }
  return numerator / denominator;
}

export function average(values, fallback = 0) {
  if (!Array.isArray(values) || values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function sumBy(items, selector) {
  return items.reduce((sum, item) => sum + selector(item), 0);
}

export function lerp(start, end, t) {
  return start + (end - start) * t;
}

export function valueByYear(mapLike, year, fallback) {
  if (!mapLike || typeof mapLike !== 'object') {
    return fallback;
  }
  if (Object.hasOwn(mapLike, year)) {
    return mapLike[year];
  }
  const keys = Object.keys(mapLike)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (keys.length === 0) {
    return fallback;
  }
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (year <= first) {
    return mapLike[first];
  }
  if (year >= last) {
    return mapLike[last];
  }
  for (let i = 0; i < keys.length - 1; i += 1) {
    const left = keys[i];
    const right = keys[i + 1];
    if (year >= left && year <= right) {
      const t = safeDivide(year - left, right - left, 0);
      return lerp(mapLike[left], mapLike[right], t);
    }
  }
  return fallback;
}
