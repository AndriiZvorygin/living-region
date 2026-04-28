// SPDX-License-Identifier: AGPL-3.0-or-later
import { clamp } from '../util/math.mjs';

const DEFAULT_WEATHER = {
  sun: 1,
  water: 1,
  shock: 0
};

export function getSeasonContext(scenario, year) {
  const weather = scenario.weatherByYear?.[year] ?? DEFAULT_WEATHER;
  const sun = clamp(weather.sun ?? 1, 0.4, 1.3);
  const water = clamp(weather.water ?? 1, 0.4, 1.3);
  const shock = clamp(weather.shock ?? 0, 0, 0.6);
  const productivityMultiplier = clamp(sun * water * (1 - shock), 0.2, 1.4);
  return {
    sun,
    water,
    shock,
    productivityMultiplier
  };
}
