import {calculateHealthCanadaEER, representativeProfiles} from './health-canada.mjs';
import {siteCapabilityDefinitions, siteCapability, owenSoundGrowingEnvironment} from './environment.mjs';
import {calculateEstablishmentLandRequirement, calculateEstablishmentLandAccounting} from './establishment.mjs';

const round = (value, digits = 6) => Math.round(Number(value) * 10 ** digits) / 10 ** digits;
export const siteClasses = Object.entries(siteCapabilityDefinitions).filter(([id]) => id !== 'wet_land').map(([id, capability]) => ({
  [id]: {
    ...capability,
    environment_id: owenSoundGrowingEnvironment.region.id,
    food_multiplier: capability.food_yield_multiplier,
    woody_band: id === 'wetter_productive' ? 'favourable' : id === 'ordinary_mesic' ? 'ordinary' : 'marginal',
    notes: capability.label + '. This is a scenario capability band, not a parcel-level soil classification.'
  }
})).reduce((out, row) => Object.assign(out, row), {});
export const householdProfiles = {one_adult: {label: '1 adult', member_ids: ['adult_woman'], adult_count: 1}, adult_plus_child: {label: '1 adult + 1 child', member_ids: ['adult_woman', 'child_girl_8'], adult_count: 1}, two_adults: {label: '2 adults', member_ids: ['adult_woman', 'adult_man'], adult_count: 2}, two_adults_plus_one_child: {label: '2 adults + 1 child', member_ids: ['adult_woman', 'adult_man', 'child_girl_8'], adult_count: 2}, two_adults_plus_two_children: {label: '2 adults + 2 children', member_ids: ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14'], adult_count: 2}, two_adults_plus_three_children: {label: '2 adults + 3 children', member_ids: ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14', 'child_boy_8'], adult_count: 2}};
export const arcPolicyAdultAllocationHa = 1;
export const policySiteMap = {favourable: 'wetter_productive', ordinary: 'ordinary_mesic', marginal: 'shallow_rocky_marginal'};
export const foodLossAssumptions = {storage_loss: .1, wildlife_loss: .1, seed_propagation_loss: .03, weather_crop_reserve: .2, emergency_community_reserve: .1};
export const FOOD_ADULT_EQUIVALENT_GJ_YEAR = (calculateHealthCanadaEER(representativeProfiles.adult_woman).gj_year + calculateHealthCanadaEER(representativeProfiles.adult_man).gj_year) / 2;
export const heatingCases = {low: {diameter_m: 9.1, floor_area_m2: 65.6, wall_height_m: 2.4, roof_rise_m: 2, wall_r: 25, roof_r: 45, floor_r: 35, window_area_m2: 6, window_u: .25, ach: .20, indoor_c: 20, design_c: -20, hdd: 4031.9, net_factor: .75, thermal_bridge: 1.10, heater_efficiency: .85, cord_gj: 8}, central: {diameter_m: 9.1, floor_area_m2: 65.6, wall_height_m: 2.4, roof_rise_m: 2, wall_r: 20, roof_r: 40, floor_r: 30, window_area_m2: 8, window_u: .30, ach: .35, indoor_c: 20, design_c: -20, hdd: 4031.9, net_factor: .85, thermal_bridge: 1.15, heater_efficiency: .75, cord_gj: 10}, high: {diameter_m: 9.1, floor_area_m2: 65.6, wall_height_m: 2.4, roof_rise_m: 2, wall_r: 15, roof_r: 30, floor_r: 20, window_area_m2: 10, window_u: .40, ach: .60, indoor_c: 20, design_c: -20, hdd: 4031.9, net_factor: .95, thermal_bridge: 1.30, heater_efficiency: .65, cord_gj: 12}};

const R_TO_RSI = .1761101838;
export const buildingArchetypes = {
  arc_yurt: {label: 'ARC yurt / circular', geometry: 'circular', default_floor_area_m2: 65.6, diameter_m: 9.1, wall_height_m: 2.4, roof_rise_m: 2},
  compact_detached: {label: 'Compact detached', geometry: 'rectangular', default_floor_area_m2: 75, aspect_ratio: 1.25, wall_height_m: 2.4, roof_area_factor: 1.05},
  rectangular_detached: {label: 'Rectangular detached', geometry: 'rectangular', default_floor_area_m2: 110, aspect_ratio: 1.8, wall_height_m: 2.5, roof_area_factor: 1.08},
  shared_community: {label: 'Shared/community building', geometry: 'rectangular', default_floor_area_m2: 150, aspect_ratio: 1.5, wall_height_m: 3, roof_area_factor: 1.08}
};

