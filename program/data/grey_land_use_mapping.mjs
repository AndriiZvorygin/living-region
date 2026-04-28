// SPDX-License-Identifier: AGPL-3.0-or-later

const LAND_USE_KEYS = ['LANDUSE', 'LAND_USE', 'DESIGNATION', 'OP_DES', 'SCHED_A', 'CATEGORY', 'TYPE', 'NAME', 'Final_Type'];
const SETTLEMENT_TYPE_KEYS = ['TYPE', 'SETTL_TYPE', 'CATEGORY', 'CLASS', 'SETTLEMENT_TYPE'];
const SETTLEMENT_NAME_KEYS = ['NAME', 'SETTLEMENT', 'SETTL_NAME'];
const MUNICIPALITY_KEYS = ['MUNICIPAL', 'MUNICIPALITY', 'MUN_NAME', 'MUNIC_NAME', 'MUNI_NAME', 'MUNI', 'MUNIC'];

export function normalizeName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function pickFieldValue(properties, candidateKeys) {
  if (!properties) return null;
  for (const key of candidateKeys) {
    if (properties[key] !== undefined && properties[key] !== null && String(properties[key]).trim() !== '') {
      return String(properties[key]).trim();
    }
  }
  return null;
}

export function detectLandUseField(properties) {
  if (!properties || typeof properties !== 'object') return null;
  const exact = LAND_USE_KEYS.find((key) => Object.hasOwn(properties, key));
  if (exact) return exact;
  const keys = Object.keys(properties);
  const fuzzy = keys.find((key) => LAND_USE_KEYS.includes(key.toUpperCase()));
  return fuzzy ?? null;
}

export function mapOfficialPlanLandUseCategory(rawValue) {
  const raw = String(rawValue ?? '').toLowerCase();
  if (!raw) return 'unknown';
  if (raw.includes('industrial') && raw.includes('business')) return 'industrialBusinessPark';
  if (raw.includes('primary') && raw.includes('settlement')) return 'primarySettlement';
  if (raw.includes('secondary') && raw.includes('settlement')) return 'secondarySettlement';
  if (raw.includes('hamlet')) return 'hamlet';
  if (raw.includes('settlement') || raw.includes('urban')) return 'settlement';
  if (raw.includes('agric')) return 'agricultural';
  if (raw.includes('rural')) return 'rural';
  if (raw.includes('hazard') || raw.includes('karst') || raw.includes('flood') || raw.includes('fire')) return 'hazard';
  if (raw.includes('wetland')) return 'wetland';
  if (raw.includes('heritage') || raw.includes('ansi') || raw.includes('woodland') || raw.includes('nhs')) return 'naturalHeritage';
  if (raw.includes('recreat') || raw.includes('park')) return 'recreation';
  if (raw.includes('open space')) return 'openSpace';
  if (raw.includes('mineral') || raw.includes('aggregate') || raw.includes('extract')) return 'mineralResource';
  return 'unknown';
}

export function mapSettlementType(rawValue) {
  const raw = String(rawValue ?? '').toLowerCase();
  if (!raw) return 'unknownSettlement';
  if (raw.includes('primary')) return 'primarySettlement';
  if (raw.includes('secondary')) return 'secondarySettlement';
  if (raw.includes('hamlet')) return 'hamlet';
  if (raw.includes('settlement')) return 'settlementArea';
  return 'unknownSettlement';
}

export function extractSettlementFields(properties) {
  const settlementName = pickFieldValue(properties, SETTLEMENT_NAME_KEYS);
  const settlementTypeRaw = pickFieldValue(properties, SETTLEMENT_TYPE_KEYS);
  const municipalityName = pickFieldValue(properties, MUNICIPALITY_KEYS);
  return {
    settlementName,
    settlementTypeRaw,
    settlementType: mapSettlementType(settlementTypeRaw),
    municipalityName
  };
}

export function extractMunicipalityName(properties) {
  return pickFieldValue(properties, ['MUNICIPAL', 'MUN_NAME', 'MUNICIPALITY', 'MUNI_NAME', 'NAME']);
}

export function extractLandUseRawValue(properties) {
  const key = detectLandUseField(properties);
  return key ? properties[key] : null;
}

export function extractMunicipalityHint(properties) {
  return pickFieldValue(properties, MUNICIPALITY_KEYS);
}
