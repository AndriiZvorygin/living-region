// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';

export function isValidGeoJsonFeatureCollection(filePath) {
  if (!fs.existsSync(filePath)) return { valid: false, reason: 'missing' };
  const stat = fs.statSync(filePath);
  if (stat.size <= 0) return { valid: false, reason: 'empty' };
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (parsed?.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
      return { valid: true, featureCount: parsed.features.length, size: stat.size };
    }
    return { valid: false, reason: 'not-feature-collection' };
  } catch {
    return { valid: false, reason: 'parse-error' };
  }
}