export const insulationPresets = {
  basic: {label: 'Basic', wall_rsi: 2.64, roof_rsi: 5.28, floor_rsi: 3.52, window_u_w_m2k: .40, window_fraction: .12, ach: .60, thermal_bridge: 1.30, heater_efficiency: .65, net_factor: .95},
  good: {label: 'Good', wall_rsi: 3.52, roof_rsi: 7.04, floor_rsi: 5.28, window_u_w_m2k: .30, window_fraction: .10, ach: .35, thermal_bridge: 1.15, heater_efficiency: .75, net_factor: .85},
  high_performance: {label: 'High-performance', wall_rsi: 4.40, roof_rsi: 7.92, floor_rsi: 6.16, window_u_w_m2k: .25, window_fraction: .08, ach: .20, thermal_bridge: 1.10, heater_efficiency: .85, net_factor: .75},
  custom: {label: 'Custom', wall_rsi: 3.52, roof_rsi: 7.04, floor_rsi: 5.28, window_u_w_m2k: .30, window_fraction: .10, ach: .35, thermal_bridge: 1.15, heater_efficiency: .75, net_factor: .85}
};

export function defaultBuilding() {
  return {id: 'building-1', label: 'ARC yurt', floor_area_m2: 65.6, archetype: 'arc_yurt', insulation: 'good'};
}

function buildingGeometry(archetype, floorArea) {
  if (archetype.geometry === 'circular') {
    const diameter = Math.abs(floorArea - Number(archetype.default_floor_area_m2)) < 1e-9 && archetype.diameter_m ? archetype.diameter_m : Math.sqrt(4 * floorArea / Math.PI);
    const radius = diameter / 2;
    const roofRise = archetype.roof_rise_m ?? 2;
    return {form: 'circular', floor_area_m2: floorArea, radius_m: radius, wall_gross_m2: Math.PI * diameter * archetype.wall_height_m, roof_area_m2: Math.PI * radius * Math.sqrt(radius ** 2 + roofRise ** 2), volume_m3: Math.PI * radius ** 2 * archetype.wall_height_m + Math.PI * radius ** 2 * roofRise / 3};
  }
  const aspect = archetype.aspect_ratio ?? 1.5;
  const width = Math.sqrt(floorArea * aspect);
  const depth = floorArea / width;
  return {form: 'rectangular', floor_area_m2: floorArea, width_m: width, depth_m: depth, wall_gross_m2: 2 * (width + depth) * archetype.wall_height_m, roof_area_m2: floorArea * (archetype.roof_area_factor ?? 1.05), volume_m3: floorArea * archetype.wall_height_m};
}

