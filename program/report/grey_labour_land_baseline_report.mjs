// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { greyCountySeedNodes } from '../data/grey_county_seed_nodes.mjs';

const DEFAULTS = {
  foodWorkerDaysPerYear: 220,
  areaShares: {
    humanFood: 0.55,
    pastureFodder: 0.3,
    woodEnergy: 0.15
  },
  labourDaysByCategory: {
    urbanNoLand: 2,
    townVillage: 8,
    hamlet: 15,
    ruralNonFarm: 25,
    ruralProductive: 60,
    agriculturalLotAccess: 90
  },
  scenarios: [
    { scenario: 'currentMechanized', machinerySupportFactor: 1, fuelInputIndex: 1, labourDaysPerHumanFoodHa: 8, humanLabourMultiplier: 1, notes: 'Current mechanized baseline' },
    { scenario: 'reducedFuel', machinerySupportFactor: 0.75, fuelInputIndex: 0.75, labourDaysPerHumanFoodHa: 20, humanLabourMultiplier: 1.35, notes: 'Reduced fuel and machinery support' },
    { scenario: 'lowFuelMixed', machinerySupportFactor: 0.45, fuelInputIndex: 0.5, labourDaysPerHumanFoodHa: 45, humanLabourMultiplier: 1.9, notes: 'Low-fuel mixed human/mechanical mode' },
    { scenario: 'mostlyHumanScale', machinerySupportFactor: 0.2, fuelInputIndex: 0.25, labourDaysPerHumanFoodHa: 90, humanLabourMultiplier: 2.6, notes: 'Mostly human-scale production mode' }
  ]
};

const RURAL_PRIORITY = new Set(['West Grey', 'Grey Highlands', 'Southgate', 'Chatsworth', 'Georgian Bluffs', 'Meaford', 'The Blue Mountains']);

const HARVEST_SEASONS = ['earlySpring', 'lateSpring', 'earlySummer', 'lateSummer', 'autumn', 'lateAutumn', 'winterStored'];

const PRODUCTION_SYSTEMS = [
  {
    system: 'annualMechanized',
    establishmentYears: 1,
    establishmentLabourDaysPerHa: 6,
    maintenanceLabourDaysPerHa: 12,
    harvestLabourDaysPerGJ: 0.45,
    harvestWindowDays: 45,
    annualFoodEnergyGJPerHaAtMaturity: 28,
    maturityRampYears: 1,
    maturityCurve: 'flat',
    inputDependencyIndex: 0.85,
    machineryDependencyIndex: 0.9,
    skillRequirementIndex: 0.45,
    managementComplexityIndex: 0.35,
    seasonalPeakLabourMultiplier: 1.45,
    harvestDistribution: { autumn: 0.85, winterStored: 0.15 },
    notes: 'High machinery/input dependence; narrow harvest peak.'
  },
  {
    system: 'annualLowFuel',
    establishmentYears: 1,
    establishmentLabourDaysPerHa: 12,
    maintenanceLabourDaysPerHa: 42,
    harvestLabourDaysPerGJ: 0.9,
    harvestWindowDays: 55,
    annualFoodEnergyGJPerHaAtMaturity: 22,
    maturityRampYears: 1,
    maturityCurve: 'flat',
    inputDependencyIndex: 0.5,
    machineryDependencyIndex: 0.45,
    skillRequirementIndex: 0.5,
    managementComplexityIndex: 0.5,
    seasonalPeakLabourMultiplier: 1.55,
    harvestDistribution: { lateSummer: 0.1, autumn: 0.75, winterStored: 0.15 },
    notes: 'Low-fuel annual reference baseline.'
  },
  {
    system: 'marketGardenIntensive',
    establishmentYears: 1,
    establishmentLabourDaysPerHa: 70,
    maintenanceLabourDaysPerHa: 120,
    harvestLabourDaysPerGJ: 1.7,
    harvestWindowDays: 130,
    annualFoodEnergyGJPerHaAtMaturity: 34,
    maturityRampYears: 1,
    maturityCurve: 'flat',
    inputDependencyIndex: 0.55,
    machineryDependencyIndex: 0.3,
    skillRequirementIndex: 0.75,
    managementComplexityIndex: 0.82,
    seasonalPeakLabourMultiplier: 1.25,
    harvestDistribution: { lateSpring: 0.12, earlySummer: 0.18, lateSummer: 0.28, autumn: 0.32, lateAutumn: 0.1 },
    notes: 'Very labour-intensive with broad harvest season.'
  },
  {
    system: 'householdGarden',
    establishmentYears: 1,
    establishmentLabourDaysPerHa: 55,
    maintenanceLabourDaysPerHa: 95,
    harvestLabourDaysPerGJ: 2,
    harvestWindowDays: 120,
    annualFoodEnergyGJPerHaAtMaturity: 24,
    maturityRampYears: 1,
    maturityCurve: 'flat',
    inputDependencyIndex: 0.4,
    machineryDependencyIndex: 0.12,
    skillRequirementIndex: 0.55,
    managementComplexityIndex: 0.65,
    seasonalPeakLabourMultiplier: 1.2,
    harvestDistribution: { lateSpring: 0.1, earlySummer: 0.2, lateSummer: 0.25, autumn: 0.3, winterStored: 0.15 },
    notes: 'Low machinery, household-scale production.'
  },
  {
    system: 'youngPermaculture',
    establishmentYears: 4,
    establishmentLabourDaysPerHa: 180,
    maintenanceLabourDaysPerHa: 52,
    harvestLabourDaysPerGJ: 1.4,
    harvestWindowDays: 160,
    annualFoodEnergyGJPerHaAtMaturity: 20,
    maturityRampYears: 6,
    maturityCurve: 'sigmoid',
    inputDependencyIndex: 0.35,
    machineryDependencyIndex: 0.2,
    skillRequirementIndex: 0.82,
    managementComplexityIndex: 0.86,
    seasonalPeakLabourMultiplier: 1.15,
    harvestDistribution: { lateSpring: 0.08, earlySummer: 0.18, lateSummer: 0.22, autumn: 0.28, lateAutumn: 0.16, winterStored: 0.08 },
    notes: 'Front-loaded design/establishment burden before maturity.'
  },
  {
    system: 'maturePermaculture',
    establishmentYears: 6,
    establishmentLabourDaysPerHa: 210,
    maintenanceLabourDaysPerHa: 24,
    harvestLabourDaysPerGJ: 0.95,
    harvestWindowDays: 185,
    annualFoodEnergyGJPerHaAtMaturity: 23,
    maturityRampYears: 8,
    maturityCurve: 'sigmoid',
    inputDependencyIndex: 0.22,
    machineryDependencyIndex: 0.14,
    skillRequirementIndex: 0.84,
    managementComplexityIndex: 0.88,
    seasonalPeakLabourMultiplier: 1.08,
    harvestDistribution: { earlySummer: 0.1, lateSummer: 0.25, autumn: 0.4, lateAutumn: 0.15, winterStored: 0.1 },
    notes: 'Lower recurring labour after establishment; requires management skill.'
  },
  {
    system: 'orchardNutPolyculture',
    establishmentYears: 8,
    establishmentLabourDaysPerHa: 170,
    maintenanceLabourDaysPerHa: 20,
    harvestLabourDaysPerGJ: 1,
    harvestWindowDays: 120,
    annualFoodEnergyGJPerHaAtMaturity: 19,
    maturityRampYears: 10,
    maturityCurve: 'sigmoid',
    inputDependencyIndex: 0.2,
    machineryDependencyIndex: 0.18,
    skillRequirementIndex: 0.8,
    managementComplexityIndex: 0.8,
    seasonalPeakLabourMultiplier: 1.18,
    harvestDistribution: { lateSummer: 0.18, autumn: 0.56, lateAutumn: 0.16, winterStored: 0.1 },
    notes: 'Long maturity ramp with lower annual maintenance.'
  },
  {
    system: 'silvopasture',
    establishmentYears: 5,
    establishmentLabourDaysPerHa: 125,
    maintenanceLabourDaysPerHa: 16,
    harvestLabourDaysPerGJ: 1.2,
    harvestWindowDays: 170,
    annualFoodEnergyGJPerHaAtMaturity: 16,
    maturityRampYears: 7,
    maturityCurve: 'sigmoid',
    inputDependencyIndex: 0.26,
    machineryDependencyIndex: 0.22,
    skillRequirementIndex: 0.74,
    managementComplexityIndex: 0.72,
    seasonalPeakLabourMultiplier: 1.12,
    harvestDistribution: { lateSpring: 0.08, earlySummer: 0.2, lateSummer: 0.26, autumn: 0.28, lateAutumn: 0.1, winterStored: 0.08 },
    notes: 'Food/fodder-tree integration with slower ramp.'
  },
  {
    system: 'coppiceWoodFuel',
    establishmentYears: 6,
    establishmentLabourDaysPerHa: 105,
    maintenanceLabourDaysPerHa: 12,
    harvestLabourDaysPerGJ: 0.55,
    harvestWindowDays: 100,
    annualFoodEnergyGJPerHaAtMaturity: 11,
    maturityRampYears: 8,
    maturityCurve: 'sigmoid',
    inputDependencyIndex: 0.15,
    machineryDependencyIndex: 0.18,
    skillRequirementIndex: 0.64,
    managementComplexityIndex: 0.62,
    seasonalPeakLabourMultiplier: 1.25,
    harvestDistribution: { lateAutumn: 0.4, winterStored: 0.6 },
    notes: 'Wood-energy resilience layer; seasonal cut/store labour peak.'
  },
  {
    system: 'mixedPerennialStapleSystem',
    establishmentYears: 7,
    establishmentLabourDaysPerHa: 165,
    maintenanceLabourDaysPerHa: 22,
    harvestLabourDaysPerGJ: 0.9,
    harvestWindowDays: 175,
    annualFoodEnergyGJPerHaAtMaturity: 21,
    maturityRampYears: 9,
    maturityCurve: 'sigmoid',
    inputDependencyIndex: 0.24,
    machineryDependencyIndex: 0.16,
    skillRequirementIndex: 0.81,
    managementComplexityIndex: 0.85,
    seasonalPeakLabourMultiplier: 1.1,
    harvestDistribution: { earlySummer: 0.09, lateSummer: 0.23, autumn: 0.36, lateAutumn: 0.2, winterStored: 0.12 },
    notes: 'Perennial staple-focused mixed system.'
  }
];

