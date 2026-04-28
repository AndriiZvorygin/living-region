// SPDX-License-Identifier: AGPL-3.0-or-later
export const greyCountyExpectedTotals = {
  population2021: 100_905,
  landAreaKm2: 4_497.93,
  densityPerKm2: 22.4,
  municipalityIds: [
    'owen-sound',
    'west-grey',
    'meaford',
    'georgian-bluffs',
    'grey-highlands',
    'blue-mountains',
    'southgate',
    'hanover',
    'chatsworth'
  ]
};

export function summarizeGreyCountySeedNodes(nodes) {
  const population2021 = nodes.reduce((sum, node) => sum + (node.population2021 ?? 0), 0);
  const landAreaKm2 = nodes.reduce((sum, node) => sum + (node.landAreaKm2 ?? 0), 0);
  const derivedDensityPerKm2 = landAreaKm2 > 0 ? population2021 / landAreaKm2 : 0;

  return {
    population2021,
    landAreaKm2,
    densityPerKm2: derivedDensityPerKm2,
    municipalityCount: nodes.length,
    municipalityIds: nodes.map((node) => node.municipalityId)
  };
}

export function validateGreyCountySeedTotals(nodes) {
  const warnings = [];
  const errors = [];
  const summary = summarizeGreyCountySeedNodes(nodes);

  const populationTolerance = 0;
  const areaTolerance = 0.05;
  const densityTolerance = 0.3;

  if (Math.abs(summary.population2021 - greyCountyExpectedTotals.population2021) > populationTolerance) {
    errors.push({
      code: 'grey.seed.population.total.mismatch',
      message: `Population total ${summary.population2021} does not equal expected ${greyCountyExpectedTotals.population2021}.`,
      value: summary.population2021,
      expected: greyCountyExpectedTotals.population2021
    });
  }

  if (Math.abs(summary.landAreaKm2 - greyCountyExpectedTotals.landAreaKm2) > areaTolerance) {
    errors.push({
      code: 'grey.seed.area.total.mismatch',
      message: `Land area total ${summary.landAreaKm2.toFixed(2)} km2 does not match expected ${greyCountyExpectedTotals.landAreaKm2.toFixed(2)} km2.`,
      value: summary.landAreaKm2,
      expected: greyCountyExpectedTotals.landAreaKm2,
      tolerance: areaTolerance
    });
  }

  if (Math.abs(summary.densityPerKm2 - greyCountyExpectedTotals.densityPerKm2) > densityTolerance) {
    warnings.push({
      code: 'grey.seed.density.total.mismatch',
      message: `Derived county density ${summary.densityPerKm2.toFixed(2)} differs from expected ${greyCountyExpectedTotals.densityPerKm2.toFixed(2)}.`,
      value: summary.densityPerKm2,
      expected: greyCountyExpectedTotals.densityPerKm2,
      tolerance: densityTolerance
    });
  }

  const seen = new Set();
  for (const node of nodes) {
    if (seen.has(node.municipalityId)) {
      errors.push({
        code: 'grey.seed.municipality.duplicate',
        message: `Duplicate municipalityId found: ${node.municipalityId}`,
        municipalityId: node.municipalityId
      });
    }
    seen.add(node.municipalityId);

    const calculatedDensity = node.landAreaKm2 > 0 ? node.population2021 / node.landAreaKm2 : 0;
    if (Math.abs(calculatedDensity - node.densityPerKm2) > 0.8) {
      warnings.push({
        code: 'grey.seed.node.density.inconsistent',
        message: `Node ${node.municipalityName} has density ${node.densityPerKm2}, derived ${calculatedDensity.toFixed(2)}.`,
        municipalityId: node.municipalityId,
        provided: node.densityPerKm2,
        derived: calculatedDensity
      });
    }
  }

  for (const municipalityId of greyCountyExpectedTotals.municipalityIds) {
    if (!seen.has(municipalityId)) {
      errors.push({
        code: 'grey.seed.municipality.missing',
        message: `Missing municipalityId in seed nodes: ${municipalityId}`,
        municipalityId
      });
    }
  }

  return {
    summary,
    warnings,
    errors,
    valid: errors.length === 0
  };
}