/** Calculate one heated building from explicit metric envelope assumptions. */
export function calculateBuildingHeatingDemand(building = {}, shared = {}) {
  const archetype = buildingArchetypes[building.archetype ?? 'arc_yurt'] ?? buildingArchetypes.arc_yurt;
  const floorArea = Number(building.floor_area_m2 ?? archetype.default_floor_area_m2);
  if (!Number.isFinite(floorArea) || floorArea <= 0) throw new Error('building floor area must be positive');
  const preset = insulationPresets[building.insulation ?? 'good'] ?? insulationPresets.good;
  const a = {...preset, indoor_c: 20, design_c: -20, hdd: 4031.9, ...shared, ...(building.envelope ?? {}), floor_area_m2: floorArea};
  const geometry = buildingGeometry(archetype, floorArea);
  const windowArea = Number(a.window_area_m2 ?? floorArea * a.window_fraction);
  const wallOpaque = Math.max(0, geometry.wall_gross_m2 - windowArea);
  const wallU = 1 / Number(a.wall_rsi);
  const roofU = 1 / Number(a.roof_rsi);
  const floorU = 1 / Number(a.floor_rsi);
  const opaqueUa = (wallOpaque * wallU + geometry.roof_area_m2 * roofU + floorArea * floorU) * Number(a.thermal_bridge);
  const windowUa = windowArea * Number(a.window_u_w_m2k);
  const ventilationUa = .33 * Number(a.ach) * geometry.volume_m3;
  const totalUa = opaqueUa + windowUa + ventilationUa;
  const grossEnvelopeGJ = totalUa * Number(a.hdd) * 24 / 1000 * .0036;
  const usefulGJ = grossEnvelopeGJ * Number(a.net_factor);
  const grossWoodGJ = usefulGJ / Number(a.heater_efficiency);
  return {building: {id: building.id ?? 'building', label: building.label ?? archetype.label, archetype: building.archetype ?? 'arc_yurt', insulation: building.insulation ?? 'good'}, assumptions: {...a, window_area_m2: windowArea, window_u_w_m2k: Number(a.window_u_w_m2k)}, geometry, heat_loss: {wall_u_w_m2k: 1 / Number(a.wall_rsi), roof_u_w_m2k: 1 / Number(a.roof_rsi), floor_u_w_m2k: 1 / Number(a.floor_rsi), opaque_ua_w_k: opaqueUa, window_ua_w_k: windowUa, ventilation_ua_w_k: ventilationUa, total_ua_w_k: totalUa, annual_useful_space_heating_gj: grossEnvelopeGJ * Number(a.net_factor), design_heat_loss_kw: totalUa * (Number(a.indoor_c) - Number(a.design_c)) / 1000}, wood: {gross_wood_energy_required_gj: grossWoodGJ, heater_efficiency: Number(a.heater_efficiency), approximate_dry_wood_tonnes: grossWoodGJ / 19}};
}

export function calculateHeatingLoads({buildings = [defaultBuilding()], shared = {}} = {}) {
  const rows = buildings.map((building) => calculateBuildingHeatingDemand(building, shared));
  return {buildings: rows, total_useful_heat_gj_year: rows.reduce((sum, row) => sum + row.heat_loss.annual_useful_space_heating_gj, 0), total_gross_wood_energy_gj_year: rows.reduce((sum, row) => sum + row.wood.gross_wood_energy_required_gj, 0), total_ua_w_k: rows.reduce((sum, row) => sum + row.heat_loss.total_ua_w_k, 0)};
}

export const labourCapacityLevels = {
  dependent: {label: 'Dependent / no assigned productive labour', hours_year: 0, heavy_hours_year: 0},
  light: {label: 'Light work', hours_year: 300, heavy_hours_year: 25},
  moderate: {label: 'Moderate work', hours_year: 700, heavy_hours_year: 140},
  full: {label: 'Full physical work', hours_year: 1100, heavy_hours_year: 350}
};

export function calculateHouseholdLabourCapacity(members = []) {
  const rows = members.map((member) => { const level = labourCapacityLevels[member.labour_level ?? 'moderate'] ?? labourCapacityLevels.moderate; return {id: member.id, label: member.label, labour_level: member.labour_level ?? 'moderate', available_hours_year: Number(member.available_labour_hours_year ?? level.hours_year), heavy_work_hours_year: Number(member.heavy_work_hours_year ?? level.heavy_hours_year)}; });
  return {members: rows, available_hours_year: rows.reduce((sum, row) => sum + row.available_hours_year, 0), heavy_work_hours_year: rows.reduce((sum, row) => sum + row.heavy_work_hours_year, 0)};
}

export function calculateExclusiveLandAllocation({foodAreaHa = 0, heatingAreaHa = 0, reserveHa = 0} = {}) {
  const parts = [{id: 'annual', label: 'Annual food', area_ha: foodAreaHa * .25}, {id: 'perennial', label: 'Perennial food', area_ha: foodAreaHa * .75}, {id: 'wood', label: 'Renewable heating biomass', area_ha: heatingAreaHa}, {id: 'reserve', label: 'Exclusive reserve', area_ha: reserveHa}];
  return {parts, exclusive_total_ha: parts.reduce((sum, part) => sum + part.area_ha, 0), ecological_overlays: ['soil and water function', 'wildlife and habitat', 'fibre and diversity']};
}