const PERMACULTURE_ADOPTION_SCENARIOS = [
  {
    scenario: 'noPerennialTransition',
    shareOfHumanFoodProducingHaTransitioned: 0,
    establishmentYears: 0,
    matureSystemShare: 0,
    orchardNutShare: 0,
    coppiceWoodFuelShare: 0,
    marketGardenShare: 0.18,
    annualStapleShare: 0.82,
    notes: 'Reference with annual-dominant production.'
  },
  {
    scenario: 'modestPermacultureTransition',
    shareOfHumanFoodProducingHaTransitioned: 0.2,
    establishmentYears: 6,
    matureSystemShare: 0.55,
    orchardNutShare: 0.2,
    coppiceWoodFuelShare: 0.1,
    marketGardenShare: 0.2,
    annualStapleShare: 0.5,
    notes: 'Partial perennial transition while retaining annual production.'
  },
  {
    scenario: 'strongPermacultureTransition',
    shareOfHumanFoodProducingHaTransitioned: 0.45,
    establishmentYears: 8,
    matureSystemShare: 0.6,
    orchardNutShare: 0.2,
    coppiceWoodFuelShare: 0.1,
    marketGardenShare: 0.15,
    annualStapleShare: 0.3,
    notes: 'Large perennial transition with mixed systems.'
  },
  {
    scenario: 'perennialStapleTransition',
    shareOfHumanFoodProducingHaTransitioned: 0.65,
    establishmentYears: 10,
    matureSystemShare: 0.5,
    orchardNutShare: 0.25,
    coppiceWoodFuelShare: 0.15,
    marketGardenShare: 0.1,
    annualStapleShare: 0.2,
    notes: 'Perennial staple-heavy transition over a longer ramp.'
  }
];

