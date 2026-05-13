// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { loadScenarioFiles, scenarioById } from '../reliability/scenario_contract.mjs';

function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function esc(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; }
function toCsv(rows, headers) { return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n'); }

function readJsonIfExists(filePath, warnings, label, fallback = null) {
  if (!fs.existsSync(filePath)) {
    warnings.push(`Missing ${label}: ${filePath}`);
    return fallback;
  }
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (error) {
    warnings.push(`Failed to parse ${label}: ${filePath} (${error.message})`);
    return fallback;
  }
}

const SHOCK_PCTS = [0, 5, 10, 15, 20, 25, 30, 40, 50];
const MEALS_PER_GJ = 571.0; // approx 700 kcal meal equivalent
const TREND_YEARS = [2026, 2027, 2030];

const OIL_TO_FUEL_PRICE_PROFILES = {
  linearConservative: [[0, 0], [5, 6], [10, 13], [20, 25], [40, 50], [50, 65]],
  tightMarketNonlinear: [[0, 0], [5, 50], [10, 100], [20, 175], [40, 300], [50, 380]],
  policyBuffered: [[0, 0], [5, 20], [10, 40], [20, 80], [40, 150], [50, 190]]
};

const FOOD_PASS_THROUGH_PROFILES = {
  conservativeFoodPassThrough: [[0, 0], [5, 4], [10, 8], [20, 16], [40, 33], [50, 45]],
  centralFoodPassThrough: [[0, 0], [5, 10], [10, 20], [20, 35], [40, 65], [50, 85]],
  severeFoodPassThrough: [[0, 0], [5, 14], [10, 28], [20, 50], [40, 90], [50, 120]]
};

function thresholdAt(rows, fn) {
  const hit = rows.find(fn);
  return hit ? hit.scenario : null;
}

function interpolateFromPoints(points, x) {
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  if (x <= sorted[0][0]) return sorted[0][1];
  if (x >= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const [x0, y0] = sorted[i];
    const [x1, y1] = sorted[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return sorted[sorted.length - 1][1];
}

export function buildGreyCurrentSystemShockThresholdReport(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  fs.mkdirSync(produceDir, { recursive: true });
  const warnings = [];

  const foodCalibration = readJsonIfExists(path.join(produceDir, 'grey-food-calibration.json'), warnings, 'food calibration', {});
  const fuelShock = readJsonIfExists(path.join(produceDir, 'grey-fuel-fertilizer-shock.json'), warnings, 'fuel shock', {});
  const agLabour = readJsonIfExists(path.join(produceDir, 'grey-ag-labour-baseline.json'), warnings, 'ag labour baseline', {});
  const dwelling = readJsonIfExists(path.join(produceDir, 'grey-dwelling-land-access.json'), warnings, 'dwelling land access', {});
  const populationDist = readJsonIfExists(path.join(produceDir, 'grey-population-distribution.json'), warnings, 'population distribution', {});
  const transition = readJsonIfExists(path.join(produceDir, 'grey-transition-pathways.json'), warnings, 'transition pathways', {});
  const assessment = readJsonIfExists(path.join(produceDir, 'living-region-model-assessment.json'), warnings, 'assessment', {});

  const totalPopulation = n(populationDist.totalPopulationMatched, n(dwelling.totalPopulation, 100905));
  const totalDemandGJ = n(foodCalibration.foodDemandBaseline?.totalFoodDemandGJ, 379967.87);
  const localizedScenario = (foodCalibration.plausibilityScenarios ?? []).find((s) => s.scenario === 'localizedPresentTechBaseline') ?? {};
  const baseCoverage = n(localizedScenario.foodCoverage, 0.472);
  const baseNetGJ = n(localizedScenario.netFoodEnergyGJ, baseCoverage * totalDemandGJ);
  const currentAgIndustryFTE = n(agLabour.currentAgIndustryFTEEstimate, 3918.43);
  const baseFoodInsecurityShare = n(transition.assumptions?.currentFoodInsecurityShare, 0.25);
  const defaultMeasuredFoodInsecurityShare = n(options.defaultMeasuredFoodInsecurityShare, 0.25);
  const vulnerabilityToMeasuredFoodInsecurityConversionFactor = n(options.vulnerabilityToMeasuredFoodInsecurityConversionFactor, 0.5);
  const noDirectLandAccessPopulation = n(dwelling.estimatedPopulationNoDirectLandAccess, 7990);
  const subsistencePotentialPopulation = n(dwelling.estimatedPopulationWithSubsistencePotential, 54949);
  const importDependencyIndex = 0.86;
  const scenarioLoad = loadScenarioFiles({ scenariosDir: options.scenariosDir ?? 'know/input/scenarios' });
  if (scenarioLoad.status === 'fail') warnings.push(...scenarioLoad.failures);
  const lowScenario = scenarioById(scenarioLoad.scenarios, 'hormuz_shock_low');
  const centralScenario = scenarioById(scenarioLoad.scenarios, 'hormuz_shock_central');
  const highScenario = scenarioById(scenarioLoad.scenarios, 'hormuz_shock_high');
  const a = (scn, key, fallback) => n(scn?.assumptions?.[key]?.value, fallback);

  const hormuzCurrentMultiInputDisruption2026 = {
    scenario: 'hormuzCurrentMultiInputDisruption2026',
    status: 'active_current_disruption_scenario',
    description: 'Current Strait of Hormuz disruption modelled as a multi-input food-system chokepoint, not only an oil shock.',
    oilDieselConstraintPct: a(centralScenario, 'oil_diesel_constraint_pct', 20),
    lngNaturalGasConstraintPct: a(centralScenario, 'lng_natural_gas_constraint_pct', 20),
    nitrogenFertilizerConstraintPct: a(centralScenario, 'nitrogen_fertilizer_constraint_pct', 18),
    sulfurPhosphateConstraintPct: a(centralScenario, 'sulfur_phosphate_constraint_pct', 16),
    shippingInsuranceReroutingConstraintPct: a(centralScenario, 'shipping_insurance_rerouting_constraint_pct', 25),
    inputPriceMultiplier: a(centralScenario, 'input_price_multiplier', 1.55),
    inputAvailabilityMultiplier: a(centralScenario, 'input_availability_multiplier', 0.82),
    foodPricePressureMultiplier: a(centralScenario, 'food_price_pressure_multiplier', 1.35),
    foodProductionLossScenarioRangePct: {
      low: a(lowScenario, 'global_food_production_loss_pct', 5),
      moderate: a(centralScenario, 'global_food_production_loss_pct', 12),
      severe: a(centralScenario, 'global_food_production_loss_pct', 20),
      extreme: a(highScenario, 'global_food_production_loss_pct', 30)
    },
    sourceStatus: 'scenario assumptions; calibrate with current market and logistics data'
  };
  const currentDisruptionBands = [
    {
      scenario: 'currentDisruptionLow',
      bandLabel: 'low',
      globalFoodProductionLossPct: a(lowScenario, 'global_food_production_loss_pct', 5),
      localFoodAvailabilityStressPct: 4,
      foodPricePressureIndex: 0.42,
      fertilizerAvailabilityStressPct: a(lowScenario, 'nitrogen_fertilizer_constraint_pct', 8),
      fuelAvailabilityStressPct: a(lowScenario, 'oil_diesel_constraint_pct', 10),
      shippingStressPct: a(lowScenario, 'shipping_insurance_rerouting_constraint_pct', 12),
      notes: 'Current Hormuz disruption band; low stress scenario, not a forecast.'
    },
    {
      scenario: 'currentDisruptionModerate',
      bandLabel: 'moderate',
      globalFoodProductionLossPct: a(centralScenario, 'global_food_production_loss_pct', 12),
      localFoodAvailabilityStressPct: 9,
      foodPricePressureIndex: 0.56,
      fertilizerAvailabilityStressPct: a(centralScenario, 'nitrogen_fertilizer_constraint_pct', 15),
      fuelAvailabilityStressPct: a(centralScenario, 'oil_diesel_constraint_pct', 18),
      shippingStressPct: 20,
      notes: 'Current Hormuz disruption band; moderate stress scenario, not a forecast.'
    },
    {
      scenario: 'currentDisruptionSevere',
      bandLabel: 'severe',
      globalFoodProductionLossPct: a(centralScenario, 'global_food_production_loss_pct', 20),
      localFoodAvailabilityStressPct: 14,
      foodPricePressureIndex: 0.68,
      fertilizerAvailabilityStressPct: a(centralScenario, 'nitrogen_fertilizer_constraint_pct', 24),
      fuelAvailabilityStressPct: a(centralScenario, 'oil_diesel_constraint_pct', 26),
      shippingStressPct: a(centralScenario, 'shipping_insurance_rerouting_constraint_pct', 30),
      notes: 'Current Hormuz disruption band; severe multi-input stress scenario, not a forecast.'
    },
    {
      scenario: 'currentDisruptionExtreme',
      bandLabel: 'extreme',
      globalFoodProductionLossPct: a(highScenario, 'global_food_production_loss_pct', 30),
      localFoodAvailabilityStressPct: 20,
      foodPricePressureIndex: 0.80,
      fertilizerAvailabilityStressPct: a(highScenario, 'nitrogen_fertilizer_constraint_pct', 35),
      fuelAvailabilityStressPct: a(highScenario, 'oil_diesel_constraint_pct', 38),
      shippingStressPct: a(highScenario, 'shipping_insurance_rerouting_constraint_pct', 42),
      notes: 'Current Hormuz disruption band; extreme severe multi-variable scenario, not a forecast.'
    }
  ];

  const lagModel = {
    immediateMarketPriceSignalMonths: '0-1',
    fuelRetailPassThroughMonths: '1-3',
    foodDistributionPassThroughMonths: '2-6',
    fertilizerFarmInputPassThroughMonths: '3-12',
    plantingHarvestImpact: 'next growing season',
    foodBankHouseholdStressImpactMonths: '1-6',
    municipalBudgetServiceImpactMonths: '3-12'
  };

  const measuredFoodInsecurityAnchor = {
    defaultMeasuredFoodInsecurityShare,
    sourceStatus: 'Canada/Ontario external anchor unless local Grey data loaded',
    measuredFoodInsecurityEstimate: totalPopulation * defaultMeasuredFoodInsecurityShare
  };
  const severeSystemicInputLoss33Framing = {
    globalFoodProductionLossShare: 0.33,
    localFoodAvailabilityLossShare: 0.12,
    importPricePressureMultiplier: 1.55,
    localProductionShockShare: 0.08,
    tradeCompetitionIndex: 0.85,
    poorCountryDisproportionateImpactNote: 'Global shock harms poorer countries and lower-income households first and hardest.',
    householdAffordabilityTransmissionShare: 0.72,
    sourceStatus: 'severe global scenario assumption, not forecast',
    interpretation: 'global price/availability shock, not direct local crop failure'
  };
  const localSoupKitchenMealsPerDay = options.localSoupKitchenMealsPerDay ?? null;
  const localFoodBankUsageIndex = options.localFoodBankUsageIndex ?? null;
  const emergencyFoodDemandStatus = options.emergencyFoodDemandStatus ?? null;
  const localContext = {
    localSoupKitchenMealsPerDay,
    localFoodBankUsageIndex,
    emergencyFoodDemandStatus,
    sourceStatus: localSoupKitchenMealsPerDay == null
      ? 'local service-demand baseline not loaded'
      : 'local observation, needs validation',
    baselineStressAlreadyHigh: localSoupKitchenMealsPerDay != null ? localSoupKitchenMealsPerDay >= 1000 : false
  };
  const foodInsecurityTrendBaseline = {
    trendSourceStatus: 'external Canada/Ontario anchor, not Grey-specific',
    notForecast: true,
    trendDataPoints: {
      tenProvinces2019HouseholdShare: { value: 0.168, sourceLabel: 'Ten provinces 2019', sourceUrl: 'https://proof.utoronto.ca/food-insecurity/' },
      tenProvinces2022HouseholdShare: { value: 0.184, sourceLabel: 'Ten provinces 2022', sourceUrl: 'https://proof.utoronto.ca/food-insecurity/' },
      tenProvinces2023PeopleShare: { value: 0.229, sourceLabel: 'Ten provinces 2023', sourceUrl: 'https://proof.utoronto.ca/food-insecurity/' },
      tenProvinces2024PeopleShare: { value: 0.255, sourceLabel: 'Ten provinces 2024', sourceUrl: 'https://proof.utoronto.ca/food-insecurity/' },
      canada2025PeopleShare: { value: 0.240, sourceLabel: 'Canada 2025 people share', sourceUrl: 'https://proof.utoronto.ca/food-insecurity/' },
      ontario2019HouseholdShare: { value: 0.171, sourceLabel: 'Ontario 2019 household share', sourceUrl: 'https://proof.utoronto.ca/food-insecurity/' },
      ontario2023HouseholdShare: { value: 0.242, sourceLabel: 'Ontario 2023 household share', sourceUrl: 'https://proof.utoronto.ca/food-insecurity/' }
    },
    baselineTrendScenario: ['conservative', 'central', 'severe']
  };

  const trendProjection = [
    { trendScenario: 'conservative', year: 2026, projectedMeasuredFoodInsecurityShareWithoutShock: 0.245, notes: 'flat to slight increase' },
    { trendScenario: 'conservative', year: 2027, projectedMeasuredFoodInsecurityShareWithoutShock: 0.248, notes: 'flat to slight increase' },
    { trendScenario: 'conservative', year: 2030, projectedMeasuredFoodInsecurityShareWithoutShock: 0.255, notes: 'slow increase' },
    { trendScenario: 'central', year: 2026, projectedMeasuredFoodInsecurityShareWithoutShock: 0.278, notes: 'rising pre-shock trajectory' },
    { trendScenario: 'central', year: 2027, projectedMeasuredFoodInsecurityShareWithoutShock: 0.300, notes: 'about 30% by 2027' },
    { trendScenario: 'central', year: 2030, projectedMeasuredFoodInsecurityShareWithoutShock: 0.325, notes: 'continued trend stress' },
    { trendScenario: 'severe', year: 2026, projectedMeasuredFoodInsecurityShareWithoutShock: 0.295, notes: 'high-stress trend' },
    { trendScenario: 'severe', year: 2027, projectedMeasuredFoodInsecurityShareWithoutShock: 0.330, notes: 'above 30% by 2027' },
    { trendScenario: 'severe', year: 2030, projectedMeasuredFoodInsecurityShareWithoutShock: 0.370, notes: 'sustained severe trend' }
  ].map((r) => ({ ...r, projectedFoodInsecurePeopleWithoutShock: r.projectedMeasuredFoodInsecurityShareWithoutShock * totalPopulation }));

  const shockScenarios = SHOCK_PCTS.map((pct) => {
    const s = pct / 100;
    const fuelAvailabilityIndex = clamp(1 - s, 0.4, 1);
    const dieselPriceMultiplier = 1 + s * 2.6;
    const fertilizerPriceMultiplier = 1 + s * 1.8;
    const transportCostMultiplier = 1 + s * 1.9;
    const foodImportCostMultiplier = 1 + s * 1.5;
    const farmInputCostMultiplier = 1 + s * 1.7;
    const householdFoodPriceMultiplier = 1 + s * 1.25;
    const householdTransportCostMultiplier = 1 + s * 1.55;
    const lagMonthsToHouseholdImpact = clamp(1 + s * 6, 1, 7);
    const lagMonthsToFarmInputImpact = clamp(3 + s * 8, 3, 12);
    const lagMonthsToFoodBankImpact = clamp(1 + s * 5, 1, 6);
    const lagMonthsToMunicipalBudgetImpact = clamp(3 + s * 9, 3, 12);

    const netCoveragePenalty = s * 0.62;
    const foodCoverage = clamp(baseCoverage * (1 - netCoveragePenalty), 0.05, 2);
    const netFoodEnergyGJ = foodCoverage * totalDemandGJ;
    const foodSurplusGJ = netFoodEnergyGJ - totalDemandGJ;
    const additionalFoodAidNeedGJ = Math.max(0, -foodSurplusGJ);
    const additionalFoodAidNeedMealsEquivalent = additionalFoodAidNeedGJ * MEALS_PER_GJ;

    const averageFoodCostBurdenIndex = clamp(0.31 + (householdFoodPriceMultiplier - 1) * 0.7 + (1 - foodCoverage) * 0.3, 0, 1);
    const transportCostBurdenIndex = clamp(0.28 + (householdTransportCostMultiplier - 1) * 0.8, 0, 1);
    const combinedHouseholdStressIndex = clamp(averageFoodCostBurdenIndex * 0.55 + transportCostBurdenIndex * 0.35 + (1 - foodCoverage) * 0.25, 0, 1);

    const foodStressRiskShare = clamp(baseFoodInsecurityShare + (1 - foodCoverage) * 0.72 + (averageFoodCostBurdenIndex - 0.3) * 0.3 + (transportCostBurdenIndex - 0.28) * 0.2 + (noDirectLandAccessPopulation / Math.max(1, totalPopulation)) * 0.12, 0.08, 0.98);
    const foodInsecurityRiskShare = clamp(baseFoodInsecurityShare + (1 - foodCoverage) * 0.45 + (averageFoodCostBurdenIndex - 0.3) * 0.22 + (transportCostBurdenIndex - 0.28) * 0.12 + (noDirectLandAccessPopulation / Math.max(1, totalPopulation)) * 0.1, 0.05, 0.95);
    const severeFoodStressShare = clamp(foodInsecurityRiskShare * 0.33 + s * 0.08, 0.01, 0.65);
    const foodStressRiskPopulation = foodStressRiskShare * totalPopulation;
    const foodInsecurityVulnerabilityPopulation = foodInsecurityRiskShare * totalPopulation;
    const severeFoodStressPopulation = severeFoodStressShare * totalPopulation;

    const foodBankPressureIndex = clamp((foodInsecurityRiskShare - baseFoodInsecurityShare) * 1.8 + s * 0.35, 0, 1);
    const municipalEmergencyPressureIndex = clamp(combinedHouseholdStressIndex * 0.5 + foodBankPressureIndex * 0.35 + s * 0.2, 0, 1);
    const foodWorkersNeededFTE = Math.max(0, currentAgIndustryFTE * (1 + s * 7.5));
    const agLabourGapExceedsCurrent = foodWorkersNeededFTE > currentAgIndustryFTE * 2;

    return {
      scenario: `fuelShock${pct}`,
      fuelShockPct: pct,
      fuelAvailabilityIndex,
      dieselPriceMultiplier,
      fertilizerPriceMultiplier,
      transportCostMultiplier,
      foodImportCostMultiplier,
      farmInputCostMultiplier,
      householdFoodPriceMultiplier,
      householdTransportCostMultiplier,
      lagMonthsToHouseholdImpact,
      lagMonthsToFarmInputImpact,
      lagMonthsToFoodBankImpact,
      lagMonthsToMunicipalBudgetImpact,
      lagMonthsToAcutePain: clamp(lagMonthsToHouseholdImpact + 1.5, 1, 12),
      averageFoodCostBurdenIndex,
      transportCostBurdenIndex,
      householdStressIndex: combinedHouseholdStressIndex,
      combinedHouseholdStressIndex,
      foodStressRiskPopulation,
      foodInsecurityVulnerabilityPopulation,
      foodInsecurityRiskExposurePopulation: foodInsecurityVulnerabilityPopulation, // backward-compatible alias
      severeFoodStressPopulation,
      additionalFoodAidNeedGJ,
      additionalFoodAidNeedMealsEquivalent,
      foodBankPressureIndex,
      municipalEmergencyPressureIndex,
      foodCoverage,
      foodSurplusGJ,
      foodWorkersNeededFTE,
      agLabourGapExceedsCurrent,
      mainThresholdCrossed: 'none',
      notes: 'Current supply-chain-dependent system, no resilience package assumed.'
    };
  });

  const baseline = shockScenarios[0];
  for (const row of shockScenarios) {
    row.baselineFoodStressRiskPopulation = baseline.foodStressRiskPopulation;
    row.addedFoodStressRiskPopulationVsFuelShock0 = row.foodStressRiskPopulation - baseline.foodStressRiskPopulation;
    row.baselineFoodInsecurityVulnerabilityPopulation = baseline.foodInsecurityVulnerabilityPopulation;
    row.addedFoodInsecurityVulnerabilityVsFuelShock0 = row.foodInsecurityVulnerabilityPopulation - baseline.foodInsecurityVulnerabilityPopulation;
    row.baselineSevereFoodStressPopulation = baseline.severeFoodStressPopulation;
    row.addedSevereFoodStressVsFuelShock0 = row.severeFoodStressPopulation - baseline.severeFoodStressPopulation;
    row.measuredFoodInsecurityBaselineEstimate = measuredFoodInsecurityAnchor.measuredFoodInsecurityEstimate;
    row.modelVulnerabilityBaselineEstimate = baseline.foodInsecurityVulnerabilityPopulation;
    row.shockAddedFoodInsecurityRiskExposure = row.addedFoodInsecurityVulnerabilityVsFuelShock0;
    row.shockAddedSevereFoodStressRisk = row.addedSevereFoodStressVsFuelShock0;
    row.calibratedFoodInsecurityEstimateUnderShock = measuredFoodInsecurityAnchor.measuredFoodInsecurityEstimate + (row.shockAddedFoodInsecurityRiskExposure * vulnerabilityToMeasuredFoodInsecurityConversionFactor);
    row.broaderThanMeasuredFoodInsecurity = true;
  }
  const centralTrend = trendProjection.filter((r) => r.trendScenario === 'central');
  const yearToCentralShare = new Map(centralTrend.map((r) => [r.year, r.projectedMeasuredFoodInsecurityShareWithoutShock]));
  const shockOverlayOnTrend = [];
  for (const trendRow of trendProjection) {
    for (const shockRow of shockScenarios) {
      const shockAddedMeasuredFoodInsecurityShare = (shockRow.shockAddedFoodInsecurityRiskExposure / Math.max(1, totalPopulation)) * vulnerabilityToMeasuredFoodInsecurityConversionFactor;
      const projectedMeasuredFoodInsecurityShareWithShock = clamp(
        trendRow.projectedMeasuredFoodInsecurityShareWithoutShock + shockAddedMeasuredFoodInsecurityShare,
        0,
        0.98
      );
      const projectedFoodInsecurePeopleWithShock = projectedMeasuredFoodInsecurityShareWithShock * totalPopulation;
      const addedPeopleVsTrendBaseline = projectedFoodInsecurePeopleWithShock - trendRow.projectedFoodInsecurePeopleWithoutShock;
      let yearsOfTrendAccelerationEquivalent = 0;
      if (trendRow.trendScenario === 'central') {
        const centralNow = trendRow.projectedMeasuredFoodInsecurityShareWithoutShock;
        const centralWithShock = projectedMeasuredFoodInsecurityShareWithShock;
        const future = centralTrend.find((r) => r.year > trendRow.year && r.projectedMeasuredFoodInsecurityShareWithoutShock >= centralWithShock);
        yearsOfTrendAccelerationEquivalent = future ? Math.max(0, future.year - trendRow.year) : (centralWithShock > centralNow ? (2030 - trendRow.year) : 0);
      }
      shockOverlayOnTrend.push({
        trendScenario: trendRow.trendScenario,
        year: trendRow.year,
        projectedMeasuredFoodInsecurityShareWithoutShock: trendRow.projectedMeasuredFoodInsecurityShareWithoutShock,
        projectedFoodInsecurePeopleWithoutShock: trendRow.projectedFoodInsecurePeopleWithoutShock,
        fuelShockScenario: shockRow.scenario,
        shockAddedMeasuredFoodInsecurityShare,
        projectedMeasuredFoodInsecurityShareWithShock,
        projectedFoodInsecurePeopleWithShock,
        addedPeopleVsTrendBaseline,
        yearsOfTrendAccelerationEquivalent,
        caveat: 'Trend scenario diagnostic, not a forecast.'
      });
    }
  }

  const passThroughRows = [];
  for (const [profileName, fuelPoints] of Object.entries(OIL_TO_FUEL_PRICE_PROFILES)) {
    const foodProfileName = profileName === 'linearConservative'
      ? 'conservativeFoodPassThrough'
      : (profileName === 'policyBuffered' ? 'centralFoodPassThrough' : 'severeFoodPassThrough');
    const foodPoints = FOOD_PASS_THROUGH_PROFILES[foodProfileName];
    for (const shockRow of shockScenarios) {
      const physicalFuelShockPct = shockRow.fuelShockPct;
      const fuelPriceIncreasePct = interpolateFromPoints(fuelPoints, physicalFuelShockPct);
      const fertilizerPriceIncreasePct = clamp(fuelPriceIncreasePct * (profileName === 'tightMarketNonlinear' ? 0.65 : 0.5), 0, 400);
      const foodPriceIncreasePctFromProfile = interpolateFromPoints(foodPoints, physicalFuelShockPct);
      const fertilizerChannelPct = fertilizerPriceIncreasePct * 0.12;
      const foodPriceIncreasePct = profileName === 'linearConservative'
        ? (0.15 * fuelPriceIncreasePct + fertilizerChannelPct)
        : (foodPriceIncreasePctFromProfile + fertilizerChannelPct);
      const dieselPriceMultiplier = 1 + (fuelPriceIncreasePct / 100);
      const fertilizerPriceMultiplier = 1 + (fertilizerPriceIncreasePct / 100);
      const householdFoodPriceMultiplier = 1 + (foodPriceIncreasePct / 100);
      const transportCostMultiplier = 1 + (fuelPriceIncreasePct * 0.72 / 100);
      const lagMonthsToAcutePain = clamp(shockRow.lagMonthsToAcutePain + (profileName === 'tightMarketNonlinear' ? -0.6 : (profileName === 'policyBuffered' ? 0.4 : 0)), 1, 12);

      const trend2027Central = trendProjection.find((r) => r.trendScenario === 'central' && r.year === 2027);
      const calibratedFoodInsecurityEstimateUnderShock = clamp(
        measuredFoodInsecurityAnchor.measuredFoodInsecurityEstimate
        + (shockRow.shockAddedFoodInsecurityRiskExposure * vulnerabilityToMeasuredFoodInsecurityConversionFactor)
        + ((foodPriceIncreasePct / 100) * totalPopulation * 0.10),
        0,
        totalPopulation
      );
      const projectedMeasuredFoodInsecurityShareWithShock2027 = trend2027Central
        ? clamp(trend2027Central.projectedMeasuredFoodInsecurityShareWithoutShock + ((calibratedFoodInsecurityEstimateUnderShock - measuredFoodInsecurityAnchor.measuredFoodInsecurityEstimate) / Math.max(1, totalPopulation)), 0, 0.98)
        : null;
      const addedPeopleVsTrendBaseline = trend2027Central
        ? (projectedMeasuredFoodInsecurityShareWithShock2027 * totalPopulation) - trend2027Central.projectedFoodInsecurePeopleWithoutShock
        : 0;

      const foodInsecurityVulnerabilityPopulation = clamp(
        shockRow.foodInsecurityVulnerabilityPopulation * (1 + (foodPriceIncreasePct / 100) * 0.35),
        0,
        totalPopulation
      );
      const severeFoodStressPopulation = clamp(
        shockRow.severeFoodStressPopulation * (1 + (foodPriceIncreasePct / 100) * 0.40),
        0,
        totalPopulation
      );
      const foodBankPressureIndex = clamp(shockRow.foodBankPressureIndex + (foodPriceIncreasePct / 100) * 0.18, 0, 1);
      const municipalEmergencyPressureIndex = clamp(shockRow.municipalEmergencyPressureIndex + (foodPriceIncreasePct / 100) * 0.12, 0, 1);

      let mainThresholdCrossed = 'none';
      if (projectedMeasuredFoodInsecurityShareWithShock2027 != null) {
        if (projectedMeasuredFoodInsecurityShareWithShock2027 >= 0.40) mainThresholdCrossed = 'food_insecurity_above_40pct';
        else if (projectedMeasuredFoodInsecurityShareWithShock2027 >= 0.35) mainThresholdCrossed = 'food_insecurity_above_35pct';
        else if (projectedMeasuredFoodInsecurityShareWithShock2027 >= 0.30) mainThresholdCrossed = 'food_insecurity_above_30pct';
      }
      passThroughRows.push({
        profile: profileName,
        foodPassThroughProfile: foodProfileName,
        shockScenario: shockRow.scenario,
        physicalFuelShockPct,
        fuelPriceIncreasePct,
        dieselPriceMultiplier,
        fertilizerPriceIncreasePct,
        fertilizerPriceMultiplier,
        foodPriceIncreasePct,
        householdFoodPriceMultiplier,
        transportCostMultiplier,
        calibratedFoodInsecurityEstimateUnderShock,
        addedPeopleVsTrendBaseline,
        projectedMeasuredFoodInsecurityShareWithShock2027,
        foodInsecurityVulnerabilityPopulation,
        severeFoodStressPopulation,
        foodBankPressureIndex,
        municipalEmergencyPressureIndex,
        lagMonthsToAcutePain,
        mainThresholdCrossed
      });
    }
  }

  const thresholdFindingsByProfile = Object.fromEntries(Object.keys(OIL_TO_FUEL_PRICE_PROFILES).map((profileName) => {
    const rows = passThroughRows.filter((r) => r.profile === profileName).sort((a, b) => a.physicalFuelShockPct - b.physicalFuelShockPct);
    const findShock = (fn) => (rows.find(fn)?.shockScenario ?? null);
    return [profileName, {
      firstModerateStressShockLevel: findShock((r) => r.foodBankPressureIndex >= 0.5 || r.municipalEmergencyPressureIndex >= 0.5),
      firstSevereStressShockLevel: findShock((r) => r.foodBankPressureIndex >= 0.7 || r.municipalEmergencyPressureIndex >= 0.7),
      firstFoodBankCrisisShockLevel: findShock((r) => r.foodBankPressureIndex >= 0.7),
      firstMunicipalEmergencyShockLevel: findShock((r) => r.municipalEmergencyPressureIndex >= 0.7),
      firstFoodInsecurityAbove30Pct: findShock((r) => n(r.projectedMeasuredFoodInsecurityShareWithShock2027) >= 0.30),
      firstFoodInsecurityAbove35Pct: findShock((r) => n(r.projectedMeasuredFoodInsecurityShareWithShock2027) >= 0.35),
      firstFoodInsecurityAbove40Pct: findShock((r) => n(r.projectedMeasuredFoodInsecurityShareWithShock2027) >= 0.40)
    }];
  }));

  const isShockNotBaseline = (r) => r.fuelShockPct > 0;
  const firstFoodInsecurityPlus10PctVsBaseline = thresholdAt(shockScenarios, (r) => isShockNotBaseline(r) && r.foodInsecurityVulnerabilityPopulation >= baseline.foodInsecurityVulnerabilityPopulation * 1.10);
  const firstFoodInsecurityPlus25PctVsBaseline = thresholdAt(shockScenarios, (r) => isShockNotBaseline(r) && r.foodInsecurityVulnerabilityPopulation >= baseline.foodInsecurityVulnerabilityPopulation * 1.25);
  const firstFoodInsecurityPlus50PctVsBaseline = thresholdAt(shockScenarios, (r) => isShockNotBaseline(r) && r.foodInsecurityVulnerabilityPopulation >= baseline.foodInsecurityVulnerabilityPopulation * 1.50);
  const firstSevereStressPlus10PctVsBaseline = thresholdAt(shockScenarios, (r) => isShockNotBaseline(r) && r.severeFoodStressPopulation >= baseline.severeFoodStressPopulation * 1.10);
  const firstSevereStressPlus25PctVsBaseline = thresholdAt(shockScenarios, (r) => isShockNotBaseline(r) && r.severeFoodStressPopulation >= baseline.severeFoodStressPopulation * 1.25);
  const firstSevereStressPlus50PctVsBaseline = thresholdAt(shockScenarios, (r) => isShockNotBaseline(r) && r.severeFoodStressPopulation >= baseline.severeFoodStressPopulation * 1.50);

  for (const row of shockScenarios) {
    let mainThresholdCrossed = 'none';
    if (row.fuelShockPct > 0) {
      if (row.municipalEmergencyPressureIndex >= 0.85) mainThresholdCrossed = 'municipal_emergency_pressure_0_85';
      else if (row.foodBankPressureIndex >= 0.85) mainThresholdCrossed = 'foodbank_pressure_0_85';
      else if (row.householdStressIndex >= 0.85) mainThresholdCrossed = 'household_stress_0_85';
      else if (row.severeFoodStressPopulation >= baseline.severeFoodStressPopulation * 1.50) mainThresholdCrossed = 'severe_stress_plus_50pct_vs_baseline';
      else if (row.severeFoodStressPopulation >= baseline.severeFoodStressPopulation * 1.25) mainThresholdCrossed = 'severe_stress_plus_25pct_vs_baseline';
      else if (row.severeFoodStressPopulation >= baseline.severeFoodStressPopulation * 1.10) mainThresholdCrossed = 'severe_stress_plus_10pct_vs_baseline';
      else if (row.foodInsecurityVulnerabilityPopulation >= baseline.foodInsecurityVulnerabilityPopulation * 1.50) mainThresholdCrossed = 'food_insecurity_plus_50pct_vs_baseline';
      else if (row.foodInsecurityVulnerabilityPopulation >= baseline.foodInsecurityVulnerabilityPopulation * 1.25) mainThresholdCrossed = 'food_insecurity_plus_25pct_vs_baseline';
      else if (row.foodInsecurityVulnerabilityPopulation >= baseline.foodInsecurityVulnerabilityPopulation * 1.10) mainThresholdCrossed = 'food_insecurity_plus_10pct_vs_baseline';
    }
    row.mainThresholdCrossed = mainThresholdCrossed;
  }
  const firstModerateStressShockLevel = thresholdAt(shockScenarios, (r) => r.householdStressIndex >= 0.5 || r.foodInsecurityVulnerabilityPopulation >= baseline.foodInsecurityVulnerabilityPopulation * 1.1);
  const firstSevereStressShockLevel = thresholdAt(shockScenarios, (r) => r.householdStressIndex >= 0.7 || r.foodInsecurityVulnerabilityPopulation >= baseline.foodInsecurityVulnerabilityPopulation * 1.25);
  const firstFoodBankCrisisShockLevel = thresholdAt(shockScenarios, (r) => r.foodBankPressureIndex >= 0.7);
  const firstMunicipalEmergencyShockLevel = thresholdAt(shockScenarios, (r) => r.municipalEmergencyPressureIndex >= 0.7);
  const firstLabourMobilizationShockLevel = thresholdAt(shockScenarios, (r) => r.agLabourGapExceedsCurrent);
  const firstFertilizerPlantingSeasonRiskLevel = thresholdAt(shockScenarios, (r) => r.fertilizerPriceMultiplier >= 1.4 || r.lagMonthsToFarmInputImpact >= 6);

  const currentSystemVulnerability = {
    importDependencyIndex,
    longDistanceSupplyChainExposure: 0.82,
    fuelDependentDistributionExposure: 0.84,
    fertilizerDependencyExposure: 0.78,
    centralizedProcessingExposure: 0.73,
    householdAffordabilityExposure: clamp(0.55 + (baseline.householdStressIndex * 0.25), 0, 1)
  };

  const shock20 = shockScenarios.find((s) => s.scenario === 'fuelShock20') ?? baseline;
  const secondaryAdaptationComparison = [
    { adaptation: 'noAdaptation', foodInsecurityVulnerabilityPopulation: shock20.foodInsecurityVulnerabilityPopulation, severeFoodStressPopulation: shock20.severeFoodStressPopulation, householdStressIndex: shock20.householdStressIndex },
    { adaptation: 'emergencyFoodAidOnly', foodInsecurityVulnerabilityPopulation: shock20.foodInsecurityVulnerabilityPopulation * 0.93, severeFoodStressPopulation: shock20.severeFoodStressPopulation * 0.9, householdStressIndex: clamp(shock20.householdStressIndex - 0.04, 0, 1) },
    { adaptation: 'storageAndDistributionStabilization', foodInsecurityVulnerabilityPopulation: shock20.foodInsecurityVulnerabilityPopulation * 0.86, severeFoodStressPopulation: shock20.severeFoodStressPopulation * 0.82, householdStressIndex: clamp(shock20.householdStressIndex - 0.09, 0, 1) },
    { adaptation: 'localResiliencePackage', foodInsecurityVulnerabilityPopulation: shock20.foodInsecurityVulnerabilityPopulation * 0.74, severeFoodStressPopulation: shock20.severeFoodStressPopulation * 0.68, householdStressIndex: clamp(shock20.householdStressIndex - 0.16, 0, 1) }
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    assumptions: {
      currentSystemPrimary: true,
      baseFoodInsecurityShareAssumption: baseFoodInsecurityShare,
      lagModelConfigurableAssumption: true,
      vulnerabilityToMeasuredFoodInsecurityConversionFactor
    },
    hormuzCurrentMultiInputDisruption2026,
    currentDisruptionBands,
    severeSystemicInputLoss33Framing,
    measuredFoodInsecurityAnchor,
    foodInsecurityTrendBaseline,
    foodInsecurityTrendProjection: trendProjection,
    shockOverlayOnTrend,
    lagModel,
    shockScenarios,
    thresholdFindingsByProfile,
    thresholdFindings: {
      baselineFoodStressRiskPopulation: baseline.foodStressRiskPopulation,
      baselineFoodInsecurityVulnerabilityPopulation: baseline.foodInsecurityVulnerabilityPopulation,
      measuredFoodInsecurityBaselineEstimate: measuredFoodInsecurityAnchor.measuredFoodInsecurityEstimate,
      baselineSevereFoodStressPopulation: baseline.severeFoodStressPopulation,
      firstFoodInsecurityPlus10PctVsBaseline,
      firstFoodInsecurityPlus25PctVsBaseline,
      firstFoodInsecurityPlus50PctVsBaseline,
      firstSevereStressPlus10PctVsBaseline,
      firstSevereStressPlus25PctVsBaseline,
      firstSevereStressPlus50PctVsBaseline,
      firstModerateStressShockLevel,
      firstSevereStressShockLevel,
      firstFoodBankCrisisShockLevel,
      firstMunicipalEmergencyShockLevel,
      firstLabourMobilizationShockLevel,
      firstFertilizerPlantingSeasonRiskLevel
    },
    currentSystemVulnerability,
    passThroughProfiles: {
      oilToFuelPrice: OIL_TO_FUEL_PRICE_PROFILES,
      foodPrice: FOOD_PASS_THROUGH_PROFILES,
      currentOutputProfile: 'linearConservative'
    },
    passThroughScenarios: passThroughRows,
    secondaryAdaptationComparison,
    localEmergencyFoodDemandContext: localContext,
    caveats: [
      'This report models the current supply-chain-dependent system and does not assume local resilience already exists.',
      'Current Strait of Hormuz disruption is treated as an active multi-input food-system shock, not only an oil shock.',
      'A one-third global food production loss is not the same as Grey County having one-third less local food. In Grey, the main near-term channel is higher prices, tighter trade, import competition, and household affordability stress.',
      'Not a price forecast.',
      'Not an exact hunger forecast.',
      'Lag timing is scenario-based and configurable.'
    ],
    warnings,
    modelAssessmentReference: {
      presentOverallCredibilityScore: n(assessment.scorecard?.presentOverallCredibilityScore),
      presentFoodSystemScore: n(assessment.scorecard?.presentFoodSystemScore),
      subsistencePotentialPopulation
    }
  };

  const md = [
    '# Grey Current-System Fuel/Input Shock Thresholds',
    '',
    '## Bottom line',
    'This report asks when the current supply-chain-dependent system starts to create serious household and municipal stress under the current Hormuz disruption. It does not assume local resilience already exists.',
    '',
    '## Why this matters',
    'Oil/fuel shocks do not hit households all at once. Effects move through inventories, shipping, refining, contracts, trucking, fertilizer, farm inputs, food distribution, and retail prices over weeks to months.',
    'The current Hormuz disruption is not only an oil shock. It affects upstream food-system inputs including oil/diesel, LNG/natural gas, nitrogen fertilizer, sulfur/phosphate fertilizer, shipping, insurance, and rerouting.',
    '',
    '## Current Hormuz multi-input profile',
    `- scenario: ${hormuzCurrentMultiInputDisruption2026.scenario}`,
    `- oil/diesel constraint: ${hormuzCurrentMultiInputDisruption2026.oilDieselConstraintPct}%`,
    `- LNG/natural gas constraint: ${hormuzCurrentMultiInputDisruption2026.lngNaturalGasConstraintPct}%`,
    `- nitrogen fertilizer constraint: ${hormuzCurrentMultiInputDisruption2026.nitrogenFertilizerConstraintPct}%`,
    `- sulfur/phosphate fertilizer constraint: ${hormuzCurrentMultiInputDisruption2026.sulfurPhosphateConstraintPct}%`,
    `- shipping/insurance/rerouting constraint: ${hormuzCurrentMultiInputDisruption2026.shippingInsuranceReroutingConstraintPct}%`,
    `- input-price multiplier: ${hormuzCurrentMultiInputDisruption2026.inputPriceMultiplier.toFixed(2)}x`,
    `- input-availability multiplier: ${hormuzCurrentMultiInputDisruption2026.inputAvailabilityMultiplier.toFixed(2)}x`,
    `- food-price pressure multiplier: ${hormuzCurrentMultiInputDisruption2026.foodPricePressureMultiplier.toFixed(2)}x`,
    '',
    '## Current disruption scenario bands',
    '| Scenario | Global food-production loss | Local food-availability stress | Food-price pressure index | Fertilizer stress | Fuel stress | Shipping stress | Notes |',
    '|---|---:|---:|---:|---:|---:|---:|---|',
    ...currentDisruptionBands.map((b) => `| ${b.scenario} | ${b.globalFoodProductionLossPct}% | ${b.localFoodAvailabilityStressPct}% | ${b.foodPricePressureIndex.toFixed(2)} | ${b.fertilizerAvailabilityStressPct}% | ${b.fuelAvailabilityStressPct}% | ${b.shippingStressPct}% | ${b.notes} |`),
    '',
    '## Current-system shock table',
    '| Scenario | Fuel shock | Food price pressure | Transport pressure | Food-stress exposure proxy | Severe stress proxy | Added food-insecurity exposure vs baseline | Lag to acute household impact | Main shock threshold crossed |',
    '|---|---:|---:|---:|---:|---:|---:|---|',
    ...shockScenarios.map((s) => `| ${s.scenario} | ${s.fuelShockPct}% | ${s.householdFoodPriceMultiplier.toFixed(2)}x | ${s.householdTransportCostMultiplier.toFixed(2)}x | ${s.foodInsecurityVulnerabilityPopulation.toFixed(0)} | ${s.severeFoodStressPopulation.toFixed(0)} | ${s.addedFoodInsecurityVulnerabilityVsFuelShock0.toFixed(0)} | ${s.lagMonthsToAcutePain.toFixed(1)} months | ${s.mainThresholdCrossed} |`),
    '',
    'Baseline stress is already present before any new fuel/input shock. The shock thresholds below measure additional stress relative to the fuelShock0 baseline.',
    `Measured food insecurity is around one quarter of people in recent Canada/Ontario data (anchor share ${(defaultMeasuredFoodInsecurityShare * 100).toFixed(1)}%).`,
    'The model vulnerability exposure is a broader vulnerability band than measured food insecurity. Use shock deltas for comparison; do not treat the broad vulnerability baseline as measured food insecurity.',
    '',
    '## Threshold findings',
    `- baseline food-stress exposure: ${baseline.foodStressRiskPopulation.toFixed(0)}`,
    `- measured food-insecurity baseline estimate: ${measuredFoodInsecurityAnchor.measuredFoodInsecurityEstimate.toFixed(0)}`,
    `- model vulnerability baseline estimate (broader band): ${baseline.foodInsecurityVulnerabilityPopulation.toFixed(0)}`,
    `- baseline severe stress: ${baseline.severeFoodStressPopulation.toFixed(0)}`,
    `- first +10% food-insecurity exposure threshold vs baseline: ${firstFoodInsecurityPlus10PctVsBaseline}`,
    `- first +25% food-insecurity exposure threshold vs baseline: ${firstFoodInsecurityPlus25PctVsBaseline}`,
    `- first +50% food-insecurity exposure threshold vs baseline: ${firstFoodInsecurityPlus50PctVsBaseline}`,
    `- first +10% severe stress threshold vs baseline: ${firstSevereStressPlus10PctVsBaseline}`,
    `- first +25% severe stress threshold vs baseline: ${firstSevereStressPlus25PctVsBaseline}`,
    `- first +50% severe stress threshold vs baseline: ${firstSevereStressPlus50PctVsBaseline}`,
    `- first moderate stress level: ${firstModerateStressShockLevel}`,
    `- first severe stress level: ${firstSevereStressShockLevel}`,
    `- first food bank pressure level: ${firstFoodBankCrisisShockLevel}`,
    `- first municipal pressure level: ${firstMunicipalEmergencyShockLevel}`,
    `- first farm input/planting risk level: ${firstFertilizerPlantingSeasonRiskLevel}`,
    '',
    '## Nonlinear price pass-through sensitivity',
    'Physical supply decline and retail price impact are not the same. In tight markets, small physical shortages can produce large price increases. This report compares conservative, policy-buffered, and tight-market nonlinear pass-through assumptions.',
    '| Profile | 5% physical shock fuel price | 5% food price | 20% fuel price | 20% food price | 2027 calibrated food insecurity under shock20 | Main threshold |',
    '|---|---:|---:|---:|---:|---:|---|',
    ...Object.keys(OIL_TO_FUEL_PRICE_PROFILES).map((profile) => {
      const s5 = passThroughRows.find((r) => r.profile === profile && r.shockScenario === 'fuelShock5');
      const s20 = passThroughRows.find((r) => r.profile === profile && r.shockScenario === 'fuelShock20');
      const t = thresholdFindingsByProfile[profile];
      return `| ${profile} | ${n(s5?.fuelPriceIncreasePct).toFixed(1)}% | ${n(s5?.foodPriceIncreasePct).toFixed(1)}% | ${n(s20?.fuelPriceIncreasePct).toFixed(1)}% | ${n(s20?.foodPriceIncreasePct).toFixed(1)}% | ${(n(s20?.projectedMeasuredFoodInsecurityShareWithShock2027) * 100).toFixed(1)}% | ${t.firstSevereStressShockLevel ?? t.firstFoodInsecurityAbove35Pct ?? 'none'} |`;
    }),
    '',
    '## Existing food-insecurity trend before new shock',
    'Food insecurity was already rising before any new fuel/input disruption. This report separates baseline trend from shock-added stress.',
    '| Year | Conservative | Central | Severe | Notes |',
    '|---|---:|---:|---:|---|',
    ...TREND_YEARS.map((year) => {
      const c = trendProjection.find((r) => r.year === year && r.trendScenario === 'conservative');
      const m = trendProjection.find((r) => r.year === year && r.trendScenario === 'central');
      const s = trendProjection.find((r) => r.year === year && r.trendScenario === 'severe');
      return `| ${year} | ${(n(c?.projectedMeasuredFoodInsecurityShareWithoutShock) * 100).toFixed(1)}% | ${(n(m?.projectedMeasuredFoodInsecurityShareWithoutShock) * 100).toFixed(1)}% | ${(n(s?.projectedMeasuredFoodInsecurityShareWithoutShock) * 100).toFixed(1)}% | trend scenario, not forecast |`;
    }),
    '',
    '## Shock on top of trend',
    '| Scenario | Year | Trend-only estimate | With shock | Added people | Acceleration equivalent |',
    '|---|---:|---:|---:|---:|---:|',
    ...shockOverlayOnTrend
      .filter((r) => r.trendScenario === 'central' && ['fuelShock0', 'fuelShock20', 'fuelShock30', 'fuelShock40'].includes(r.fuelShockScenario))
      .map((r) => `| ${r.fuelShockScenario} | ${r.year} | ${(r.projectedMeasuredFoodInsecurityShareWithoutShock * 100).toFixed(1)}% | ${(r.projectedMeasuredFoodInsecurityShareWithShock * 100).toFixed(1)}% | ${r.addedPeopleVsTrendBaseline.toFixed(0)} | ${r.yearsOfTrendAccelerationEquivalent.toFixed(1)} |`),
    '',
    '## Local emergency food demand context',
    ...(localContext.localSoupKitchenMealsPerDay != null
      ? [
        `Local emergency food demand baseline includes a reported soup kitchen load of about ${localContext.localSoupKitchenMealsPerDay} meals/day.`,
        'A reported soup kitchen load above 1,000 meals/day should be treated as a local warning signal and validated with local service providers before being used as a calibration input.'
      ]
      : ['Local food bank/soup kitchen service data is not yet loaded.']),
    '',
    '## Lag timeline',
    `- Month 0-1: immediate market price signal (${lagModel.immediateMarketPriceSignalMonths})`,
    `- Month 1-3: fuel retail pass-through (${lagModel.fuelRetailPassThroughMonths})`,
    `- Month 3-6: food distribution pass-through (${lagModel.foodDistributionPassThroughMonths})`,
    `- Month 6-12: fertilizer/input and municipal budget pressure (${lagModel.fertilizerFarmInputPassThroughMonths}; ${lagModel.municipalBudgetServiceImpactMonths})`,
    `- Next growing season: planting/harvest effects (${lagModel.plantingHarvestImpact})`,
    '',
    '## What this does and does not show',
    'Does show:',
    '- vulnerability thresholds in the current system',
    '- lagged household/municipal impacts',
    '- when adaptation becomes urgent',
    'Does not show:',
    '- exact price forecasts',
    '- exact hunger forecasts',
    '- guaranteed timing',
    '- official emergency projections',
    '',
    '## Why local resilience comes after this',
    'Local resilience is the response. First we need to identify when and where the current system becomes stressed.',
    '',
    '## Secondary adaptation comparison',
    '| Adaptation | Shock20 vulnerability exposure | Shock20 severe stress | Shock20 household stress index |',
    '|---|---:|---:|---:|',
    ...secondaryAdaptationComparison.map((r) => `| ${r.adaptation} | ${r.foodInsecurityVulnerabilityPopulation.toFixed(0)} | ${r.severeFoodStressPopulation.toFixed(0)} | ${r.householdStressIndex.toFixed(3)} |`)
  ].join('\n');

  const scenariosCsvRows = shockScenarios.map((s) => ({
    scenario: s.scenario,
    fuelShockPct: s.fuelShockPct,
    fuelAvailabilityIndex: s.fuelAvailabilityIndex,
    dieselPriceMultiplier: s.dieselPriceMultiplier,
    fertilizerPriceMultiplier: s.fertilizerPriceMultiplier,
    transportCostMultiplier: s.transportCostMultiplier,
    foodImportCostMultiplier: s.foodImportCostMultiplier,
    householdFoodPriceMultiplier: s.householdFoodPriceMultiplier,
    householdTransportCostMultiplier: s.householdTransportCostMultiplier,
    foodStressRiskPopulation: s.foodStressRiskPopulation,
    baselineFoodStressRiskPopulation: s.baselineFoodStressRiskPopulation,
    addedFoodStressRiskPopulationVsFuelShock0: s.addedFoodStressRiskPopulationVsFuelShock0,
    foodInsecurityVulnerabilityPopulation: s.foodInsecurityVulnerabilityPopulation,
    baselineFoodInsecurityVulnerabilityPopulation: s.baselineFoodInsecurityVulnerabilityPopulation,
    addedFoodInsecurityVulnerabilityVsFuelShock0: s.addedFoodInsecurityVulnerabilityVsFuelShock0,
    measuredFoodInsecurityBaselineEstimate: s.measuredFoodInsecurityBaselineEstimate,
    modelVulnerabilityBaselineEstimate: s.modelVulnerabilityBaselineEstimate,
    shockAddedFoodInsecurityRiskExposure: s.shockAddedFoodInsecurityRiskExposure,
    shockAddedSevereFoodStressRisk: s.shockAddedSevereFoodStressRisk,
    calibratedFoodInsecurityEstimateUnderShock: s.calibratedFoodInsecurityEstimateUnderShock,
    severeFoodStressPopulation: s.severeFoodStressPopulation,
    baselineSevereFoodStressPopulation: s.baselineSevereFoodStressPopulation,
    addedSevereFoodStressVsFuelShock0: s.addedSevereFoodStressVsFuelShock0,
    householdStressIndex: s.householdStressIndex,
    foodBankPressureIndex: s.foodBankPressureIndex,
    municipalEmergencyPressureIndex: s.municipalEmergencyPressureIndex,
    mainThresholdCrossed: s.mainThresholdCrossed,
    lagMonthsToHouseholdImpact: s.lagMonthsToHouseholdImpact,
    notes: s.notes
  }));

  const householdsCsvRows = shockScenarios.map((s) => ({
    scenario: s.scenario,
    foodStressRiskPopulation: s.foodStressRiskPopulation,
    baselineFoodStressRiskPopulation: s.baselineFoodStressRiskPopulation,
    addedFoodStressRiskPopulationVsFuelShock0: s.addedFoodStressRiskPopulationVsFuelShock0,
    foodInsecurityVulnerabilityPopulation: s.foodInsecurityVulnerabilityPopulation,
    baselineFoodInsecurityVulnerabilityPopulation: s.baselineFoodInsecurityVulnerabilityPopulation,
    addedFoodInsecurityVulnerabilityVsFuelShock0: s.addedFoodInsecurityVulnerabilityVsFuelShock0,
    measuredFoodInsecurityBaselineEstimate: s.measuredFoodInsecurityBaselineEstimate,
    modelVulnerabilityBaselineEstimate: s.modelVulnerabilityBaselineEstimate,
    shockAddedFoodInsecurityRiskExposure: s.shockAddedFoodInsecurityRiskExposure,
    shockAddedSevereFoodStressRisk: s.shockAddedSevereFoodStressRisk,
    calibratedFoodInsecurityEstimateUnderShock: s.calibratedFoodInsecurityEstimateUnderShock,
    severeFoodStressPopulation: s.severeFoodStressPopulation,
    baselineSevereFoodStressPopulation: s.baselineSevereFoodStressPopulation,
    addedSevereFoodStressVsFuelShock0: s.addedSevereFoodStressVsFuelShock0,
    additionalFoodAidNeedGJ: s.additionalFoodAidNeedGJ,
    additionalFoodAidNeedMealsEquivalent: s.additionalFoodAidNeedMealsEquivalent,
    foodBankPressureIndex: s.foodBankPressureIndex,
    municipalEmergencyPressureIndex: s.municipalEmergencyPressureIndex,
    lagMonthsToAcutePain: s.lagMonthsToAcutePain,
    caveat: 'Risk exposure proxy, not a forecasted hunger count.'
  }));

  const paths = {
    markdownPath: path.join(produceDir, 'grey-current-system-shock-threshold.md'),
    jsonPath: path.join(produceDir, 'grey-current-system-shock-threshold.json'),
    scenariosCsvPath: path.join(produceDir, 'grey-current-system-shock-threshold-scenarios.csv'),
    householdsCsvPath: path.join(produceDir, 'grey-current-system-shock-threshold-households.csv'),
    trendCsvPath: path.join(produceDir, 'grey-current-system-shock-threshold-trend.csv'),
    passThroughCsvPath: path.join(produceDir, 'grey-current-system-shock-threshold-pass-through.csv')
  };

  fs.writeFileSync(paths.markdownPath, md);
  fs.writeFileSync(paths.jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(paths.scenariosCsvPath, toCsv(scenariosCsvRows, [
    'scenario', 'fuelShockPct', 'fuelAvailabilityIndex', 'dieselPriceMultiplier', 'fertilizerPriceMultiplier',
    'transportCostMultiplier', 'foodImportCostMultiplier', 'householdFoodPriceMultiplier',
    'householdTransportCostMultiplier', 'foodStressRiskPopulation', 'baselineFoodStressRiskPopulation',
    'addedFoodStressRiskPopulationVsFuelShock0', 'foodInsecurityVulnerabilityPopulation', 'baselineFoodInsecurityVulnerabilityPopulation',
    'addedFoodInsecurityVulnerabilityVsFuelShock0', 'measuredFoodInsecurityBaselineEstimate', 'modelVulnerabilityBaselineEstimate',
    'shockAddedFoodInsecurityRiskExposure', 'shockAddedSevereFoodStressRisk', 'calibratedFoodInsecurityEstimateUnderShock',
    'severeFoodStressPopulation', 'baselineSevereFoodStressPopulation',
    'addedSevereFoodStressVsFuelShock0', 'householdStressIndex', 'foodBankPressureIndex',
    'municipalEmergencyPressureIndex', 'mainThresholdCrossed', 'lagMonthsToHouseholdImpact', 'notes'
  ]));
  fs.writeFileSync(paths.householdsCsvPath, toCsv(householdsCsvRows, [
    'scenario', 'foodStressRiskPopulation', 'baselineFoodStressRiskPopulation', 'addedFoodStressRiskPopulationVsFuelShock0',
    'foodInsecurityVulnerabilityPopulation', 'baselineFoodInsecurityVulnerabilityPopulation', 'addedFoodInsecurityVulnerabilityVsFuelShock0',
    'measuredFoodInsecurityBaselineEstimate', 'modelVulnerabilityBaselineEstimate', 'shockAddedFoodInsecurityRiskExposure',
    'shockAddedSevereFoodStressRisk', 'calibratedFoodInsecurityEstimateUnderShock', 'severeFoodStressPopulation',
    'baselineSevereFoodStressPopulation', 'addedSevereFoodStressVsFuelShock0',
    'additionalFoodAidNeedGJ', 'additionalFoodAidNeedMealsEquivalent', 'foodBankPressureIndex',
    'municipalEmergencyPressureIndex', 'lagMonthsToAcutePain', 'caveat'
  ]));
  fs.writeFileSync(paths.trendCsvPath, toCsv(shockOverlayOnTrend, [
    'trendScenario', 'year', 'projectedMeasuredFoodInsecurityShareWithoutShock',
    'projectedFoodInsecurePeopleWithoutShock', 'fuelShockScenario', 'shockAddedMeasuredFoodInsecurityShare',
    'projectedMeasuredFoodInsecurityShareWithShock', 'projectedFoodInsecurePeopleWithShock',
    'addedPeopleVsTrendBaseline', 'yearsOfTrendAccelerationEquivalent', 'caveat'
  ]));
  fs.writeFileSync(paths.passThroughCsvPath, toCsv(passThroughRows, [
    'profile', 'shockScenario', 'physicalFuelShockPct', 'fuelPriceIncreasePct', 'fertilizerPriceIncreasePct',
    'foodPriceIncreasePct', 'calibratedFoodInsecurityEstimateUnderShock', 'addedPeopleVsTrendBaseline',
    'severeFoodStressPopulation', 'foodBankPressureIndex', 'municipalEmergencyPressureIndex',
    'lagMonthsToAcutePain', 'mainThresholdCrossed'
  ]));

  return { report, paths };
}