export function calculateEvidenceHeating(overrides = {}) {
  const a = {...heatingCases.central, ...overrides}; const radius = a.diameter_m / 2; const circumference = Math.PI * a.diameter_m; const wallGross = circumference * a.wall_height_m; const roofSlope = Math.sqrt(radius ** 2 + a.roof_rise_m ** 2); const roofArea = Math.PI * radius * roofSlope; const wallOpaque = wallGross - a.window_area_m2; const volume = Math.PI * radius ** 2 * a.wall_height_m + Math.PI * radius ** 2 * a.roof_rise_m / 3; const rToRsi = .1761101838; const wallU = 1 / (a.wall_r * rToRsi); const roofU = 1 / (a.roof_r * rToRsi); const floorU = 1 / (a.floor_r * rToRsi); const opaqueUa = (wallOpaque * wallU + roofArea * roofU + a.floor_area_m2 * floorU) * a.thermal_bridge; const windowUa = a.window_area_m2 * a.window_u; const ventilationUa = .33 * a.ach * volume; const totalUa = opaqueUa + windowUa + ventilationUa; const grossEnvelopeGJ = totalUa * a.hdd * 24 / 1000 * .0036; const usefulGJ = grossEnvelopeGJ * a.net_factor; const grossWoodGJ = usefulGJ / a.heater_efficiency;
  return {assumptions: a, geometry: {radius_m: round(radius, 4), wall_gross_m2: round(wallGross, 4), wall_opaque_m2: round(wallOpaque, 4), roof_area_m2: round(roofArea, 4), floor_area_m2: a.floor_area_m2, conditioned_volume_m3: round(volume, 4)}, heat_loss: {wall_u_w_m2k: round(wallU, 6), roof_u_w_m2k: round(roofU, 6), floor_u_w_m2k: round(floorU, 6), opaque_ua_w_k: round(opaqueUa, 6), window_ua_w_k: round(windowUa, 6), ventilation_ua_w_k: round(ventilationUa, 6), total_ua_w_k: round(totalUa, 6), annual_gross_envelope_loss_gj: round(grossEnvelopeGJ, 6), annual_useful_space_heating_gj: round(usefulGJ, 6), design_heat_loss_kw: round(totalUa * (a.indoor_c - a.design_c) / 1000, 6)}, wood: {gross_wood_energy_required_gj: round(grossWoodGJ, 6), heater_efficiency: a.heater_efficiency, dry_wood_energy_gj_per_tonne: 19, approximate_dry_wood_tonnes: round(grossWoodGJ / 19, 6), approximate_dry_wood_kg: round(grossWoodGJ / 19 * 1000, 2), cord_energy_gj: a.cord_gj, approximate_cords_per_year: round(grossWoodGJ / a.cord_gj, 6)}};
}

