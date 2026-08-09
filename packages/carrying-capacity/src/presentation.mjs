import fs from 'node:fs';
import path from 'node:path';
import {PACKAGE_ROOT, CARRYING_CAPACITY_CONTRACT_VERSION, loadCanonicalCarryingCapacity} from './index.mjs';
import {calculateGreyCarryingCapacityAdoption} from './regional.mjs';
import {calculateHealthCanadaEER, representativeProfiles} from './health-canada.mjs';
import {householdProfiles, siteClasses, FOOD_ADULT_EQUIVALENT_GJ_YEAR} from './core.mjs';

export const PRESENTATION_CONTRACT_VERSION = '1.0.0';

function readJson(filePath, fallback = {}) { return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : fallback; }
function finite(value, fallback = 0) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }
function metricEnergy(row) { return {mj_day: row.mj_day, gj_year: row.gj_year}; }
function publicEer(row) { return {id: row.id, label: row.label, age_y: row.age_y, sex: row.sex, weight_kg: row.weight_kg, height_cm: row.height_cm, activity: row.activity, ...metricEnergy(row), source: row.source, status: row.status}; }
function pickTransition(row) { return {year: row.year, annual_food_area_ha: row.annual_area_ha, perennial_food_area_ha: row.perennial_area_ha, occupied_food_production_area_ha: row.occupied_food_production_area_ha, annual_food_supplied_gj_year: row.annual_usable_food_gj, perennial_food_supplied_gj_year: row.perennial_usable_food_gj, food_coverage_ratio: row.household_food_coverage_ratio, exportable_food_energy_surplus_gj_year: row.exportable_food_energy_surplus_gj, labour: row.labour}; }
function publicRegional(regional) { return {...regional, scenarios: regional.scenarios.map((scenario) => ({...scenario, transition_years: scenario.transition_years.map(({profile_rows, ...year}) => year)}))}; }

