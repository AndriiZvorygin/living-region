import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildEvidenceSummary} from '../scripts/build-summary.mjs';
import {calculateHealthCanadaEER, representativeProfiles} from '../scripts/calc-health-canada-energy.mjs';
import {calculateEvidenceHeating} from '../scripts/calc-evidence-heating.mjs';
import {calculateWoodyLand} from '../scripts/calc-evidence-woody.mjs';
import {calculateFoodSystem, buildHouseholdCapacity, householdProfiles, siteClasses} from '../scripts/calc-household-capacity.mjs';
import {calculateTransitionLabour, calculateFoodSystemLabour} from '../scripts/calc-food-system-labour.mjs';
import {buildFoodForestTransition} from '../scripts/calc-food-forest-transition.mjs';
import {buildMatureFoodSystem} from '../scripts/calc-mature-food-system.mjs';
export {calculateHealthCanadaEER, representativeProfiles, HEALTH_CANADA_EER_SOURCE} from './health-canada.mjs';
export {calculateFoodSystem, calculateInteractiveHousehold, calculateEvidenceHeating, heatingCases, siteClasses, householdProfiles, foodLossAssumptions, FOOD_ADULT_EQUIVALENT_GJ_YEAR} from './core.mjs';

export const CARRYING_CAPACITY_CONTRACT_VERSION = '1.0.0';
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, relativePath), 'utf8'));
}

function memberResult(member, energy) {
  const profile = typeof member === 'string' ? representativeProfiles[member] : member;
  if (!profile) throw new Error(`Unknown household member profile: ${member}`);
  const id = typeof member === 'string' ? member : profile.id ?? 'custom_member';
  return calculateHealthCanadaEER({id, ...profile});
}

/** Calculate annual food-energy demand for a household without policy land multipliers. */
export function calculateHealthCanadaHouseholdFoodEnergyDemand({members = ['adult_woman']} = {}) {
  const results = members.map((member) => memberResult(member, null));
  return {
    contract_version: CARRYING_CAPACITY_CONTRACT_VERSION,
    members: results,
    household_energy_gj_year: results.reduce((sum, row) => sum + row.gj_year, 0),
    food_energy_only: true,
    source: 'Health Canada EER equations; see data/source/health-canada-eer-equations.csv'
  };
}

/** Calculate the annual food bridge before perennial systems reach maturity. */
export function calculateAnnualFoodBridge({demandGJ, site = 'ordinary_mesic', foodEvidence} = {}) {
  if (!Number.isFinite(demandGJ) || demandGJ < 0) throw new Error('annual food bridge requires a non-negative demandGJ');
  const evidence = foodEvidence ?? readJson('data/derived/evidence-food-yields.json');
  const siteClass = siteClasses[site];
  if (!siteClass) throw new Error(`Unknown site class: ${site}`);
  return calculateFoodSystem(evidence, demandGJ, siteClass.food_multiplier);
}

/** Calculate the explicit yurt/dwelling heating demand from the ARC envelope model. */
export function calculateDwellingHeatingDemand(overrides = {}) {
  return calculateEvidenceHeating(overrides);
}

/** Calculate land required for woody biomass under favourable/ordinary/marginal bands. */
export function calculateWoodyBiomassLandRequirement({heating} = {}) {
  // The public heating helper returns one dwelling case. The woody module
  // consumes the complete low/central/high case bundle.
  return calculateWoodyLand(heating?.cases ? heating : undefined);
}

/** Return the baseline household/site sensitivity table used by all higher-level reports. */
export function calculateSiteSensitivity({energy, food, heating, woody} = {}) {
  const capacity = buildHouseholdCapacity(energy, food, heating, woody);
  return {
    contract_version: CARRYING_CAPACITY_CONTRACT_VERSION,
    site_classes: siteClasses,
    household_profiles: householdProfiles,
    rows: capacity.rows,
    source: capacity.source
  };
}

/** Calculate annual-to-perennial succession, including transition labour. */
export function calculateAnnualToPerennialSuccession({energy, food, heating, woody, capacity} = {}) {
  return buildFoodForestTransition(energy, food, heating, woody, capacity);
}

/** Calculate mature multifunctional food-system land and ageing-in-place constraints. */
export function calculateMatureFoodSystemLandRequirement({transition} = {}) {
  const succession = transition ?? calculateAnnualToPerennialSuccession();
  return buildMatureFoodSystem(succession);
}

/** Calculate a transition or mature labour row using the evidence-backed labour module. */
export function calculateLabourRequirements(options = {}) {
  if ('year' in options || 'annualArea' in options || 'forestArea' in options) return calculateTransitionLabour(options);
  return calculateFoodSystemLabour();
}

/** Keep multifunctional allowances explicit instead of hiding them in a hectare coefficient. */
export function calculateMultifunctionalLandAccounting({foodAreaHa = 0, heatingAreaHa = 0, resilience = {}} = {}) {
  const allowances = {
    diversity_and_rotation_ha: resilience.diversity_and_rotation_ha ?? Math.max(0.12, foodAreaHa * 0.25),
    soil_water_perennial_buffer_ha: resilience.soil_water_perennial_buffer_ha ?? 0.15,
    fibre_habitat_wildlife_buffer_ha: resilience.fibre_habitat_wildlife_buffer_ha ?? 0.10
  };
  const resilienceTotalHa = Object.values(allowances).reduce((sum, value) => sum + value, 0);
  return {
    food_area_ha: foodAreaHa,
    heating_area_ha: heatingAreaHa,
    resilience_allowances_ha: allowances,
    resilience_allowance_total_ha: resilienceTotalHa,
    robust_minimum_area_ha: foodAreaHa + heatingAreaHa + resilienceTotalHa,
    accounting_note: 'Shared heating and multifunctional ecological/resilience functions are household/site terms; adult-equivalent is food-energy normalization only.'
  };
}

/** Separate robust minimum land from optional productive/export surplus. */
export function calculateRobustMinimumVsOptionalProductiveSurplus({robustMinimumHa, allocatedHa, optionalTargetHa = 0} = {}) {
  if (![robustMinimumHa, allocatedHa, optionalTargetHa].every(Number.isFinite)) throw new Error('land surplus calculation requires numeric areas');
  return {
    robust_minimum_area_ha: robustMinimumHa,
    allocated_area_ha: allocatedHa,
    optional_productive_surplus_target_ha: optionalTargetHa,
    minimum_surplus_or_deficit_ha: allocatedHa - robustMinimumHa,
    optional_surplus_area_ha: Math.max(0, allocatedHa - robustMinimumHa - optionalTargetHa),
    optional_target_fully_met: allocatedHa >= robustMinimumHa + optionalTargetHa
  };
}

/** Build the canonical ARC artifacts and return their machine-readable result. */
export function buildCarryingCapacityReport() {
  return buildEvidenceSummary();
}

export function loadCanonicalCarryingCapacity() {
  return readJson('outputs/summary.json');
}

export function getCanonicalHouseholdRows({site = 'ordinary_mesic'} = {}) {
  const summary = loadCanonicalCarryingCapacity();
  const rows = summary.canonical?.mature_food_system?.canonical_rows ?? [];
  return rows.filter((row) => row.site === site);
}