export function calculateFoodSystem(foodEvidence, demandGJ, siteMultiplierOrCapability = 1, proteinReferenceWeightKg = 70) {
  const wanted = {potato_low_input_synthesis: .25, wheat_low_input_synthesis: .2, dry_beans_low_input_synthesis: .2, sunflower_low_input_synthesis: .25, oats_low_input_synthesis: .1};
  const capability = siteMultiplierOrCapability && typeof siteMultiplierOrCapability === 'object' ? siteMultiplierOrCapability : null;
  const siteMultiplier = capability?.food_yield_multiplier ?? Number(siteMultiplierOrCapability ?? 1);
  const cropRules = capability?.annual_crops ?? {};
  const viable = Object.entries(wanted).filter(([id]) => cropRules[id]?.viable !== false);
  const viableWeight = viable.reduce((sum, [, energyShare]) => sum + energyShare, 0);
  if (!viableWeight) throw new Error('Selected site has no viable annual food crops');
  const rows = viable.map(([id, baseEnergyShare]) => { const energyShare = baseEnergyShare / viableWeight; const row = foodEvidence.rows.find((item) => item.id === id); if (!row || !row.food_gj_ha) throw new Error(`Missing canonical food-system row: ${id}`); const cropRule = cropRules[id]; const cropMultiplier = cropRule && Number.isFinite(Number(cropRule.yield_multiplier)) ? Number(cropRule.yield_multiplier) : siteMultiplier; const foodGJHa = row.food_gj_ha * cropMultiplier; return {id, crop: row.crop, category: row.category, energy_share: energyShare, viability: 'viable', site_yield_multiplier: cropMultiplier, food_gj_ha: foodGJHa, area_ha: demandGJ * energyShare / foodGJHa, protein_kg_ha: row.protein_kg_ha * cropMultiplier, fat_kg_ha: row.fat_kg_ha * cropMultiplier, carbohydrate_kg_ha: row.carbohydrate_kg_ha * cropMultiplier}; });
  const rawArea = rows.reduce((sum, row) => sum + row.area_ha, 0); const grossEnergyPerHa = demandGJ / rawArea; const postHarvestFactor = (1 - foodLossAssumptions.storage_loss) * (1 - foodLossAssumptions.wildlife_loss) * (1 - foodLossAssumptions.seed_propagation_loss); const householdDeliveryFactor = postHarvestFactor * (1 - foodLossAssumptions.weather_crop_reserve - foodLossAssumptions.emergency_community_reserve); const requiredArea = demandGJ / (grossEnergyPerHa * householdDeliveryFactor);
  const macro = rows.reduce((totals, row) => { const area = requiredArea * row.area_ha / rawArea; totals.protein_kg += area * row.protein_kg_ha; totals.fat_kg += area * row.fat_kg_ha; totals.carbohydrate_kg += area * row.carbohydrate_kg_ha; return totals; }, {protein_kg: 0, fat_kg: 0, carbohydrate_kg: 0});
  const deliveredMacro = Object.fromEntries(Object.entries(macro).map(([key, value]) => [key, value * householdDeliveryFactor])); const macroEnergyGJ = {protein: deliveredMacro.protein_kg * .016736, fat: deliveredMacro.fat_kg * .037656, carbohydrate: deliveredMacro.carbohydrate_kg * .016736}; const macroEnergyTotal = Object.values(macroEnergyGJ).reduce((sum, value) => sum + value, 0); const macroShares = Object.fromEntries(Object.entries(macroEnergyGJ).map(([key, value]) => [key, round(value / macroEnergyTotal * 100, 3)]));
  return {diet_energy_shares: wanted, viable_crop_ids: rows.map((row) => row.id), excluded_crop_ids: Object.keys(wanted).filter((id) => !rows.some((row) => row.id === id)), rows, gross_energy_per_ha: round(grossEnergyPerHa), raw_calorie_area_ha: round(rawArea), delivery_factor_after_losses_and_reserves: round(householdDeliveryFactor), required_food_area_ha: round(requiredArea), gross_food_energy_at_required_area_gj: round(grossEnergyPerHa * requiredArea), delivered_food_energy_gj: round(grossEnergyPerHa * requiredArea * householdDeliveryFactor), macro_output_at_required_area: Object.fromEntries(Object.entries(macro).map(([key, value]) => [key, round(value)])), macro_delivered_to_household: Object.fromEntries(Object.entries(deliveredMacro).map(([key, value]) => [key, round(value)])), macro_energy_shares_percent: macroShares, protein_g_day: round(deliveredMacro.protein_kg * 1000 / 365.25, 3), protein_reference_target_g_day: round(proteinReferenceWeightKg * .8, 3), protein_threshold_met: deliveredMacro.protein_kg * 1000 / 365.25 >= proteinReferenceWeightKg * .8, macro_range_check: {protein_10_to_35_percent: macroShares.protein >= 10 && macroShares.protein <= 35, fat_20_to_35_percent: macroShares.fat >= 20 && macroShares.fat <= 35, carbohydrate_45_to_65_percent: macroShares.carbohydrate >= 45 && macroShares.carbohydrate <= 65, status: 'screening check only; does not establish micronutrient sufficiency'}, assumptions: {...foodLossAssumptions, protein_reference_g_per_kg: .8, macro_energy_factors: '0.016736 GJ/kg protein and carbohydrate; 0.037656 GJ/kg fat'}};
}

