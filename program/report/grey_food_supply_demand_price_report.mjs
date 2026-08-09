// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import {buildGreyCanonicalCarryingCapacityContext} from './grey_carrying_capacity_context.mjs';

function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
const PERSON_FOOD_GJ_PER_YEAR = 900000 * 4184 / 1e9; // 3.7656
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

const PRICE_RESPONSE_PROFILES = {
  conservativePriceResponse: { passThroughScale: 0.75, scarcityScale: 0.8 },
  centralPriceResponse: { passThroughScale: 1.0, scarcityScale: 1.0 },
  tightMarketPriceResponse: { passThroughScale: 1.35, scarcityScale: 1.25 }
};

const HOUSEHOLD_PRODUCTION_SCENARIOS = [
  { scenario: 'noHouseholdProduction', mobilizationShare: 0, surplusShare: 0, storageLossReductionShare: 0.00, confidence: 'high' },
  { scenario: 'gardenContribution', mobilizationShare: 0.10, surplusShare: 0.05, storageLossReductionShare: 0.04, confidence: 'moderate' },
  { scenario: 'subsistenceMobilization10Pct', mobilizationShare: 0.10, surplusShare: 0.10, storageLossReductionShare: 0.05, confidence: 'low_to_moderate' },
  { scenario: 'subsistenceMobilization25Pct', mobilizationShare: 0.25, surplusShare: 0.18, storageLossReductionShare: 0.08, confidence: 'low_to_moderate' },
  { scenario: 'subsistenceMobilization50Pct', mobilizationShare: 0.50, surplusShare: 0.30, storageLossReductionShare: 0.12, confidence: 'low' },
  { scenario: 'smallholdingSurplusPush', mobilizationShare: 0.30, surplusShare: 0.42, storageLossReductionShare: 0.14, confidence: 'low' },
  { scenario: 'fullLandAccessMobilization', mobilizationShare: 0.70, surplusShare: 0.55, storageLossReductionShare: 0.20, confidence: 'low' }
];

const SCENARIO_MATRIX = [
  { scenario: 'currentSystemBaseline', shockProfile: 'fuelShock0', householdProductionScenario: 'noHouseholdProduction' },
  { scenario: 'shock20NoAdaptation', shockProfile: 'fuelShock20', householdProductionScenario: 'noHouseholdProduction' },
  { scenario: 'shock20GardenContribution', shockProfile: 'fuelShock20', householdProductionScenario: 'gardenContribution' },
  { scenario: 'shock20SubsistenceMobilization25Pct', shockProfile: 'fuelShock20', householdProductionScenario: 'subsistenceMobilization25Pct' },
  { scenario: 'shock20SmallholdingSurplusPush', shockProfile: 'fuelShock20', householdProductionScenario: 'smallholdingSurplusPush' },
  { scenario: 'shock20StorageAndLocalSupply', shockProfile: 'fuelShock20', householdProductionScenario: 'subsistenceMobilization50Pct' },
  { scenario: 'shock20CombinedLocalResponse', shockProfile: 'fuelShock20', householdProductionScenario: 'fullLandAccessMobilization' },
  { scenario: 'shock40NoAdaptation', shockProfile: 'fuelShock40', householdProductionScenario: 'noHouseholdProduction' },
  { scenario: 'shock40CombinedLocalResponse', shockProfile: 'fuelShock40', householdProductionScenario: 'fullLandAccessMobilization' },
  {
    scenario: 'severeSystemicInputLoss33NoAdaptation',
    shockProfile: 'fuelShock33',
    householdProductionScenario: 'noHouseholdProduction',
    globalFoodProductionLossShare: 0.33,
    localFoodAvailabilityLossShare: 0.12,
    importPricePressureMultiplier: 1.55,
    localProductionShockShare: 0.08,
    tradeCompetitionIndex: 0.85,
    householdAffordabilityTransmissionShare: 0.72,
    poorCountryDisproportionateImpactNote: 'Global shock harms poorer countries and lower-income households first and hardest.',
    sourceStatus: 'severe global scenario assumption, not forecast',
    interpretation: 'global price/availability shock, not direct local crop failure'
  },
  {
    scenario: 'severeSystemicInputLoss33CombinedResponse',
    shockProfile: 'fuelShock33',
    householdProductionScenario: 'fullLandAccessMobilization',
    globalFoodProductionLossShare: 0.33,
    localFoodAvailabilityLossShare: 0.12,
    importPricePressureMultiplier: 1.55,
    localProductionShockShare: 0.08,
    tradeCompetitionIndex: 0.85,
    householdAffordabilityTransmissionShare: 0.72,
    poorCountryDisproportionateImpactNote: 'Global shock harms poorer countries and lower-income households first and hardest.',
    sourceStatus: 'severe global scenario assumption, not forecast',
    interpretation: 'global price/availability shock, not direct local crop failure'
  },
  { scenario: 'trend2027NoNewShockNoLocalResponse', shockProfile: 'fuelShock0', householdProductionScenario: 'noHouseholdProduction', baselineTrendYear: 2027, trendOnly: true },
  { scenario: 'trend2027NoNewShockGardenContribution', shockProfile: 'fuelShock0', householdProductionScenario: 'gardenContribution', baselineTrendYear: 2027, trendOnly: true },
  { scenario: 'trend2027NoNewShockSubsistenceMobilization25Pct', shockProfile: 'fuelShock0', householdProductionScenario: 'subsistenceMobilization25Pct', baselineTrendYear: 2027, trendOnly: true },
  { scenario: 'trend2027NoNewShockCombinedLocalResponse', shockProfile: 'fuelShock0', householdProductionScenario: 'fullLandAccessMobilization', baselineTrendYear: 2027, trendOnly: true }
];