export function buildCarryingCapacityPresentationContract({produceDir = 'know/produce', generatedAt = new Date().toISOString()} = {}) {
  const canonical = loadCanonicalCarryingCapacity();
  const foodEvidence = readJson(path.join(PACKAGE_ROOT, 'data/derived/evidence-food-yields.json'));
  const heatingEvidence = readJson(path.join(PACKAGE_ROOT, 'data/derived/evidence-heating.json'));
  const woodyEvidence = readJson(path.join(PACKAGE_ROOT, 'data/derived/evidence-woody-yields.json'));
  const systemicEnergy = readJson(path.resolve(PACKAGE_ROOT, '../../data/systemic-energy/systemic-energy-v1.json'));
  const dwelling = readJson(path.resolve(produceDir, 'grey-dwelling-land-access.json'));
  const foodCalibration = readJson(path.resolve(produceDir, 'grey-food-calibration.json'));
  const landAccessProxyAvailable = dwelling.dwellingLandAccessValid !== false
    && Number.isFinite(Number(dwelling.estimatedDwellingsWithGardenScaleAccess))
    && Number.isFinite(Number(dwelling.estimatedPopulationWithGardenScaleAccess));
  const eligibleHouseholds = landAccessProxyAvailable ? finite(dwelling.estimatedDwellingsWithGardenScaleAccess) : 0;
  const eligiblePopulation = landAccessProxyAvailable ? finite(dwelling.estimatedPopulationWithGardenScaleAccess) : 0;
  const landAccessStatus = landAccessProxyAvailable ? 'available' : 'unavailable_missing_validated_proxy';
  const energyScenarios = Object.fromEntries(Object.entries(canonical.canonical.human_energy.scenarios ?? {}).map(([id, row]) => [id, publicEer(row)]));
  const publicSiteLabels = {wetter_productive: 'Favourable / productive', ordinary_mesic: 'Ordinary / mesic', shallow_rocky_marginal: 'Marginal / shallow / rocky'};
  const publicSites = Object.fromEntries(Object.keys(publicSiteLabels).map((id) => [id, {id, ...siteClasses[id], label: publicSiteLabels[id]}]));
  const matureRows = (canonical.canonical.mature_food_system.canonical_rows ?? []).filter((row) => row.module === 'plants_only').map((row) => ({site: row.site, site_label: row.site_label, household: row.household, household_label: row.household_label, household_food_gj_year: row.household_food_gj_year, year1_annual_bridge_area_ha: row.year1_annual_bridge_area_ha, mature_annual_area_ha: row.mature_annual_area_ha, mature_perennial_area_ha: row.mature_perennial_area_ha, heating_area_ha: row.heating_area_ha, robust_household_minimum_area_ha: row.robust_household_minimum_area_ha, additional_productive_surplus_area_ha: row.additional_productive_surplus_area_ha, gross_site_area_ha: row.gross_site_area_ha, land_accounting: row.land_accounting, recurring_labour: row.recurring_labour, human_food_energy: row.human_food_energy, evidence_boundary: row.evidence_boundary, selection_rule: row.selection_rule}));
  const transitionRows = (canonical.canonical.food_forest_transition.households ?? []).filter((row) => ['wetter_productive', 'ordinary_mesic', 'shallow_rocky_marginal'].includes(row.site)).map((row) => ({site: row.site, site_label: row.site_label, household: row.household, household_label: row.household_label, household_food_demand_gj_year: row.household_food_demand_gj_year, rows: row.transition.constant_annual_reserve.rows.map(pickTransition), transition_model: row.transition.constant_annual_reserve.description}));
  const presets = Object.entries(householdProfiles).map(([id, profile]) => ({id, label: profile.label, member_ids: profile.member_ids, members: profile.member_ids.map((memberId) => publicEer(canonical.canonical.human_energy.scenarios[memberId]))}));
  const regionalFoodDemandGJ = Number(foodCalibration.foodDemandBaseline?.totalFoodDemandGJ ?? 0);
  const regional = calculateGreyCarryingCapacityAdoption({eligibleHouseholds, eligiblePopulation, regionalFoodDemandGJ, eligibilityBasis: 'estimatedDwellingsWithGardenScaleAccess and corresponding population from the current dwelling-land proxy; not parcel ownership or biological site classification'});
  const siteMixVariants = {
    balanced: regional,
    favourable_heavy: calculateGreyCarryingCapacityAdoption({eligibleHouseholds, eligiblePopulation, regionalFoodDemandGJ, siteShares: {favourable: .5, ordinary: .3, marginal: .2}, eligibilityBasis: 'same garden-scale dwelling-land proxy; alternative explicit site-mix sensitivity'}),
    marginal_heavy: calculateGreyCarryingCapacityAdoption({eligibleHouseholds, eligiblePopulation, regionalFoodDemandGJ, siteShares: {favourable: .15, ordinary: .35, marginal: .5}, eligibilityBasis: 'same garden-scale dwelling-land proxy; alternative explicit site-mix sensitivity'})
  };
  return {
    contract_version: PRESENTATION_CONTRACT_VERSION,
    model_contract_version: CARRYING_CAPACITY_CONTRACT_VERSION,
    model_version: canonical.model_version,
    generated_at: generatedAt,
    units: {energy: 'MJ/day and GJ/year', land: 'ha', labour: 'hours/year', population: 'people'},
    metric_only_presentation: true,
    health_canada: {source: canonical.canonical.human_energy.source, scenarios: energyScenarios, activity_categories: ['inactive', 'low', 'active', 'very'], food_adult_equivalent: {gj_year: FOOD_ADULT_EQUIVALENT_GJ_YEAR, definition: 'Mean food-energy requirement of the representative low-activity adult woman and man; food-energy normalization only, not a land multiplier.'}, equation_note: 'The canonical equation is evaluated in its source form; this public presentation exposes energy in MJ and GJ only.'},
    site_classes: publicSites,
    household_profiles: householdProfiles,
    household_presets: presets,
    mature_rows: matureRows,
    transition_rows: transitionRows,
    heating: {source: heatingEvidence.source, audit: heatingEvidence.audit, cases: Object.fromEntries(Object.entries(heatingEvidence.cases).map(([id, row]) => [id, {assumptions: row.assumptions, useful_space_heating_gj_year: row.heat_loss.annual_useful_space_heating_gj, gross_wood_energy_gj_year: row.wood.gross_wood_energy_required_gj, dry_wood_tonnes_year: row.wood.approximate_dry_wood_tonnes}]))},
    woody_yields: {source: woodyEvidence.source, bands: woodyEvidence.bands, cases: woodyEvidence.cases},
    food_energy_evidence: {source: foodEvidence.source, rows: foodEvidence.rows.map((row) => ({id: row.id, crop: row.crop, category: row.category, food_gj_ha: row.food_gj_ha, protein_kg_ha: row.protein_kg_ha, fat_kg_ha: row.fat_kg_ha, carbohydrate_kg_ha: row.carbohydrate_kg_ha, evidence_type: row.evidence_type, canonical_status: row.canonical_status, source: row.source}))},
    regional: {grey: {...publicRegional(regional), site_mix_variants: Object.fromEntries(Object.entries(siteMixVariants).map(([key, variant]) => [key, publicRegional(variant)]))}, land_access_proxy: {status: landAccessStatus, eligible_households: landAccessProxyAvailable ? eligibleHouseholds : null, eligible_population_people: landAccessProxyAvailable ? eligiblePopulation : null, source_file: 'grey-dwelling-land-access.json', caveat: 'Best current proxy only; Grey County does not yet have a validated parcel-level biological site-capability map. Regional outputs are zeroed when this proxy is unavailable rather than silently reusing stale data.'}},
    systemic_energy_contract: {contract_id: systemicEnergy.contract_id, schema_version: systemicEnergy.schema_version, producer: systemicEnergy.producer, fields: (systemicEnergy.fields ?? []).map((field) => ({field_id: field.field_id, evidence_status: field.evidence_status, source_date: field.source_date, uncertainty: field.uncertainty}))},
    solar: {status: 'conceptual_only', numerical_local_solar_budget: false, note: 'A defensible Owen Sound annual solar-radiation source and transformation chain have not yet been established; no photosynthetic efficiency or crop yield is invented here.'},
    methodology: {dependency_chain: ['person characteristics', 'Health Canada energy requirement', 'annual household food energy', 'balanced low-input food yield', 'annual bridge area', 'perennial transition and resilience reserve', 'mature productive land plus woody heating'], land_accounting: 'Annual food, perennial food, heating and exclusive reserve are kept distinct; soil/water, wildlife, fibre and habitat functions are reported as overlapping multifunctional coverage.', custom_household_note: 'The browser imports pure canonical EER and balanced-food functions. Custom transition charts scale a canonical reference transition explicitly; household presets display full canonical transition rows.', external_input_note: 'Energy-condition multipliers are regional scenario overlays, not replacements for the biological carrying-capacity evidence model.'},
    sources: [{institution: 'Health Canada', title: 'Equations to Estimate Energy Requirement', url: canonical.canonical.human_energy.source, evidence_status: 'official equation'}, {institution: 'Living Region carrying-capacity package', title: 'Evidence summary and canonical household/site rows', url: 'packages/carrying-capacity/outputs/summary.json', evidence_status: 'generated canonical model'}, {institution: 'ECCC / Living Region', title: 'Owen Sound heating-degree-day and dwelling envelope case', url: 'packages/carrying-capacity/data/derived/evidence-heating.json', evidence_status: 'modelled case with climate normal'}, {institution: 'Living Region evidence files', title: 'Balanced low-input food yields and woody biomass bands', url: 'packages/carrying-capacity/data/derived/', evidence_status: 'mixed measured/synthesized evidence; see row status'}]
  };
}