export function calculateInteractiveHousehold({members = [], buildings = [defaultBuilding()], siteId = 'ordinary_mesic', foodEvidence, woodyCases, matureReferenceRow, establishmentModel = null, arcPolicyAllocationHa = null} = {}) {
  const demand = members.reduce((sum, member) => sum + Number(member.gj_year), 0);
  const referenceWeight = members.reduce((sum, member) => sum + Number(member.weight_kg), 0);
  const site = siteClasses[siteId] ?? siteClasses.ordinary_mesic;
  const food = calculateFoodSystem(foodEvidence, demand, site, referenceWeight);
  const heating = calculateHeatingLoads({buildings});
  const woodBand = woodyCases?.central?.[site.woody_band];
  const baseWoodYield = Number(woodBand?.usable_gross_energy_gj_ha_year ?? woodBand?.usable_gross_energy_gj_year ?? 0);
  const woodYield = baseWoodYield * Number(site.woody_yield_multiplier ?? 1);
  const heatingArea = woodYield > 0 ? heating.total_gross_wood_energy_gj_year / woodYield : 0;
  const resilience = {diversity_and_rotation_ha: round(Math.max(.12, food.required_food_area_ha * .25)), soil_water_perennial_buffer_ha: .15, fibre_habitat_wildlife_buffer_ha: .1};
  const landAllocation = calculateExclusiveLandAllocation({foodAreaHa: food.required_food_area_ha, heatingAreaHa: heatingArea, reserveHa: resilience.diversity_and_rotation_ha});
  const robustMinimum = landAllocation.exclusive_total_ha;
  const adultCount = Math.max(1, members.filter((member) => Number(member.age_y ?? 35) >= 19).length);
  const policyAllocation = arcPolicyAllocationHa ?? adultCount;
  let establishmentLand = null;
  if (establishmentModel) {
    const modelInputs = {demandGJ: demand, annualYieldGJHaYear: food.gross_energy_per_ha, perennialMix: establishmentModel.perennial_mix, curveAnchors: establishmentModel.curve_anchors, years: establishmentModel.years, annualIntercropOverlap: establishmentModel.annual_intercrop_overlap_by_year, loss: establishmentModel.loss_or_reserve_fraction ?? .30, annualReserveFraction: establishmentModel.annual_reserve_fraction ?? .25, heatingAreaHa: heatingArea, exclusiveReserveHa: resilience.diversity_and_rotation_ha, arcPolicyAllocationHa: policyAllocation};
    const progressive = calculateEstablishmentLandRequirement({...modelInputs, strategy: 'progressive_handoff'});
    const constant = calculateEstablishmentLandRequirement({...modelInputs, strategy: 'constant_annual_reserve'});
    establishmentLand = calculateEstablishmentLandAccounting({progressive, constant});
  }
  const referenceDemand = Number(matureReferenceRow?.household_food_gj_year ?? demand) || demand;
  const referenceLabour = matureReferenceRow?.recurring_labour ?? {};
  const labourCapacity = calculateHouseholdLabourCapacity(members);
  const scale = demand / referenceDemand;
  const labourRequired = {hours_year: Number(referenceLabour.total_recurring_labour_hours ?? 0) * scale, heavy_hours_year: Number(referenceLabour.physically_demanding_hours ?? 0) * scale};
  return {members, buildings, household_food_gj_year: round(demand), food_adult_equivalents: round(demand / FOOD_ADULT_EQUIVALENT_GJ_YEAR), food_adult_equivalent_basis_gj_year: round(FOOD_ADULT_EQUIVALENT_GJ_YEAR), food, food_area_ha: food.required_food_area_ha, heating_area_ha: round(heatingArea), heating, resilience_allowances_ha: resilience, land_allocation: {...landAllocation, exclusive_total_ha: round(landAllocation.exclusive_total_ha)}, robust_minimum_area_ha: round(robustMinimum), establishment_land: establishmentLand, arc_policy_allocation_ha: round(policyAllocation), reference_transition_scale: round(scale), labour: {required_hours_year: round(labourRequired.hours_year), required_heavy_hours_year: round(labourRequired.heavy_hours_year), available_hours_year: round(labourCapacity.available_hours_year), available_heavy_hours_year: round(labourCapacity.heavy_work_hours_year), surplus_hours_year: round(labourCapacity.available_hours_year - labourRequired.hours_year), surplus_heavy_hours_year: round(labourCapacity.heavy_work_hours_year - labourRequired.heavy_hours_year), capacity: labourCapacity}, site_id: siteId, caveat: 'Food-adult-equivalent is a food-energy normalization only, not a total-land multiplier. Food demand and assigned labour capacity are independent inputs. When establishmentModel is supplied, bare-land establishment and mature land are calculated independently of ARC allocation.'};
}