function trendBaselineShareForYear(currentShock, year) {
  const projection = currentShock.foodInsecurityTrendProjection ?? {};
  const centralRows = Array.isArray(projection.central) ? projection.central : [];
  const byYear = centralRows.find((r) => n(r.year) === n(year));
  if (byYear) {
    const share = n(byYear.projectedMeasuredFoodInsecurityShareWithoutShock, NaN);
    if (Number.isFinite(share) && share > 0) return share;
  }
  return year >= 2027 ? 0.30 : 0.25;
}

export function buildGreyFoodSupplyDemandPriceReport(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  fs.mkdirSync(produceDir, { recursive: true });
  const warnings = [];

  const foodCalibration = readJsonIfExists(path.join(produceDir, 'grey-food-calibration.json'), warnings, 'food calibration', {});
  const currentShock = readJsonIfExists(path.join(produceDir, 'grey-current-system-shock-threshold.json'), warnings, 'current shock threshold', {});
  const foodGapReplacement = readJsonIfExists(path.join(produceDir, 'grey-food-gap-replacement.json'), warnings, 'food gap replacement', {});
  const dwelling = readJsonIfExists(path.join(produceDir, 'grey-dwelling-land-access.json'), warnings, 'dwelling land access', {});
  const agLabour = readJsonIfExists(path.join(produceDir, 'grey-ag-labour-baseline.json'), warnings, 'ag labour', {});
  const localization = readJsonIfExists(path.join(produceDir, 'grey-localization-access.json'), warnings, 'localization access', {});
  const transition = readJsonIfExists(path.join(produceDir, 'grey-transition-pathways.json'), warnings, 'transition pathways', {});

  const population = n(foodCalibration.population2021, n(dwelling.totalPopulation, 100905));
  const totalFoodDemandGJ = n(foodCalibration.totalFoodDemandGJ, n(foodCalibration.foodDemandBaseline?.totalFoodDemandGJ, 379967.87));
  const currentAgIndustryFTEEstimate = n(agLabour.currentAgIndustryFTEEstimate, 3918.43);
  const measuredFoodInsecurityShare = n(currentShock.measuredFoodInsecurityAnchor?.defaultMeasuredFoodInsecurityShare, 0.25);
  const measuredFoodInsecurityBaselineEstimate = population * measuredFoodInsecurityShare;
  const baselineTrendFoodInsecurityShare2027 = trendBaselineShareForYear(currentShock, 2027);
  const baselineTrendFoodInsecurityEstimate2027 = population * baselineTrendFoodInsecurityShare2027;
  const subsistencePopulation = n(dwelling.estimatedPopulationWithSubsistencePotential, 54949);
  const noDirectLandAccessPopulation = n(dwelling.estimatedPopulationNoDirectLandAccess, 7990);
  const totalDwellings = n(dwelling.totalDwellings, n((dwelling.thresholdSensitivity ?? []).find((x) => x.thresholdScenario === 'baseline')?.populationAtOrAboveSubsistence, 50183));
  const dwellingsSubsistence = n((dwelling.thresholdSensitivity ?? []).find((x) => x.thresholdScenario === 'baseline')?.dwellingsAtOrAboveSubsistence, 28310.66);
  const localNodeCount = n((localization.candidateNodes ?? []).length, 0);
  const modalityDefs = Array.isArray(foodGapReplacement.productionModalities) ? foodGapReplacement.productionModalities : [];
  const mixedResilienceModality = modalityDefs.find((m) => (m.modality ?? m.id) === 'mixedResiliencePackage') ?? {};
  const blendedGJPerWorkerYear = n(mixedResilienceModality.foodEnergyGJPerWorkerAtMaturity, 21.25);

  const shockRows = currentShock.shockScenarios ?? [];
  function shockByName(name) {
    if (name === 'fuelShock33') {
      const s30 = shockRows.find((x) => x.scenario === 'fuelShock30') ?? {};
      const s40 = shockRows.find((x) => x.scenario === 'fuelShock40') ?? {};
      return {
        scenario: 'fuelShock33',
        fuelShockPct: 33,
        fuelAvailabilityIndex: 0.67,
        householdFoodPriceMultiplier: (n(s30.householdFoodPriceMultiplier, 1) + n(s40.householdFoodPriceMultiplier, 1)) / 2,
        householdTransportCostMultiplier: (n(s30.householdTransportCostMultiplier, 1) + n(s40.householdTransportCostMultiplier, 1)) / 2,
        foodCoverage: (n(s30.foodCoverage, 0.3) + n(s40.foodCoverage, 0.28)) / 2,
        lagMonthsToAcutePain: (n(s30.lagMonthsToAcutePain, 4) + n(s40.lagMonthsToAcutePain, 5)) / 2,
        foodInsecurityVulnerabilityPopulation: (n(s30.foodInsecurityVulnerabilityPopulation, 0) + n(s40.foodInsecurityVulnerabilityPopulation, 0)) / 2
      };
    }
    return shockRows.find((x) => x.scenario === name) ?? { scenario: name, fuelShockPct: 0, fuelAvailabilityIndex: 1, householdFoodPriceMultiplier: 1, householdTransportCostMultiplier: 1, foodCoverage: 0.472, lagMonthsToAcutePain: 2, foodInsecurityVulnerabilityPopulation: measuredFoodInsecurityBaselineEstimate };
  }

  const demandSegments = [
    {
      demandSegment: 'noDirectLandAccessHouseholds',
      population: noDirectLandAccessPopulation,
      dwellings: Math.max(1, noDirectLandAccessPopulation / 2.05),
      marketDemandShare: 0.98,
      selfProvisionPotentialShare: 0.02,
      surplusProductionPotentialShare: 0,
      vulnerabilityIndex: 0.92,
      confidence: 'moderate'
    },
    {
      demandSegment: 'gardenAccessHouseholds',
      population: Math.max(0, subsistencePopulation * 0.45),
      dwellings: Math.max(1, dwellingsSubsistence * 0.5),
      marketDemandShare: 0.84,
      selfProvisionPotentialShare: 0.16,
      surplusProductionPotentialShare: 0.03,
      vulnerabilityIndex: 0.58,
      confidence: 'low_to_moderate'
    },
    {
      demandSegment: 'subsistencePotentialHouseholds',
      population: subsistencePopulation,
      dwellings: Math.max(1, dwellingsSubsistence),
      marketDemandShare: 0.68,
      selfProvisionPotentialShare: 0.32,
      surplusProductionPotentialShare: 0.10,
      vulnerabilityIndex: 0.44,
      confidence: 'low_to_moderate'
    },
    {
      demandSegment: 'smallholdingPotentialHouseholds',
      population: Math.max(0, subsistencePopulation * 0.35),
      dwellings: Math.max(1, dwellingsSubsistence * 0.35),
      marketDemandShare: 0.55,
      selfProvisionPotentialShare: 0.45,
      surplusProductionPotentialShare: 0.20,
      vulnerabilityIndex: 0.34,
      confidence: 'low'
    },
    {
      demandSegment: 'marketDependentUrbanSettlementHouseholds',
      population: Math.max(0, population - subsistencePopulation),
      dwellings: Math.max(1, totalDwellings - dwellingsSubsistence),
      marketDemandShare: 0.95,
      selfProvisionPotentialShare: 0.05,
      surplusProductionPotentialShare: 0.01,
      vulnerabilityIndex: 0.73,
      confidence: 'moderate'
    },
    {
      demandSegment: 'ruralMarketDependentHouseholds',
      population: Math.max(0, subsistencePopulation * 0.30),
      dwellings: Math.max(1, dwellingsSubsistence * 0.30),
      marketDemandShare: 0.80,
      selfProvisionPotentialShare: 0.20,
      surplusProductionPotentialShare: 0.05,
      vulnerabilityIndex: 0.60,
      confidence: 'low_to_moderate'
    },
    {
      demandSegment: 'commercialInstitutionalDemand',
      population: Math.max(0, population * 0.08),
      dwellings: 0,
      marketDemandShare: 1.0,
      selfProvisionPotentialShare: 0,
      surplusProductionPotentialShare: 0,
      vulnerabilityIndex: 0.67,
      confidence: 'low'
    }
  ].map((seg) => ({
    ...seg,
    baselineFoodDemandGJ: (seg.population / Math.max(1, population)) * totalFoodDemandGJ
  }));

  const baseLocalCommercialSupply = totalFoodDemandGJ * n((foodCalibration.plausibilityScenarios ?? []).find((s) => s.scenario === 'localizedPresentTechBaseline')?.foodCoverage, 0.472);
  const baseExternalSupply = Math.max(0, totalFoodDemandGJ - baseLocalCommercialSupply);

  const supplyCategories = [
    { supplyCategory: 'externalImportedFoodSupply', grossSupplyGJ: baseExternalSupply, effectiveSupplyGJ: baseExternalSupply, marketAvailabilityShare: 0.95, priceExposureIndex: 0.95, inputDependencyIndex: 0.90, labourRequirementFTE: 0, timeToScaleYears: 0, confidence: 'moderate' },
    { supplyCategory: 'currentLocalCommercialFoodSupply', grossSupplyGJ: baseLocalCommercialSupply, effectiveSupplyGJ: baseLocalCommercialSupply * 0.88, marketAvailabilityShare: 0.85, priceExposureIndex: 0.62, inputDependencyIndex: 0.63, labourRequirementFTE: currentAgIndustryFTEEstimate, timeToScaleYears: 1, confidence: 'moderate' },
    { supplyCategory: 'householdSelfProvisioning', grossSupplyGJ: 0, effectiveSupplyGJ: 0, marketAvailabilityShare: 0, priceExposureIndex: 0.18, inputDependencyIndex: 0.28, labourRequirementFTE: 0, timeToScaleYears: 1, confidence: 'low_to_moderate' },
    { supplyCategory: 'householdSurplusProduction', grossSupplyGJ: 0, effectiveSupplyGJ: 0, marketAvailabilityShare: 0.72, priceExposureIndex: 0.30, inputDependencyIndex: 0.34, labourRequirementFTE: 0, timeToScaleYears: 2, confidence: 'low' },
    { supplyCategory: 'marketGardenProduction', grossSupplyGJ: 0, effectiveSupplyGJ: 0, marketAvailabilityShare: 0.85, priceExposureIndex: 0.45, inputDependencyIndex: 0.45, labourRequirementFTE: 0, timeToScaleYears: 1, confidence: 'moderate' },
    { supplyCategory: 'lowInputAnnualProduction', grossSupplyGJ: 0, effectiveSupplyGJ: 0, marketAvailabilityShare: 0.88, priceExposureIndex: 0.40, inputDependencyIndex: 0.35, labourRequirementFTE: 0, timeToScaleYears: 2, confidence: 'low_to_moderate' },
    { supplyCategory: 'perennialStapleProduction', grossSupplyGJ: 0, effectiveSupplyGJ: 0, marketAvailabilityShare: 0.82, priceExposureIndex: 0.28, inputDependencyIndex: 0.18, labourRequirementFTE: 0, timeToScaleYears: 5, confidence: 'low' },
    { supplyCategory: 'greenhouseSeasonExtensionProduction', grossSupplyGJ: 0, effectiveSupplyGJ: 0, marketAvailabilityShare: 0.75, priceExposureIndex: 0.55, inputDependencyIndex: 0.70, labourRequirementFTE: 0, timeToScaleYears: 1, confidence: 'low_to_moderate' },
    { supplyCategory: 'storageLossReductionEffectiveSupply', grossSupplyGJ: 0, effectiveSupplyGJ: 0, marketAvailabilityShare: 1, priceExposureIndex: 0.20, inputDependencyIndex: 0.20, labourRequirementFTE: 0, timeToScaleYears: 1, confidence: 'moderate' },
    { supplyCategory: 'emergencyFoodAidSupply', grossSupplyGJ: 0, effectiveSupplyGJ: 0, marketAvailabilityShare: 1, priceExposureIndex: 0.35, inputDependencyIndex: 0.55, labourRequirementFTE: 0, timeToScaleYears: 0.25, confidence: 'low_to_moderate' }
  ];

  const householdProductionScenarios = HOUSEHOLD_PRODUCTION_SCENARIOS.map((h) => {
    const householdsParticipating = dwellingsSubsistence * h.mobilizationShare;
    const workersOrHouseholdLabourNeeded = householdsParticipating * 0.35;
    const reducedMarketDemandGJ = totalFoodDemandGJ * (0.20 * h.mobilizationShare);
    const addedLocalSupplyGJ = totalFoodDemandGJ * (0.12 * h.mobilizationShare + 0.08 * h.surplusShare);
    const remainingMarketDemandGJ = Math.max(0, totalFoodDemandGJ - reducedMarketDemandGJ);
    return {
      ...h,
      reducedMarketDemandGJ,
      addedLocalSupplyGJ,
      remainingMarketDemandGJ,
      householdsParticipating,
      workersOrHouseholdLabourNeeded
    };
  });

  const scenarioResults = [];
  const householdRows = [];

  for (const row of SCENARIO_MATRIX) {
    const shock = shockByName(row.shockProfile);
    const hp = householdProductionScenarios.find((x) => x.scenario === row.householdProductionScenario) ?? householdProductionScenarios[0];

    const localSupplyBase = baseLocalCommercialSupply * clamp(shock.fuelAvailabilityIndex + 0.12, 0.35, 1.1);
    const externalSupplyGJ = baseExternalSupply * clamp(shock.fuelAvailabilityIndex * 0.92, 0.2, 1);
    const storageLossReductionEffectiveSupply = totalFoodDemandGJ * hp.storageLossReductionShare * 0.45;
    const localSupplyGJ = localSupplyBase + hp.addedLocalSupplyGJ;
    const marketDemandGJ = hp.remainingMarketDemandGJ;
    const effectiveSupplyGJ = localSupplyGJ + externalSupplyGJ + storageLossReductionEffectiveSupply;
    const supplyDemandGapGJ = effectiveSupplyGJ - marketDemandGJ;
    const supplyDemandRatio = marketDemandGJ > 0 ? effectiveSupplyGJ / marketDemandGJ : 1;
    const localSupplyShare = effectiveSupplyGJ > 0 ? localSupplyGJ / effectiveSupplyGJ : 0;
    const exposedDemandShare = clamp(marketDemandGJ / Math.max(1, totalFoodDemandGJ), 0, 1.2);
    const importDependencyShare = effectiveSupplyGJ > 0 ? externalSupplyGJ / effectiveSupplyGJ : 0;

    const basePassThrough = (shock.householdFoodPriceMultiplier - 1) + 0.55 * (shock.householdTransportCostMultiplier - 1);
    const scarcity = Math.max(0, 1 - supplyDemandRatio);

    const profileResults = {};
    for (const [profileName, profile] of Object.entries(PRICE_RESPONSE_PROFILES)) {
      const pressure = clamp((basePassThrough * profile.passThroughScale) + (scarcity * 1.8 * profile.scarcityScale) - (hp.reducedMarketDemandGJ / Math.max(1, totalFoodDemandGJ)) * 0.35 - (hp.addedLocalSupplyGJ / Math.max(1, totalFoodDemandGJ)) * 0.25, 0, 2.5);
      const foodPriceMultiplierEstimate = 1 + pressure;
      const affordabilityStressIndex = clamp(0.32 + pressure * 0.55, 0, 1);
      const calibratedFoodInsecurityEstimate = clamp(
        measuredFoodInsecurityBaselineEstimate
          + (pressure * population * 0.055)
          + (shock.fuelShockPct / 100) * population * 0.04
          - (hp.reducedMarketDemandGJ / Math.max(1, totalFoodDemandGJ)) * population * 0.08
          - (hp.addedLocalSupplyGJ / Math.max(1, totalFoodDemandGJ)) * population * 0.06,
        measuredFoodInsecurityBaselineEstimate * 0.9,
        population * 0.9
      );
      profileResults[profileName] = { foodPricePressureIndex: pressure, foodPriceMultiplierEstimate, affordabilityStressIndex, calibratedFoodInsecurityEstimate };
    }

    const central = profileResults.centralPriceResponse;
    const baselineComp = scenarioResults.find((x) => x.shockProfile === row.shockProfile && x.householdProductionScenario === 'noHouseholdProduction' && !x.trendOnly);
    const foodInsecurityAvoidedVsNoAdaptation = baselineComp ? Math.max(0, baselineComp.calibratedFoodInsecurityEstimate - central.calibratedFoodInsecurityEstimate) : 0;
    const severeFoodStressAvoidedVsNoAdaptation = foodInsecurityAvoidedVsNoAdaptation * 0.35;
    const trendOnly = row.trendOnly === true;
    const baselineTrendYear = n(row.baselineTrendYear, 2027);
    const baselineTrendFoodInsecurityEstimate = population * trendBaselineShareForYear(currentShock, baselineTrendYear);
    const adjustedCalibratedEstimate = trendOnly
      ? clamp(
        baselineTrendFoodInsecurityEstimate
          + (central.foodPricePressureIndex * population * 0.03)
          - (hp.reducedMarketDemandGJ / Math.max(1, totalFoodDemandGJ)) * population * 0.08
          - (hp.addedLocalSupplyGJ / Math.max(1, totalFoodDemandGJ)) * population * 0.06,
        measuredFoodInsecurityBaselineEstimate * 0.9,
        population * 0.9
      )
      : central.calibratedFoodInsecurityEstimate;
    const trendBaselineComp = trendOnly
      ? scenarioResults.find((x) => x.trendOnly && n(x.baselineTrendYear) === baselineTrendYear && x.householdProductionScenario === 'noHouseholdProduction')
      : null;
    const foodInsecurityAvoidedVsTrendNoResponse = trendOnly && trendBaselineComp
      ? Math.max(0, trendBaselineComp.calibratedFoodInsecurityEstimate - adjustedCalibratedEstimate)
      : 0;

    const scenarioOut = {
      scenario: row.scenario,
      trendOnly,
      baselineTrendYear,
      baselineTrendFoodInsecurityEstimate2027,
      baselineTrendFoodInsecurityEstimate,
      globalFoodProductionLossShare: n(row.globalFoodProductionLossShare, 0),
      localFoodAvailabilityLossShare: n(row.localFoodAvailabilityLossShare, n(shock.fuelShockPct, 0) / 100),
      importPricePressureMultiplier: n(row.importPricePressureMultiplier, 1 + (n(shock.fuelShockPct, 0) / 100)),
      localProductionShockShare: n(row.localProductionShockShare, n(shock.fuelShockPct, 0) / 300),
      tradeCompetitionIndex: n(row.tradeCompetitionIndex, 0.5),
      householdAffordabilityTransmissionShare: n(row.householdAffordabilityTransmissionShare, 0.6),
      poorCountryDisproportionateImpactNote: row.poorCountryDisproportionateImpactNote ?? null,
      sourceStatus: row.sourceStatus ?? 'model scenario',
      interpretation: row.interpretation ?? 'local+external mixed pressure',
      shockProfile: row.shockProfile,
      householdProductionScenario: row.householdProductionScenario,
      totalFoodDemandGJ,
      reducedMarketDemandGJ: hp.reducedMarketDemandGJ,
      addedLocalSupplyGJ: hp.addedLocalSupplyGJ,
      remainingMarketDemandGJ: marketDemandGJ,
      externalSupplyGJ,
      localSupplyGJ,
      effectiveSupplyGJ,
      supplyDemandGapGJ,
      supplyDemandRatio,
      localSupplyShare,
      exposedDemandShare,
      importDependencyShare,
      conservativeFoodPriceMultiplierEstimate: profileResults.conservativePriceResponse.foodPriceMultiplierEstimate,
      centralFoodPriceMultiplierEstimate: profileResults.centralPriceResponse.foodPriceMultiplierEstimate,
      tightMarketFoodPriceMultiplierEstimate: profileResults.tightMarketPriceResponse.foodPriceMultiplierEstimate,
      foodPricePressureIndex: central.foodPricePressureIndex,
      foodPriceMultiplierEstimate: central.foodPriceMultiplierEstimate,
      affordabilityStressIndex: central.affordabilityStressIndex,
      calibratedFoodInsecurityEstimate: adjustedCalibratedEstimate,
      additionalFoodInsecurePeopleVsTrend: Math.max(0, adjustedCalibratedEstimate - measuredFoodInsecurityBaselineEstimate),
      foodInsecurityAvoidedVsNoAdaptation,
      foodInsecurityAvoidedVsTrendNoResponse,
      severeFoodStressAvoidedVsNoAdaptation,
      baselineFoodInsecurePeople: trendOnly ? baselineTrendFoodInsecurityEstimate : measuredFoodInsecurityBaselineEstimate,
      adaptedFoodInsecurePeople: adjustedCalibratedEstimate,
      peopleKeptOutOfFoodInsecurity: trendOnly ? foodInsecurityAvoidedVsTrendNoResponse : foodInsecurityAvoidedVsNoAdaptation,
      householdsMarketDemandReduced: hp.householdsParticipating,
      populationMarketDemandReduced: hp.householdsParticipating * 2.05,
      householdsProducingSurplus: hp.householdsParticipating * hp.surplusShare,
      householdsParticipating: hp.householdsParticipating,
      producerEquivalentScenarioValue: hp.workersOrHouseholdLabourNeeded,
      producerEquivalentScenarioBasis: 'household-participation proxy; not direct requirement from food-insecurity headcount',
      workerModeNotes: trendOnly
        ? 'Trend-only local response: mixed household growers, surplus growers, and market-oriented local producers.'
        : 'Shock response: additional growers plus distribution and storage coordination.',
      localSupplyAddedGJ: hp.addedLocalSupplyGJ + storageLossReductionEffectiveSupply,
      foodGapGJYear: Math.max(0, marketDemandGJ - effectiveSupplyGJ),
      physicalProductionWorkerEquivalent: blendedGJPerWorkerYear > 0 ? Math.max(0, marketDemandGJ - effectiveSupplyGJ) / blendedGJPerWorkerYear : 0,
      peopleFedEquivalentFromLocalSupplyShift: (hp.addedLocalSupplyGJ + storageLossReductionEffectiveSupply) / PERSON_FOOD_GJ_PER_YEAR,
      noDirectLandAccessRemainingVulnerable: noDirectLandAccessPopulation,
      mainBottleneck: supplyDemandRatio < 0.9 ? 'external_supply_gap' : (hp.workersOrHouseholdLabourNeeded > currentAgIndustryFTEEstimate * 2 ? 'labour_coordination' : 'distribution_storage'),
      confidence: hp.confidence
    };
    scenarioOut.peopleFedEquivalentFromProducerProxy = (scenarioOut.producerEquivalentScenarioValue * blendedGJPerWorkerYear) / PERSON_FOOD_GJ_PER_YEAR;
    scenarioOut.pressureToProductionRatio = scenarioOut.peopleKeptOutOfFoodInsecurity > 0
      ? scenarioOut.peopleFedEquivalentFromProducerProxy / scenarioOut.peopleKeptOutOfFoodInsecurity
      : null;
    scenarioOut.dimensionalSanityWarning = (scenarioOut.pressureToProductionRatio !== null && (scenarioOut.pressureToProductionRatio < 0.5 || scenarioOut.pressureToProductionRatio > 3))
      ? 'pressure_vs_production_dimension_mismatch_check_labels'
      : null;
    scenarioResults.push(scenarioOut);

    for (const seg of demandSegments) {
      const segmentReduceFactor = clamp(seg.selfProvisionPotentialShare * hp.mobilizationShare * (seg.demandSegment.includes('noDirect') ? 0.1 : 1), 0, 0.65);
      const segmentSurplusFactor = clamp(seg.surplusProductionPotentialShare * hp.surplusShare, 0, 0.5);
      const reducedMarketDemandGJ = seg.baselineFoodDemandGJ * segmentReduceFactor;
      const surplusProductionGJ = seg.baselineFoodDemandGJ * segmentSurplusFactor;
      const remainingVulnerablePopulation = seg.population * clamp(seg.vulnerabilityIndex + (scenarioOut.foodPricePressureIndex * 0.12) - (segmentReduceFactor * 0.4), 0, 1);
      householdRows.push({
        scenario: row.scenario,
        demandSegment: seg.demandSegment,
        population: seg.population,
        dwellings: seg.dwellings,
        marketDemandShare: seg.marketDemandShare,
        selfProvisionPotentialShare: seg.selfProvisionPotentialShare,
        reducedMarketDemandGJ,
        surplusProductionGJ,
        remainingVulnerablePopulation,
        notes: seg.demandSegment === 'noDirectLandAccessHouseholds'
          ? 'Most exposed without distribution/aid bridge'
          : 'Proxy segment estimate'
      });
    }
  }

  const householdImpact = scenarioResults.map((s) => ({
    scenario: s.scenario,
    householdsMarketDemandReduced: s.householdsMarketDemandReduced,
    populationMarketDemandReduced: s.populationMarketDemandReduced,
    householdsProducingSurplus: s.householdsProducingSurplus,
    localSupplyAddedGJ: s.localSupplyAddedGJ,
    foodPriceMultiplierEstimate: s.foodPriceMultiplierEstimate,
    foodInsecurityEstimate: s.calibratedFoodInsecurityEstimate,
    foodInsecurityAvoidedVsNoAdaptation: s.foodInsecurityAvoidedVsNoAdaptation,
    peopleKeptOutOfFoodInsecurity: s.peopleKeptOutOfFoodInsecurity,
    severeFoodStressAvoidedVsNoAdaptation: s.severeFoodStressAvoidedVsNoAdaptation,
    noDirectLandAccessRemainingVulnerable: s.noDirectLandAccessRemainingVulnerable
  }));

  const assumptions = {
    population,
    totalFoodDemandGJ,
    measuredFoodInsecurityBaselineEstimate,
    baselineTrendFoodInsecurityEstimate2027,
    baselineTrendFoodInsecurityShare2027,
    measuredFoodInsecurityShare,
    currentAgIndustryFTEEstimate,
    subsistencePopulation,
    noDirectLandAccessPopulation,
    localNodeCount,
    priceResponseProfiles: PRICE_RESPONSE_PROFILES
  };

  const caveats = [
    'A one-third global food production loss is not the same as Grey County having one-third less local food. In Grey, the main near-term channel is higher prices, tighter trade, import competition, and household affordability stress.',
    'foodPriceMultiplierEstimate is a modelled price-pressure proxy. It is not a retail food price forecast.',
    'Price-pressure model is a proxy, not a price forecast.',
    'Household production does not replace full diet immediately.',
    'Land access is not ownership.',
    'Surplus depends on storage, processing, skill, tools, and time.',
    'Local production reduces exposure but does not eliminate all external dependence.'
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    canonicalCarryingCapacity: buildGreyCanonicalCarryingCapacityContext({produceDir}),
    sourceFiles: {
      foodCalibration: path.join(produceDir, 'grey-food-calibration.json'),
      currentShockThreshold: path.join(produceDir, 'grey-current-system-shock-threshold.json'),
      foodGapReplacement: path.join(produceDir, 'grey-food-gap-replacement.json'),
      dwellingLandAccess: path.join(produceDir, 'grey-dwelling-land-access.json'),
      agLabour: path.join(produceDir, 'grey-ag-labour-baseline.json'),
      localization: path.join(produceDir, 'grey-localization-access.json'),
      transitionPathways: path.join(produceDir, 'grey-transition-pathways.json')
    },
    demandSegments,
    supplyCategories,
    householdProductionScenarios,
    supplyDemandScenarios: scenarioResults,
    pricePressureScenarios: scenarioResults.map((s) => ({
      scenario: s.scenario,
      conservativePriceResponse: s.conservativeFoodPriceMultiplierEstimate,
      centralPriceResponse: s.centralFoodPriceMultiplierEstimate,
      tightMarketPriceResponse: s.tightMarketFoodPriceMultiplierEstimate
    })),
    householdImpact,
    assumptions,
    caveats,
    warnings,
    keyResults: {
      shock20NoAdaptation: scenarioResults.find((s) => s.scenario === 'shock20NoAdaptation') ?? null,
      shock20CombinedLocalResponse: scenarioResults.find((s) => s.scenario === 'shock20CombinedLocalResponse') ?? null,
      severeSystemicInputLoss33CombinedResponse: scenarioResults.find((s) => s.scenario === 'severeSystemicInputLoss33CombinedResponse') ?? null,
      trend2027NoNewShockNoLocalResponse: scenarioResults.find((s) => s.scenario === 'trend2027NoNewShockNoLocalResponse') ?? null,
      trend2027NoNewShockCombinedLocalResponse: scenarioResults.find((s) => s.scenario === 'trend2027NoNewShockCombinedLocalResponse') ?? null
    },
    pressureOutputs: scenarioResults.map((s) => ({
      scenario: s.scenario,
      baselineFoodInsecurePeople: s.baselineFoodInsecurePeople,
      adaptedFoodInsecurePeople: s.adaptedFoodInsecurePeople,
      peopleKeptOutOfFoodInsecurity: s.peopleKeptOutOfFoodInsecurity,
      foodPricePressureIndex: s.foodPricePressureIndex,
      foodPriceMultiplierEstimate: s.foodPriceMultiplierEstimate
    })),
    physicalProductionOutputs: scenarioResults.map((s) => ({
      scenario: s.scenario,
      foodGapGJYear: s.foodGapGJYear,
      producerEquivalentScenarioValue: s.producerEquivalentScenarioValue,
      physicalProductionWorkerEquivalent: s.physicalProductionWorkerEquivalent,
      peopleFedEquivalentFromLocalSupplyShift: s.peopleFedEquivalentFromLocalSupplyShift,
      peopleFedEquivalentFromProducerProxy: s.peopleFedEquivalentFromProducerProxy
    }))
  };

  const markdown = [
    '# Grey Food Supply, Demand, and Price Pressure',
    '',
    '## Bottom line',
    'Food prices are affected by both supply and demand. Local production can help two ways: households growing for themselves reduce market demand, while surplus growers and farms increase local supply.',
    'A one-third global food production loss is not the same as Grey County having one-third less local food. In Grey, the main near-term channel is higher prices, tighter trade, import competition, and household affordability stress.',
    '',
    '## Current-system exposure',
    `About ${(scenarioResults.find((s) => s.scenario === 'currentSystemBaseline')?.importDependencyShare * 100 || 0).toFixed(1)}% of effective supply remains import-exposed in this baseline model.`,
    '',
    '## Demand reduction from household production',
    '| Scenario | Households participating | Market demand reduced (GJ) | Surplus added (GJ) | Price-pressure effect | Caveat |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    ...scenarioResults.filter((s) => s.shockProfile === 'fuelShock20').map((s) => `| ${s.householdProductionScenario} | ${s.householdsMarketDemandReduced.toFixed(0)} | ${s.reducedMarketDemandGJ.toFixed(0)} | ${s.addedLocalSupplyGJ.toFixed(0)} | ${s.foodPricePressureIndex.toFixed(3)} | proxy estimate |`),
    '',
    '## Local supply expansion',
    '| Scenario | Local supply added (GJ) | Labour required (proxy FTE) | Land required (proxy) | Time to scale | Price-pressure effect |',
    '| --- | ---: | ---: | --- | --- | ---: |',
    ...scenarioResults.filter((s) => ['shock20NoAdaptation', 'shock20CombinedLocalResponse', 'shock40CombinedLocalResponse'].includes(s.scenario)).map((s) => `| ${s.scenario} | ${s.localSupplyAddedGJ.toFixed(0)} | ${Math.max(0, s.householdsMarketDemandReduced * 0.35).toFixed(0)} | from dwelling-land-access thresholds | 1-10 years | ${s.foodPricePressureIndex.toFixed(3)} |`),
    '',
    '## Shock scenarios',
    '| Shock | Response | Supply-demand ratio | Food price pressure | Calibrated food insecurity | Avoided food insecurity |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
    ...scenarioResults.filter((s) => ['shock20NoAdaptation', 'shock20CombinedLocalResponse', 'shock40NoAdaptation', 'shock40CombinedLocalResponse', 'severeSystemicInputLoss33NoAdaptation', 'severeSystemicInputLoss33CombinedResponse'].includes(s.scenario)).map((s) => `| ${s.shockProfile} | ${s.householdProductionScenario} | ${s.supplyDemandRatio.toFixed(3)} | ${s.foodPricePressureIndex.toFixed(3)} | ${s.calibratedFoodInsecurityEstimate.toFixed(0)} | ${s.foodInsecurityAvoidedVsNoAdaptation.toFixed(0)} |`),
    '',
    '## Trend-only local response',
    'This is the no-new-shock case. It asks how much local production/storage/distribution could reduce food insecurity under the existing trend-only baseline.',
    'Food-insecurity pressure and physical production are related but not the same metric. Producer-equivalent values below are scenario proxies, not direct labour requirements derived from food-insecurity headcount.',
    '| Scenario | Baseline trend food insecurity (2027) | Reduced market demand (GJ) | Added local supply (GJ) | Food price pressure | Calibrated food insecurity | People kept out (vs trend no-response) | Households participating | Producer-equivalent scenario value |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...scenarioResults.filter((s) => s.trendOnly).map((s) => `| ${s.scenario} | ${s.baselineTrendFoodInsecurityEstimate2027.toFixed(0)} | ${s.reducedMarketDemandGJ.toFixed(0)} | ${s.addedLocalSupplyGJ.toFixed(0)} | ${s.foodPricePressureIndex.toFixed(3)} | ${s.calibratedFoodInsecurityEstimate.toFixed(0)} | ${s.foodInsecurityAvoidedVsTrendNoResponse.toFixed(0)} | ${s.householdsParticipating.toFixed(0)} | ${s.producerEquivalentScenarioValue.toFixed(0)} |`),
    '',
    'The food-insecurity scenario estimates how many people are protected from price and access pressure. The physical production model estimates how many producer-equivalents are needed to cover a given food gap. Those are related, but they are not the same number.',
    '',
    '## Who remains vulnerable',
    'No-direct-land-access households remain most exposed unless food aid, public kitchens, co-ops, or local distribution bridges the gap.',
    '',
    '## Caveats',
    ...caveats.map((c) => `- ${c}`)
  ].join('\n') + '\n';

  const markdownPath = path.join(produceDir, 'grey-food-supply-demand-price.md');
  const jsonPath = path.join(produceDir, 'grey-food-supply-demand-price.json');
  const scenariosCsvPath = path.join(produceDir, 'grey-food-supply-demand-price-scenarios.csv');
  const householdsCsvPath = path.join(produceDir, 'grey-food-supply-demand-price-households.csv');

  fs.writeFileSync(markdownPath, markdown);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(scenariosCsvPath, `${toCsv(scenarioResults.map((s) => ({
    scenario: s.scenario,
    shockProfile: s.shockProfile,
    householdProductionScenario: s.householdProductionScenario,
    trendOnly: s.trendOnly,
    baselineTrendYear: s.baselineTrendYear,
    baselineTrendFoodInsecurityEstimate2027: s.baselineTrendFoodInsecurityEstimate2027,
    totalFoodDemandGJ: s.totalFoodDemandGJ,
    reducedMarketDemandGJ: s.reducedMarketDemandGJ,
    addedLocalSupplyGJ: s.addedLocalSupplyGJ,
    remainingMarketDemandGJ: s.remainingMarketDemandGJ,
    externalSupplyGJ: s.externalSupplyGJ,
    effectiveSupplyGJ: s.effectiveSupplyGJ,
    supplyDemandRatio: s.supplyDemandRatio,
    localSupplyShare: s.localSupplyShare,
    exposedDemandShare: s.exposedDemandShare,
    foodPricePressureIndex: s.foodPricePressureIndex,
    foodPriceMultiplierEstimate: s.foodPriceMultiplierEstimate,
    calibratedFoodInsecurityEstimate: s.calibratedFoodInsecurityEstimate,
    foodInsecurityAvoidedVsNoAdaptation: s.foodInsecurityAvoidedVsNoAdaptation,
    foodInsecurityAvoidedVsTrendNoResponse: s.foodInsecurityAvoidedVsTrendNoResponse,
    householdsParticipating: s.householdsParticipating,
    producerEquivalentScenarioValue: s.producerEquivalentScenarioValue,
    physicalProductionWorkerEquivalent: s.physicalProductionWorkerEquivalent,
    peopleFedEquivalentFromLocalSupplyShift: s.peopleFedEquivalentFromLocalSupplyShift,
    peopleFedEquivalentFromProducerProxy: s.peopleFedEquivalentFromProducerProxy,
    pressureToProductionRatio: s.pressureToProductionRatio,
    dimensionalSanityWarning: s.dimensionalSanityWarning,
    workerModeNotes: s.workerModeNotes,
    mainBottleneck: s.mainBottleneck,
    confidence: s.confidence
  })), [
    'scenario', 'shockProfile', 'householdProductionScenario', 'trendOnly', 'baselineTrendYear', 'baselineTrendFoodInsecurityEstimate2027', 'totalFoodDemandGJ', 'reducedMarketDemandGJ', 'addedLocalSupplyGJ',
    'remainingMarketDemandGJ', 'externalSupplyGJ', 'effectiveSupplyGJ', 'supplyDemandRatio', 'localSupplyShare', 'exposedDemandShare',
    'foodPricePressureIndex', 'foodPriceMultiplierEstimate', 'calibratedFoodInsecurityEstimate', 'foodInsecurityAvoidedVsNoAdaptation', 'foodInsecurityAvoidedVsTrendNoResponse',
    'householdsParticipating', 'producerEquivalentScenarioValue', 'physicalProductionWorkerEquivalent', 'peopleFedEquivalentFromLocalSupplyShift', 'peopleFedEquivalentFromProducerProxy', 'pressureToProductionRatio', 'dimensionalSanityWarning', 'workerModeNotes', 'mainBottleneck', 'confidence'
  ])}\n`);
  fs.writeFileSync(householdsCsvPath, `${toCsv(householdRows, [
    'scenario', 'demandSegment', 'population', 'dwellings', 'marketDemandShare', 'selfProvisionPotentialShare',
    'reducedMarketDemandGJ', 'surplusProductionGJ', 'remainingVulnerablePopulation', 'notes'
  ])}\n`);

  return {
    report,
    paths: { markdownPath, jsonPath, scenariosCsvPath, householdsCsvPath }
  };
}