function readJson(filePath, warnings) {
  if (!fs.existsSync(filePath)) {
    warnings.push(`Missing file: ${filePath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    warnings.push(`Failed to parse file: ${filePath} (${error.message})`);
    return null;
  }
}

function readCsv(filePath, warnings) {
  if (!fs.existsSync(filePath)) {
    warnings.push(`Missing file: ${filePath}`);
    return [];
  }
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row = {};
    for (let i = 0; i < headers.length; i += 1) row[headers[i]] = cols[i] ?? '';
    return row;
  });
}

function esc(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function toCsv(rows, headers) {
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}

function n(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function roundInt(x) {
  return Math.max(0, Math.round(x));
}

function sum(obj) {
  return Object.values(obj).reduce((a, b) => a + n(b), 0);
}

function normalizeHarvestDistribution(dist = {}) {
  const normalized = Object.fromEntries(HARVEST_SEASONS.map((s) => [s, 0]));
  for (const [key, value] of Object.entries(dist)) {
    if (key in normalized) normalized[key] = Math.max(0, n(value));
  }
  const total = sum(normalized);
  if (total <= 0) {
    normalized.autumn = 1;
    return normalized;
  }
  for (const key of HARVEST_SEASONS) normalized[key] /= total;
  return normalized;
}

export function estimatePopulationCategories(input) {
  const {
    population2021,
    municipalityName,
    municipalityType,
    densityPerKm2,
    settlementFeatureCount,
    productiveLotConcessionCount,
    settlementGardenOpportunityCount,
    cooperativeLandAccessCandidateCount,
    constrainedLandCount
  } = input;

  let urbanBase = municipalityType === 'city' ? 0.74 : municipalityType === 'town' ? 0.5 : 0.2;
  if ((municipalityName ?? '') === 'Owen Sound') urbanBase = 0.86;
  if ((municipalityName ?? '') === 'Hanover') urbanBase = 0.8;
  if (RURAL_PRIORITY.has(municipalityName)) urbanBase -= 0.08;
  urbanBase += clamp01((densityPerKm2 - 80) / 800) * 0.18;
  urbanBase = clamp01(urbanBase);

  const settlementIntensity = clamp01(settlementFeatureCount / 10);
  const lotAccessSignal = productiveLotConcessionCount > 0
    ? clamp01((productiveLotConcessionCount + cooperativeLandAccessCandidateCount) / (productiveLotConcessionCount + constrainedLandCount + settlementGardenOpportunityCount + 1))
    : 0;

  let noDirectLandAccessShare = clamp01(urbanBase * 0.65 + settlementIntensity * 0.18 - lotAccessSignal * 0.22);
  if ((municipalityName ?? '') === 'Owen Sound' || (municipalityName ?? '') === 'Hanover') {
    noDirectLandAccessShare = Math.max(noDirectLandAccessShare, 0.62);
  }

  const pUrban = noDirectLandAccessShare;
  const remaining = Math.max(0, 1 - pUrban);
  let pTownVillage = remaining * (0.25 + settlementIntensity * 0.1);
  let pHamlet = remaining * (0.1 + (1 - urbanBase) * 0.05);
  let pAgLot = remaining * (0.2 + lotAccessSignal * 0.2);
  let pRuralProductive = remaining * (0.18 + lotAccessSignal * 0.22);

  const subTotal = pTownVillage + pHamlet + pAgLot + pRuralProductive;
  if (subTotal > remaining && subTotal > 0) {
    const scale = remaining / subTotal;
    pTownVillage *= scale;
    pHamlet *= scale;
    pAgLot *= scale;
    pRuralProductive *= scale;
  }

  const noDirectLandAccessPopulation = roundInt(population2021 * pUrban);
  let townVillageSettlementPopulation = roundInt(population2021 * pTownVillage);
  let hamletSettlementPopulation = roundInt(population2021 * pHamlet);
  let agriculturalLotAccessPopulation = roundInt(population2021 * pAgLot);
  let ruralProductiveLandAccessPopulation = roundInt(population2021 * pRuralProductive);

  let provisionalWithoutRuralNonFarm = noDirectLandAccessPopulation + townVillageSettlementPopulation + hamletSettlementPopulation
    + agriculturalLotAccessPopulation + ruralProductiveLandAccessPopulation;
  if (provisionalWithoutRuralNonFarm > population2021) {
    let overflow = provisionalWithoutRuralNonFarm - population2021;
    const adjustable = [
      { key: 'ruralProductiveLandAccessPopulation', value: ruralProductiveLandAccessPopulation },
      { key: 'agriculturalLotAccessPopulation', value: agriculturalLotAccessPopulation },
      { key: 'townVillageSettlementPopulation', value: townVillageSettlementPopulation },
      { key: 'hamletSettlementPopulation', value: hamletSettlementPopulation }
    ].sort((a, b) => b.value - a.value);
    for (const bucket of adjustable) {
      if (overflow <= 0) break;
      const dec = Math.min(overflow, bucket.value);
      if (bucket.key === 'ruralProductiveLandAccessPopulation') ruralProductiveLandAccessPopulation -= dec;
      if (bucket.key === 'agriculturalLotAccessPopulation') agriculturalLotAccessPopulation -= dec;
      if (bucket.key === 'townVillageSettlementPopulation') townVillageSettlementPopulation -= dec;
      if (bucket.key === 'hamletSettlementPopulation') hamletSettlementPopulation -= dec;
      overflow -= dec;
    }
    provisionalWithoutRuralNonFarm = noDirectLandAccessPopulation + townVillageSettlementPopulation + hamletSettlementPopulation
      + agriculturalLotAccessPopulation + ruralProductiveLandAccessPopulation;
  }

  const ruralNonFarmPopulation = Math.max(0, population2021 - provisionalWithoutRuralNonFarm);
  const urbanSettlementPopulation = noDirectLandAccessPopulation;

  return {
    urbanSettlementPopulation,
    townVillageSettlementPopulation,
    hamletSettlementPopulation,
    ruralNonFarmPopulation,
    ruralProductiveLandAccessPopulation,
    agriculturalLotAccessPopulation,
    noDirectLandAccessPopulation,
    method: 'heuristicEstimate',
    confidence: 0.55
  };
}

function evaluateProductionSystem(system, context) {
  const {
    foodWorkerDaysPerYear,
    lowFuelAnnualBaseline,
    annualReferenceLabourDaysPerHa,
    annualReferencePeakHarvestShare
  } = context;

  const harvestDistribution = normalizeHarvestDistribution(system.harvestDistribution);
  const peakHarvestShare = Math.max(...Object.values(harvestDistribution));
  const nonZero = Object.values(harvestDistribution).filter((v) => v > 0).length;
  const concentrationHerfindahl = Object.values(harvestDistribution).reduce((acc, v) => acc + v * v, 0);
  const harvestConcentrationIndex = clamp01(concentrationHerfindahl);
  const rollingHarvestAdvantage = clamp01(1 - peakHarvestShare);
  const seasonalLabourSmoothingFactor = clamp01(1 - (peakHarvestShare - (1 / Math.max(nonZero, 1)) * 0.5));

  const labourDaysPerHaAtYear1 = system.establishmentLabourDaysPerHa + system.maintenanceLabourDaysPerHa
    + (system.annualFoodEnergyGJPerHaAtMaturity * 0.25 * system.harvestLabourDaysPerGJ);
  const labourDaysPerHaAtMaturity = system.maintenanceLabourDaysPerHa
    + (system.annualFoodEnergyGJPerHaAtMaturity * system.harvestLabourDaysPerGJ);

  const foodEnergyGJPerLabourDayAtMaturity = labourDaysPerHaAtMaturity > 0
    ? system.annualFoodEnergyGJPerHaAtMaturity / labourDaysPerHaAtMaturity : 0;
  const manageableHaPerWorkerAtMaturity = labourDaysPerHaAtMaturity > 0 ? foodWorkerDaysPerYear / labourDaysPerHaAtMaturity : 0;

  const peakLabourDaysPerHarvestWindow = labourDaysPerHaAtMaturity * peakHarvestShare * system.seasonalPeakLabourMultiplier;
  const establishmentLabourDeficitDays = Math.max(0, system.establishmentLabourDaysPerHa - annualReferenceLabourDaysPerHa);

  const labourReductionAtMaturity = annualReferenceLabourDaysPerHa - labourDaysPerHaAtMaturity;
  const manageableHaMultiplierVsLowFuelAnnual = lowFuelAnnualBaseline.manageableHaPerWorkerAtMaturity > 0
    ? manageableHaPerWorkerAtMaturity / lowFuelAnnualBaseline.manageableHaPerWorkerAtMaturity : 0;
  const peakLabourReductionVsAnnual = annualReferencePeakHarvestShare - peakHarvestShare;
  const inputDependencyReductionVsAnnual = lowFuelAnnualBaseline.inputDependencyIndex - system.inputDependencyIndex;
  const foodEnergyGJPerHaRatioVsAnnual = lowFuelAnnualBaseline.annualFoodEnergyGJPerHaAtMaturity > 0
    ? system.annualFoodEnergyGJPerHaAtMaturity / lowFuelAnnualBaseline.annualFoodEnergyGJPerHaAtMaturity : 0;
  const foodEnergyGJPerLabourDayRatioVsAnnual = lowFuelAnnualBaseline.foodEnergyGJPerLabourDayAtMaturity > 0
    ? foodEnergyGJPerLabourDayAtMaturity / lowFuelAnnualBaseline.foodEnergyGJPerLabourDayAtMaturity : 0;

  const yearsUntilNetLabourAdvantage = labourReductionAtMaturity > 0
    ? Math.max(1, Math.ceil(system.establishmentLabourDaysPerHa / labourReductionAtMaturity))
    : null;
  const yearsUntilFoodEnergyMaturity = system.maturityRampYears;
  const transitionDipGJ = Math.max(0, lowFuelAnnualBaseline.annualFoodEnergyGJPerHaAtMaturity * 0.2 * Math.min(1, system.establishmentYears / 8));
  const establishmentBottleneckWarning = system.establishmentLabourDaysPerHa > 120 || system.skillRequirementIndex > 0.75;

  return {
    ...system,
    labourDaysPerHaAtYear1,
    labourDaysPerHaAtMaturity,
    foodEnergyGJPerLabourDayAtMaturity,
    manageableHaPerWorkerAtMaturity,
    peakLabourDaysPerHarvestWindow,
    seasonalLabourSmoothingFactor,
    externalInputDependencyIndex: system.inputDependencyIndex,
    skillBottleneckIndex: clamp01((system.skillRequirementIndex + system.managementComplexityIndex) / 2),
    harvestConcentrationIndex,
    peakHarvestShare,
    rollingHarvestAdvantage,
    labourSmoothingMultiplier: 1 - rollingHarvestAdvantage * 0.35,
    establishmentLabourDeficitDays,
    yearsUntilNetLabourAdvantage,
    yearsUntilFoodEnergyMaturity,
    transitionDipGJ,
    establishmentBottleneckWarning,
    labourReductionAtMaturity,
    manageableHaMultiplierVsLowFuelAnnual,
    peakLabourReductionVsAnnual,
    inputDependencyReductionVsAnnual,
    foodEnergyGJPerHaRatioVsAnnual,
    foodEnergyGJPerLabourDayRatioVsAnnual,
    harvestDistribution
  };
}

function buildPermacultureScenarioRows(args) {
  const {
    regional,
    foodWorkerDaysPerYear,
    lowFuelRequiredLabourDays,
    lowFuelAvailableLabourDays,
    systemById
  } = args;

  const maturePermaculture = systemById.get('maturePermaculture');
  const orchardNutPolyculture = systemById.get('orchardNutPolyculture');
  const coppiceWoodFuel = systemById.get('coppiceWoodFuel');
  const marketGardenIntensive = systemById.get('marketGardenIntensive');
  const annualLowFuel = systemById.get('annualLowFuel');

  return PERMACULTURE_ADOPTION_SCENARIOS.map((scenario) => {
    const transitionedHa = regional.estimatedHumanFoodProducingHa * scenario.shareOfHumanFoodProducingHaTransitioned;
    const annualHa = regional.estimatedHumanFoodProducingHa - transitionedHa;

    const transitionedComponents = [
      { share: scenario.matureSystemShare, system: maturePermaculture },
      { share: scenario.orchardNutShare, system: orchardNutPolyculture },
      { share: scenario.coppiceWoodFuelShare, system: coppiceWoodFuel },
      { share: scenario.marketGardenShare, system: marketGardenIntensive }
    ];

    const transitionedShareSum = transitionedComponents.reduce((a, b) => a + b.share, 0);
    const normalizedTransitionedComponents = transitionedComponents.map((c) => ({ ...c, share: transitionedShareSum > 0 ? c.share / transitionedShareSum : 0 }));

    const matureTransitionLabourDays = normalizedTransitionedComponents.reduce((acc, c) => {
      if (!c.system) return acc;
      const ha = transitionedHa * c.share;
      return acc + ha * c.system.labourDaysPerHaAtMaturity;
    }, 0);

    const transitionedFoodGJ = normalizedTransitionedComponents.reduce((acc, c) => {
      if (!c.system) return acc;
      const ha = transitionedHa * c.share;
      return acc + ha * c.system.annualFoodEnergyGJPerHaAtMaturity;
    }, 0);

    const annualFoodHaMixShare = clamp01(scenario.annualStapleShare + (1 - scenario.shareOfHumanFoodProducingHaTransitioned) * 0.1);
    const annualMixSystem = annualLowFuel;
    const annualLabourDays = annualHa * annualMixSystem.labourDaysPerHaAtMaturity * (0.9 + annualFoodHaMixShare * 0.2);
    const annualFoodGJ = annualHa * annualMixSystem.annualFoodEnergyGJPerHaAtMaturity;

    const establishmentLabourDays = normalizedTransitionedComponents.reduce((acc, c) => {
      if (!c.system) return acc;
      const ha = transitionedHa * c.share;
      return acc + ha * c.system.establishmentLabourDaysPerHa;
    }, 0);

    const totalLabourDaysAtMaturity = matureTransitionLabourDays + annualLabourDays;
    const totalFoodEnergyGJAtMaturity = transitionedFoodGJ + annualFoodGJ;
    const foodWorkerFTEAtMaturity = totalLabourDaysAtMaturity / foodWorkerDaysPerYear;
    const labourDeficitDaysAtMaturity = Math.max(0, totalLabourDaysAtMaturity - lowFuelAvailableLabourDays);
    const effectiveProductiveHaPerWorker = foodWorkerFTEAtMaturity > 0 ? regional.estimatedHumanFoodProducingHa / foodWorkerFTEAtMaturity : 0;
    const lowFuelHaPerWorker = lowFuelRequiredLabourDays > 0 ? regional.estimatedHumanFoodProducingHa / (lowFuelRequiredLabourDays / foodWorkerDaysPerYear) : 0;
    const permacultureLeverageMultiplier = lowFuelHaPerWorker > 0 ? effectiveProductiveHaPerWorker / lowFuelHaPerWorker : 1;
    const yearsUntilMaturity = scenario.establishmentYears;

    return {
      scenario: scenario.scenario,
      transitionedHa,
      establishmentLabourDays,
      matureMaintenanceLabourDays: matureTransitionLabourDays,
      matureHarvestLabourDays: maturedHarvestDaysEstimate(normalizedTransitionedComponents, transitionedHa),
      totalLabourDaysAtMaturity,
      totalFoodEnergyGJAtMaturity,
      foodWorkerFTEAtMaturity,
      labourDeficitDaysAtMaturity,
      effectiveProductiveHaPerWorker,
      permacultureLeverageMultiplier,
      yearsUntilMaturity,
      caveats: 'Transition requires establishment labour, skill, and time; not magic yield.',
      notes: scenario.notes
    };
  });
}

function maturedHarvestDaysEstimate(components, transitionedHa) {
  return components.reduce((acc, c) => {
    if (!c.system) return acc;
    const ha = transitionedHa * c.share;
    return acc + ha * c.system.annualFoodEnergyGJPerHaAtMaturity * c.system.harvestLabourDaysPerGJ;
  }, 0);
}

export function buildGreyLabourLandBaselineReport(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  const inputDir = path.resolve(options.inputDir ?? 'know/input/gis');
  const defaults = { ...DEFAULTS, ...(options.defaults ?? {}) };
  fs.mkdirSync(produceDir, { recursive: true });

  const warnings = [];

  const landAccessJsonPath = path.join(produceDir, 'grey-land-access-baseline.json');
  const landAccessMunicipalCsvPath = path.join(produceDir, 'grey-land-access-municipality-summary.csv');
  const lotsPath = path.join(inputDir, 'lots-and-concessions-grey.geojson');

  const landAccess = readJson(landAccessJsonPath, warnings);
  const landAccessMunicipalRows = readCsv(landAccessMunicipalCsvPath, warnings);
  const lotsGeo = readJson(lotsPath, warnings);

  if (!lotsGeo || !Array.isArray(lotsGeo.features) || lotsGeo.features.length === 0) {
    warnings.push('Missing lots-and-concessions-grey.geojson. Run: npm run grey:download-data -- --source=lots-and-concessions-grey');
  }

  const byMunicipalityLandAccess = new Map();
  for (const row of landAccessMunicipalRows) byMunicipalityLandAccess.set(row.municipalityName, row);

  const municipalityRows = [];
  const areaShares = defaults.areaShares;

  for (const node of greyCountySeedNodes) {
    const m = byMunicipalityLandAccess.get(node.municipalityName) ?? {};

    const productiveLotConcessionCount = n(m.ruralFoodAccessOpportunity ?? 0) + n(m.cooperativeLandAccessCandidate ?? 0) + n(m.settlementGardenOpportunity ?? 0);
    const ruralFoodAccessOpportunityCount = n(m.ruralFoodAccessOpportunity ?? 0);
    const cooperativeLandAccessCandidateCount = n(m.cooperativeLandAccessCandidate ?? 0);
    const settlementGardenOpportunityCount = n(m.settlementGardenOpportunity ?? 0);
    const constrainedLandCount = n(m.constrainedLand ?? 0);
    const lowAccessRuralCount = n(m.lowAccessRural ?? 0);

    const population = node.population2021;
    const categories = estimatePopulationCategories({
      population2021: population,
      municipalityName: node.municipalityName,
      municipalityType: node.municipalityType,
      densityPerKm2: node.densityPerKm2,
      settlementFeatureCount: n(m.settlementLots ?? 0),
      productiveLotConcessionCount,
      settlementGardenOpportunityCount,
      cooperativeLandAccessCandidateCount,
      constrainedLandCount
    });

    const totalLots = n(m.lotConcessionFeatures ?? 0);
    const productiveShare = totalLots > 0 ? clamp01(productiveLotConcessionCount / totalLots) : clamp01((node.urbanShare ? (1 - node.urbanShare) * 0.55 : 0.3));
    const constrainedShare = totalLots > 0 ? clamp01(constrainedLandCount / totalLots) : 0;

    const estimatedProductiveLandHa = Math.max(0, node.landAreaKm2 * 100 * productiveShare * (1 - constrainedShare * 0.4));
    const estimatedHumanFoodProducingHa = estimatedProductiveLandHa * areaShares.humanFood;
    const estimatedPastureFodderHa = estimatedProductiveLandHa * areaShares.pastureFodder;
    const estimatedWoodEnergyHa = estimatedProductiveLandHa * areaShares.woodEnergy;

    const ruralAccessPopulation = categories.ruralProductiveLandAccessPopulation + categories.agriculturalLotAccessPopulation;
    const noDirectLandAccessShare = population > 0 ? categories.noDirectLandAccessPopulation / population : 0;
    const constrainedLotsShare = totalLots > 0 ? constrainedLandCount / totalLots : 0;

    const availableFoodLabourDaysByCategory = {
      urbanNoLand: categories.noDirectLandAccessPopulation * defaults.labourDaysByCategory.urbanNoLand,
      townVillage: categories.townVillageSettlementPopulation * defaults.labourDaysByCategory.townVillage,
      hamlet: categories.hamletSettlementPopulation * defaults.labourDaysByCategory.hamlet,
      ruralNonFarm: categories.ruralNonFarmPopulation * defaults.labourDaysByCategory.ruralNonFarm,
      ruralProductive: categories.ruralProductiveLandAccessPopulation * defaults.labourDaysByCategory.ruralProductive,
      agriculturalLotAccess: categories.agriculturalLotAccessPopulation * defaults.labourDaysByCategory.agriculturalLotAccess
    };

    const availableFoodLabourDays = Object.values(availableFoodLabourDaysByCategory).reduce((s, v) => s + v, 0);
    const availableFoodWorkerFTE = availableFoodLabourDays / defaults.foodWorkerDaysPerYear;

    municipalityRows.push({
      municipalityName: node.municipalityName,
      population2021: population,
      urbanSettlementPopulation: categories.urbanSettlementPopulation,
      townVillageSettlementPopulation: categories.townVillageSettlementPopulation,
      hamletSettlementPopulation: categories.hamletSettlementPopulation,
      ruralNonFarmPopulation: categories.ruralNonFarmPopulation,
      ruralProductiveLandAccessPopulation: categories.ruralProductiveLandAccessPopulation,
      agriculturalLotAccessPopulation: categories.agriculturalLotAccessPopulation,
      noDirectLandAccessPopulation: categories.noDirectLandAccessPopulation,
      noDirectLandAccessShare,
      productiveLotConcessionCount,
      ruralFoodAccessOpportunityCount,
      cooperativeLandAccessCandidateCount,
      settlementGardenOpportunityCount,
      constrainedLandCount,
      lowAccessRuralCount,
      estimatedProductiveLandHa,
      estimatedHumanFoodProducingHa,
      estimatedPastureFodderHa,
      estimatedWoodEnergyHa,
      productiveHaPerPerson: population > 0 ? estimatedProductiveLandHa / population : 0,
      productiveHaPerRuralAccessPerson: ruralAccessPopulation > 0 ? estimatedProductiveLandHa / ruralAccessPopulation : 0,
      ruralAccessPeoplePerProductiveHa: estimatedProductiveLandHa > 0 ? ruralAccessPopulation / estimatedProductiveLandHa : 0,
      totalPeoplePerProductiveHa: estimatedProductiveLandHa > 0 ? population / estimatedProductiveLandHa : 0,
      foodProducingHouseholdsEstimate: Math.round(ruralAccessPopulation / (node.averageHouseholdSizeEstimate || 2.4)),
      productiveLotsPer1000Residents: population > 0 ? (productiveLotConcessionCount / population) * 1000 : 0,
      ruralFoodAccessLotsPer1000Residents: population > 0 ? (ruralFoodAccessOpportunityCount / population) * 1000 : 0,
      constrainedLotsShare,
      availableFoodLabourDaysByCategory,
      availableFoodLabourDays,
      availableFoodWorkerFTE,
      labourAccessConfidence: categories.confidence,
      areaMethod: 'censusAreaWeightedByLotOpportunityShare',
      notes: 'Population split is heuristicEstimate; lots/concessions are not ownership parcels.'
    });
  }

  const regional = municipalityRows.reduce((acc, row) => {
    acc.totalPopulation2021 += row.population2021;
    acc.estimatedNoDirectLandAccessPopulation += row.noDirectLandAccessPopulation;
    acc.estimatedRuralProductiveLandAccessPopulation += row.ruralProductiveLandAccessPopulation + row.agriculturalLotAccessPopulation;
    acc.estimatedProductiveLandHa += row.estimatedProductiveLandHa;
    acc.estimatedHumanFoodProducingHa += row.estimatedHumanFoodProducingHa;
    acc.estimatedPastureFodderHa += row.estimatedPastureFodderHa;
    acc.estimatedWoodEnergyHa += row.estimatedWoodEnergyHa;
    acc.totalAvailableFoodLabourDays += row.availableFoodLabourDays;
    return acc;
  }, {
    totalPopulation2021: 0,
    estimatedNoDirectLandAccessPopulation: 0,
    estimatedRuralProductiveLandAccessPopulation: 0,
    estimatedProductiveLandHa: 0,
    estimatedHumanFoodProducingHa: 0,
    estimatedPastureFodderHa: 0,
    estimatedWoodEnergyHa: 0,
    totalAvailableFoodLabourDays: 0
  });

  regional.productiveHaPerPerson = regional.totalPopulation2021 > 0 ? regional.estimatedProductiveLandHa / regional.totalPopulation2021 : 0;
  regional.productiveHaPerRuralAccessPerson = regional.estimatedRuralProductiveLandAccessPopulation > 0
    ? regional.estimatedProductiveLandHa / regional.estimatedRuralProductiveLandAccessPopulation : 0;
  regional.availableFoodWorkerFTE = regional.totalAvailableFoodLabourDays / defaults.foodWorkerDaysPerYear;

  const scenarios = defaults.scenarios.map((s) => {
    const requiredFoodLabourDays = regional.estimatedHumanFoodProducingHa * s.labourDaysPerHumanFoodHa * s.humanLabourMultiplier;
    const availableFoodLabourDays = regional.totalAvailableFoodLabourDays;
    const labourDeficitDays = Math.max(0, requiredFoodLabourDays - availableFoodLabourDays);
    const requiredFoodWorkerFTE = requiredFoodLabourDays / defaults.foodWorkerDaysPerYear;
    const availableFoodWorkerFTE = availableFoodLabourDays / defaults.foodWorkerDaysPerYear;
    const productiveHaPerFoodWorker = requiredFoodWorkerFTE > 0 ? regional.estimatedHumanFoodProducingHa / requiredFoodWorkerFTE : 0;
    const foodWorkersNeededPer100Ha = regional.estimatedHumanFoodProducingHa > 0 ? (requiredFoodWorkerFTE / regional.estimatedHumanFoodProducingHa) * 100 : 0;

    return {
      ...s,
      requiredFoodLabourDays,
      availableFoodLabourDays,
      labourDeficitDays,
      requiredFoodWorkerFTE,
      availableFoodWorkerFTE,
      productiveHaPerFoodWorker,
      foodWorkersNeededPer100Ha,
      additionalHumansNeededVsCurrent: 0,
      additionalFoodLabourDaysNeededVsCurrent: 0,
      fossilFuelLeverageRatio: 1,
      notes: s.notes
    };
  });

  const current = scenarios.find((s) => s.scenario === 'currentMechanized') ?? scenarios[0];
  const lowFuelScenario = scenarios.find((s) => s.scenario === 'lowFuelMixed') ?? scenarios[2] ?? scenarios[0];

  for (const s of scenarios) {
    s.additionalFoodLabourDaysNeededVsCurrent = Math.max(0, s.requiredFoodLabourDays - current.requiredFoodLabourDays);
    s.additionalHumansNeededVsCurrent = Math.max(0, s.requiredFoodWorkerFTE - current.requiredFoodWorkerFTE);
    s.fossilFuelLeverageRatio = s.productiveHaPerFoodWorker > 0 ? current.productiveHaPerFoodWorker / s.productiveHaPerFoodWorker : 0;
  }

  for (const row of municipalityRows) {
    row.currentMechanizedRequiredFoodLabourDays = row.estimatedHumanFoodProducingHa * current.labourDaysPerHumanFoodHa * current.humanLabourMultiplier;
    row.lowFuelRequiredFoodLabourDays = row.estimatedHumanFoodProducingHa * lowFuelScenario.labourDaysPerHumanFoodHa * lowFuelScenario.humanLabourMultiplier;
    row.lowFuelLabourDeficitDays = Math.max(0, row.lowFuelRequiredFoodLabourDays - row.availableFoodLabourDays);
    row.lowFuelFoodWorkersNeeded = row.lowFuelRequiredFoodLabourDays / defaults.foodWorkerDaysPerYear;
    row.additionalHumansNeededVsCurrent = Math.max(0,
      row.lowFuelRequiredFoodLabourDays / defaults.foodWorkerDaysPerYear - row.currentMechanizedRequiredFoodLabourDays / defaults.foodWorkerDaysPerYear);
  }

  const annualLowFuelBase = {
    ...PRODUCTION_SYSTEMS.find((s) => s.system === 'annualLowFuel')
  };
  const annualLowFuelEvaluated = evaluateProductionSystem(annualLowFuelBase, {
    foodWorkerDaysPerYear: defaults.foodWorkerDaysPerYear,
    lowFuelAnnualBaseline: {
      ...annualLowFuelBase,
      manageableHaPerWorkerAtMaturity: defaults.foodWorkerDaysPerYear / (annualLowFuelBase.maintenanceLabourDaysPerHa + annualLowFuelBase.annualFoodEnergyGJPerHaAtMaturity * annualLowFuelBase.harvestLabourDaysPerGJ),
      foodEnergyGJPerLabourDayAtMaturity: annualLowFuelBase.annualFoodEnergyGJPerHaAtMaturity / (annualLowFuelBase.maintenanceLabourDaysPerHa + annualLowFuelBase.annualFoodEnergyGJPerHaAtMaturity * annualLowFuelBase.harvestLabourDaysPerGJ),
      inputDependencyIndex: annualLowFuelBase.inputDependencyIndex,
      annualFoodEnergyGJPerHaAtMaturity: annualLowFuelBase.annualFoodEnergyGJPerHaAtMaturity
    },
    annualReferenceLabourDaysPerHa: annualLowFuelBase.maintenanceLabourDaysPerHa + annualLowFuelBase.annualFoodEnergyGJPerHaAtMaturity * annualLowFuelBase.harvestLabourDaysPerGJ,
    annualReferencePeakHarvestShare: Math.max(...Object.values(normalizeHarvestDistribution(annualLowFuelBase.harvestDistribution)))
  });

  const productionSystemLeverage = PRODUCTION_SYSTEMS.map((system) => evaluateProductionSystem(system, {
    foodWorkerDaysPerYear: defaults.foodWorkerDaysPerYear,
    lowFuelAnnualBaseline: annualLowFuelEvaluated,
    annualReferenceLabourDaysPerHa: annualLowFuelEvaluated.labourDaysPerHaAtMaturity,
    annualReferencePeakHarvestShare: annualLowFuelEvaluated.peakHarvestShare
  }));

  const systemById = new Map(productionSystemLeverage.map((s) => [s.system, s]));

  const permacultureAdoptionScenarios = buildPermacultureScenarioRows({
    regional,
    foodWorkerDaysPerYear: defaults.foodWorkerDaysPerYear,
    lowFuelRequiredLabourDays: lowFuelScenario.requiredFoodLabourDays,
    lowFuelAvailableLabourDays: lowFuelScenario.availableFoodLabourDays,
    systemById
  });

  const harvestWindowDiagnostics = {
    annualLowFuel: {
      peakHarvestShare: annualLowFuelEvaluated.peakHarvestShare,
      harvestConcentrationIndex: annualLowFuelEvaluated.harvestConcentrationIndex,
      rollingHarvestAdvantage: annualLowFuelEvaluated.rollingHarvestAdvantage
    },
    maturePermaculture: {
      peakHarvestShare: systemById.get('maturePermaculture')?.peakHarvestShare ?? 0,
      harvestConcentrationIndex: systemById.get('maturePermaculture')?.harvestConcentrationIndex ?? 0,
      rollingHarvestAdvantage: systemById.get('maturePermaculture')?.rollingHarvestAdvantage ?? 0
    }
  };

  const json = {
    generatedAt: new Date().toISOString(),
    assumptions: {
      populationDistributionMethod: 'heuristicEstimate',
      areaMethod: 'censusAreaWeightedByLotOpportunityShare',
      labourDaysByCategory: defaults.labourDaysByCategory,
      foodWorkerDaysPerYear: defaults.foodWorkerDaysPerYear,
      caveat: 'Lots and concessions are not ownership parcels; this is a coarse baseline estimate.'
    },
    warnings,
    regionalIndicators: {
      ...regional,
      lowFuelFoodWorkersNeeded: lowFuelScenario.requiredFoodWorkerFTE,
      lowFuelLabourDeficitDays: lowFuelScenario.labourDeficitDays,
      fossilFuelLeverageRatio: lowFuelScenario.fossilFuelLeverageRatio
    },
    municipalityIndicators: municipalityRows,
    scenarios,
    productionSystemLeverage,
    permacultureAdoptionScenarios,
    harvestWindowDiagnostics,
    caveats: [
      'lots/concessions are not ownership parcels',
      'no address-point population distribution yet',
      'population distribution is heuristic',
      'productive hectares are estimated from census area and lot opportunity shares',
      'labour assumptions are coarse scenario diagnostics',
      'perennial/permaculture is modelled as labour-profile change, not magic yield'
    ]
  };

  const jsonPath = path.join(produceDir, 'grey-labour-land-baseline.json');
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2));

  const municipalityCsvPath = path.join(produceDir, 'grey-labour-land-municipality-summary.csv');
  fs.writeFileSync(municipalityCsvPath, toCsv(municipalityRows, [
    'municipalityName','population2021','urbanSettlementPopulation','townVillageSettlementPopulation','hamletSettlementPopulation','ruralNonFarmPopulation','ruralProductiveLandAccessPopulation','agriculturalLotAccessPopulation','noDirectLandAccessPopulation','noDirectLandAccessShare','productiveLotConcessionCount','ruralFoodAccessOpportunityCount','cooperativeLandAccessCandidateCount','constrainedLandCount','estimatedProductiveLandHa','productiveHaPerPerson','productiveHaPerRuralAccessPerson','ruralAccessPeoplePerProductiveHa','availableFoodLabourDays','availableFoodWorkerFTE','currentMechanizedRequiredFoodLabourDays','lowFuelRequiredFoodLabourDays','lowFuelLabourDeficitDays','lowFuelFoodWorkersNeeded','additionalHumansNeededVsCurrent','notes'
  ]));

  const scenarioCsvPath = path.join(produceDir, 'grey-labour-land-scenarios.csv');
  fs.writeFileSync(scenarioCsvPath, toCsv(scenarios, [
    'scenario','machinerySupportFactor','fuelInputIndex','labourDaysPerHumanFoodHa','requiredFoodLabourDays','availableFoodLabourDays','labourDeficitDays','requiredFoodWorkerFTE','availableFoodWorkerFTE','productiveHaPerFoodWorker','foodWorkersNeededPer100Ha','additionalHumansNeededVsCurrent','fossilFuelLeverageRatio','notes'
  ]));

  const permacultureSystemsCsvPath = path.join(produceDir, 'grey-labour-land-permaculture-systems.csv');
  fs.writeFileSync(permacultureSystemsCsvPath, toCsv(productionSystemLeverage, [
    'system','establishmentYears','establishmentLabourDaysPerHa','labourDaysPerHaAtMaturity','annualFoodEnergyGJPerHaAtMaturity','foodEnergyGJPerLabourDayAtMaturity','manageableHaPerWorkerAtMaturity','harvestWindowDays','peakHarvestShare','rollingHarvestAdvantage','manageableHaMultiplierVsLowFuelAnnual','yearsUntilNetLabourAdvantage','notes'
  ]));

  const permacultureScenariosCsvPath = path.join(produceDir, 'grey-labour-land-permaculture-scenarios.csv');
  fs.writeFileSync(permacultureScenariosCsvPath, toCsv(permacultureAdoptionScenarios, [
    'scenario','transitionedHa','establishmentLabourDays','totalLabourDaysAtMaturity','totalFoodEnergyGJAtMaturity','foodWorkerFTEAtMaturity','labourDeficitDaysAtMaturity','effectiveProductiveHaPerWorker','permacultureLeverageMultiplier','yearsUntilMaturity','caveats'
  ]));

  const markdown = [
    '# Grey County Labour-to-Productive-Land Baseline',
    '',
    '## What this is',
    'This report estimates how people are distributed relative to productive land access using Census population, settlement boundaries, Official Plan land use, and lots/concessions.',
    '',
    '## Why it matters',
    'Fossil fuels and machinery let fewer people manage more hectares. As fuel/input/machinery support declines, human labour per hectare must rise.',
    '',
    '## Key regional indicators',
    `- totalPopulation2021: ${regional.totalPopulation2021}`,
    `- estimatedNoDirectLandAccessPopulation: ${regional.estimatedNoDirectLandAccessPopulation}`,
    `- estimatedRuralProductiveLandAccessPopulation: ${regional.estimatedRuralProductiveLandAccessPopulation}`,
    `- estimatedProductiveLandHa: ${regional.estimatedProductiveLandHa.toFixed(2)}`,
    `- productiveHaPerPerson: ${regional.productiveHaPerPerson.toFixed(4)}`,
    `- productiveHaPerRuralAccessPerson: ${regional.productiveHaPerRuralAccessPerson.toFixed(4)}`,
    `- availableFoodWorkerFTE: ${regional.availableFoodWorkerFTE.toFixed(2)}`,
    `- lowFuelFoodWorkersNeeded: ${lowFuelScenario.requiredFoodWorkerFTE.toFixed(2)}`,
    `- lowFuelLabourDeficitDays: ${lowFuelScenario.labourDeficitDays.toFixed(2)}`,
    `- fossilFuelLeverageRatio: ${lowFuelScenario.fossilFuelLeverageRatio.toFixed(3)}`,
    '',
    '## Municipality comparison',
    '| Municipality | Population | No direct land access share | Productive land access population | Estimated productive ha | Productive ha per rural-access person | Available food worker FTE | Low-fuel worker need | Low-fuel labour deficit |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...municipalityRows.map((r) => `| ${r.municipalityName} | ${r.population2021} | ${r.noDirectLandAccessShare.toFixed(3)} | ${(r.ruralProductiveLandAccessPopulation + r.agriculturalLotAccessPopulation)} | ${r.estimatedProductiveLandHa.toFixed(2)} | ${r.productiveHaPerRuralAccessPerson.toFixed(3)} | ${r.availableFoodWorkerFTE.toFixed(2)} | ${r.lowFuelFoodWorkersNeeded.toFixed(2)} | ${r.lowFuelLabourDeficitDays.toFixed(2)} |`),
    '',
    '## Mechanization scenarios',
    '| Scenario | Machinery support | Fuel input index | Labour days per human-food ha | Required labour days | Available labour days | Labour deficit days | Required worker FTE | Available worker FTE | Productive ha per worker | Workers per 100 ha | Additional humans vs current | Fossil fuel leverage ratio |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...scenarios.map((s) => `| ${s.scenario} | ${s.machinerySupportFactor.toFixed(2)} | ${s.fuelInputIndex.toFixed(2)} | ${s.labourDaysPerHumanFoodHa.toFixed(2)} | ${s.requiredFoodLabourDays.toFixed(2)} | ${s.availableFoodLabourDays.toFixed(2)} | ${s.labourDeficitDays.toFixed(2)} | ${s.requiredFoodWorkerFTE.toFixed(2)} | ${s.availableFoodWorkerFTE.toFixed(2)} | ${s.productiveHaPerFoodWorker.toFixed(4)} | ${s.foodWorkersNeededPer100Ha.toFixed(4)} | ${s.additionalHumansNeededVsCurrent.toFixed(2)} | ${s.fossilFuelLeverageRatio.toFixed(3)} |`),
    '',
    '## Perennial and permaculture labour leverage',
    'Perennial systems can reduce recurring labour and smooth seasonal peaks once established, but require design, establishment labour, time to maturity, and skill. This is a labour-profile change model, not magic yield.',
    '',
    '| Production system | Establishment years | Labour days/ha at maturity | GJ/ha at maturity | Manageable ha/worker | Harvest window | Leverage vs low-fuel annual | Main bottleneck |',
    '|---|---:|---:|---:|---:|---:|---:|---|',
    ...productionSystemLeverage.map((s) => `| ${s.system} | ${s.establishmentYears} | ${s.labourDaysPerHaAtMaturity.toFixed(2)} | ${s.annualFoodEnergyGJPerHaAtMaturity.toFixed(2)} | ${s.manageableHaPerWorkerAtMaturity.toFixed(3)} | ${s.harvestWindowDays} | ${s.manageableHaMultiplierVsLowFuelAnnual.toFixed(3)} | ${s.establishmentBottleneckWarning ? 'Establishment labour and skill' : 'Seasonal harvest concentration'} |`),
    '',
    '## Caveats',
    '- lots/concessions are not ownership parcels',
    '- no address-point population distribution yet',
    '- population distribution is heuristic',
    '- productive hectares are estimated from census area and lot opportunity shares',
    '- labour assumptions are coarse scenario diagnostics',
    '- output is a scenario baseline, not a farm-capacity study',
    '- perennial/permaculture requires establishment labour and skill; this is not magic yield',
    ...(warnings.length > 0 ? ['', '## Warnings', ...warnings.map((w) => `- ${w}`)] : [])
  ].join('\n');

  const markdownPath = path.join(produceDir, 'grey-labour-land-baseline.md');
  fs.writeFileSync(markdownPath, markdown);

  return {
    report: json,
    paths: { markdownPath, jsonPath, municipalityCsvPath, scenarioCsvPath, permacultureSystemsCsvPath, permacultureScenariosCsvPath }
  };
}
