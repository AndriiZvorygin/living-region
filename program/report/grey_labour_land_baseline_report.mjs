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

const RURAL_PRIORITY = new Set(['West Grey', 'Grey Highlands', 'Southgate', 'Chatsworth', 'Georgian Bluffs', 'Meaford', 'The Blue Mountains']);

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

  // Normalize subshares to remaining population.
  const subTotal = pTownVillage + pHamlet + pAgLot + pRuralProductive;
  if (subTotal > remaining && subTotal > 0) {
    const scale = remaining / subTotal;
    pTownVillage *= scale;
    pHamlet *= scale;
    pAgLot *= scale;
    pRuralProductive *= scale;
  }
  const pRuralNonFarm = Math.max(0, 1 - (pUrban + pTownVillage + pHamlet + pAgLot + pRuralProductive));

  const noDirectLandAccessPopulation = roundInt(population2021 * pUrban);
  let townVillageSettlementPopulation = roundInt(population2021 * pTownVillage);
  let hamletSettlementPopulation = roundInt(population2021 * pHamlet);
  let agriculturalLotAccessPopulation = roundInt(population2021 * pAgLot);
  let ruralProductiveLandAccessPopulation = roundInt(population2021 * pRuralProductive);
  let ruralNonFarmPopulation = 0;
  let urbanSettlementPopulation = 0;

  // Reconcile rounding overflow before assigning residual.
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

  // Ensure exact reconciliation by assigning residual to ruralNonFarm bucket.
  ruralNonFarmPopulation = Math.max(0, population2021 - provisionalWithoutRuralNonFarm);
  urbanSettlementPopulation = noDirectLandAccessPopulation;

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
  for (const row of landAccessMunicipalRows) {
    byMunicipalityLandAccess.set(row.municipalityName, row);
  }

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

  for (const row of municipalityRows) {
    const sumPop = row.urbanSettlementPopulation + row.townVillageSettlementPopulation + row.hamletSettlementPopulation
      + row.ruralNonFarmPopulation + row.ruralProductiveLandAccessPopulation + row.agriculturalLotAccessPopulation + row.noDirectLandAccessPopulation;
    const delta = row.population2021 - sumPop;
    if (delta !== 0) row.ruralNonFarmPopulation = Math.max(0, row.ruralNonFarmPopulation + delta);
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
  const lowFuel = scenarios.find((s) => s.scenario === 'lowFuelMixed') ?? scenarios[2] ?? scenarios[0];

  for (const s of scenarios) {
    s.additionalFoodLabourDaysNeededVsCurrent = Math.max(0, s.requiredFoodLabourDays - current.requiredFoodLabourDays);
    s.additionalHumansNeededVsCurrent = Math.max(0, s.requiredFoodWorkerFTE - current.requiredFoodWorkerFTE);
    s.fossilFuelLeverageRatio = s.productiveHaPerFoodWorker > 0 ? current.productiveHaPerFoodWorker / s.productiveHaPerFoodWorker : 0;
  }

  const lowFuelScenario = scenarios.find((s) => s.scenario === 'lowFuelMixed') ?? lowFuel;

  for (const row of municipalityRows) {
    row.currentMechanizedRequiredFoodLabourDays = row.estimatedHumanFoodProducingHa * current.labourDaysPerHumanFoodHa * current.humanLabourMultiplier;
    row.lowFuelRequiredFoodLabourDays = row.estimatedHumanFoodProducingHa * lowFuelScenario.labourDaysPerHumanFoodHa * lowFuelScenario.humanLabourMultiplier;
    row.lowFuelLabourDeficitDays = Math.max(0, row.lowFuelRequiredFoodLabourDays - row.availableFoodLabourDays);
    row.lowFuelFoodWorkersNeeded = row.lowFuelRequiredFoodLabourDays / defaults.foodWorkerDaysPerYear;
    row.additionalHumansNeededVsCurrent = Math.max(0,
      row.lowFuelRequiredFoodLabourDays / defaults.foodWorkerDaysPerYear - row.currentMechanizedRequiredFoodLabourDays / defaults.foodWorkerDaysPerYear);
  }

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
      fossilFuelLeverageRatio: scenarios.find((s) => s.scenario === 'lowFuelMixed')?.fossilFuelLeverageRatio ?? 1
    },
    municipalityIndicators: municipalityRows,
    scenarios
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
    `- fossilFuelLeverageRatio: ${(scenarios.find((s) => s.scenario === 'lowFuelMixed')?.fossilFuelLeverageRatio ?? 1).toFixed(3)}`,
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
    '## Caveats',
    '- lots/concessions are not ownership parcels',
    '- no address-point population distribution yet',
    '- population distribution is heuristic',
    '- productive hectares are estimated from census area and lot opportunity shares',
    '- labour assumptions are coarse scenario diagnostics',
    '- output is a scenario baseline, not a farm-capacity study',
    ...(warnings.length > 0 ? ['', '## Warnings', ...warnings.map((w) => `- ${w}`)] : [])
  ].join('\n');

  const markdownPath = path.join(produceDir, 'grey-labour-land-baseline.md');
  fs.writeFileSync(markdownPath, markdown);

  return {
    report: json,
    paths: { markdownPath, jsonPath, municipalityCsvPath, scenarioCsvPath }
  };
}
