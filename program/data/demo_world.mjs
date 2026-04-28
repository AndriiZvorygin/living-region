// SPDX-License-Identifier: AGPL-3.0-or-later
import { createWorld } from '../model/world.mjs';
import { createPatch } from '../model/patch.mjs';
import { createPlantGroup } from '../model/plant_group.mjs';
import { createHousehold } from '../model/household.mjs';
import { createBuilding } from '../model/building.mjs';
import { createInfrastructure } from '../model/infrastructure.mjs';
import { createSettlement } from '../model/settlement.mjs';
import { createNetwork } from '../model/network.mjs';
import { createMarket } from '../model/market.mjs';

function createPatchRecords() {
  return [
    createPatch({ id: 'patch-downtown', name: 'Downtown Mixed Use', areaHa: 35, landUse: 'mixed', zoning: 'urban-core', ownershipType: 'mixed', soil: { nitrogen: 0.45, phosphorus: 0.4, potassium: 0.45, carbon: 0.35, moisture: 0.55 }, conditions: { sun: 0.75, slope: 0.08, waterAccess: 0.8, access: 0.95 }, distance: { nearestRoadKm: 0.1, nearestSettlementKm: 0.1, nearestMarketKm: 0.1 } }),
    createPatch({ id: 'patch-old-res', name: 'Older Residential', areaHa: 45, landUse: 'residential', zoning: 'residential', soil: { nitrogen: 0.5, phosphorus: 0.45, potassium: 0.5, carbon: 0.45, moisture: 0.6 }, conditions: { sun: 0.78, slope: 0.07, waterAccess: 0.85, access: 0.9 }, distance: { nearestRoadKm: 0.2, nearestSettlementKm: 0.2, nearestMarketKm: 0.4 } }),
    createPatch({ id: 'patch-suburb', name: 'Suburban Residential', areaHa: 60, landUse: 'residential', zoning: 'residential', soil: { nitrogen: 0.55, phosphorus: 0.5, potassium: 0.55, carbon: 0.5, moisture: 0.6 }, conditions: { sun: 0.82, slope: 0.05, waterAccess: 0.82, access: 0.82 }, distance: { nearestRoadKm: 0.3, nearestSettlementKm: 0.6, nearestMarketKm: 0.9 } }),
    createPatch({ id: 'patch-village-lots', name: 'Village Lots', areaHa: 55, landUse: 'mixed', zoning: 'village', soil: { nitrogen: 0.62, phosphorus: 0.58, potassium: 0.6, carbon: 0.55, moisture: 0.65 }, conditions: { sun: 0.86, slope: 0.12, waterAccess: 0.8, access: 0.7 }, distance: { nearestRoadKm: 0.5, nearestSettlementKm: 0.1, nearestMarketKm: 4 } }),
    createPatch({ id: 'patch-grain', name: 'Annual Grain', areaHa: 120, landUse: 'cropland', zoning: 'agriculture', soil: { nitrogen: 0.72, phosphorus: 0.7, potassium: 0.68, carbon: 0.56, moisture: 0.62 }, conditions: { sun: 0.92, slope: 0.06, waterAccess: 0.7, access: 0.72 }, distance: { nearestRoadKm: 0.7, nearestSettlementKm: 5, nearestMarketKm: 8 } }),
    createPatch({ id: 'patch-roots', name: 'Potatoes Root Crops', areaHa: 95, landUse: 'cropland', zoning: 'agriculture', soil: { nitrogen: 0.75, phosphorus: 0.72, potassium: 0.7, carbon: 0.6, moisture: 0.7 }, conditions: { sun: 0.88, slope: 0.08, waterAccess: 0.85, access: 0.7 }, distance: { nearestRoadKm: 0.8, nearestSettlementKm: 5.5, nearestMarketKm: 8.5 } }),
    createPatch({ id: 'patch-pasture', name: 'Pasture', areaHa: 140, landUse: 'pasture', zoning: 'agriculture', soil: { nitrogen: 0.65, phosphorus: 0.6, potassium: 0.6, carbon: 0.65, moisture: 0.68 }, conditions: { sun: 0.85, slope: 0.1, waterAccess: 0.75, access: 0.65 }, distance: { nearestRoadKm: 1.2, nearestSettlementKm: 6, nearestMarketKm: 9.5 } }),
    createPatch({ id: 'patch-woodland', name: 'Woodland', areaHa: 170, landUse: 'woodland', zoning: 'forest', soil: { nitrogen: 0.58, phosphorus: 0.56, potassium: 0.55, carbon: 0.78, moisture: 0.72 }, conditions: { sun: 0.7, slope: 0.18, waterAccess: 0.82, access: 0.5 }, distance: { nearestRoadKm: 1.8, nearestSettlementKm: 7, nearestMarketKm: 10.5 } }),
    createPatch({ id: 'patch-orchard', name: 'Orchard Nut Grove', areaHa: 80, landUse: 'cropland', zoning: 'agriculture', soil: { nitrogen: 0.66, phosphorus: 0.62, potassium: 0.63, carbon: 0.67, moisture: 0.66 }, conditions: { sun: 0.84, slope: 0.1, waterAccess: 0.7, access: 0.66 }, distance: { nearestRoadKm: 1.1, nearestSettlementKm: 4.5, nearestMarketKm: 7.5 } }),
    createPatch({ id: 'patch-gardens', name: 'Market Gardens', areaHa: 40, landUse: 'cropland', zoning: 'agriculture', soil: { nitrogen: 0.8, phosphorus: 0.75, potassium: 0.76, carbon: 0.62, moisture: 0.75 }, conditions: { sun: 0.9, slope: 0.05, waterAccess: 0.9, access: 0.75 }, distance: { nearestRoadKm: 0.6, nearestSettlementKm: 2.5, nearestMarketKm: 3.2 } }),
    createPatch({ id: 'patch-wetland', name: 'Marginal Wetland', areaHa: 65, landUse: 'wetland', zoning: 'ecology', soil: { nitrogen: 0.5, phosphorus: 0.45, potassium: 0.5, carbon: 0.82, moisture: 0.9 }, conditions: { sun: 0.72, slope: 0.04, waterAccess: 0.98, access: 0.35 }, distance: { nearestRoadKm: 2.2, nearestSettlementKm: 6.5, nearestMarketKm: 11 } }),
    createPatch({ id: 'patch-vacant', name: 'Vacant Edge Land', areaHa: 90, landUse: 'vacant', zoning: 'mixed', soil: { nitrogen: 0.55, phosphorus: 0.52, potassium: 0.53, carbon: 0.58, moisture: 0.61 }, conditions: { sun: 0.83, slope: 0.11, waterAccess: 0.64, access: 0.6 }, distance: { nearestRoadKm: 1.5, nearestSettlementKm: 4, nearestMarketKm: 6.5 } })
  ];
}

function createPlantGroups() {
  return [
    createPlantGroup({ id: 'pg-grain', patchId: 'patch-grain', name: 'Annual Grain Rotation', functionalType: 'annual-crop', areaShare: 0.92, ageYears: 1, traits: { maturityYears: 1, shadeTolerance: 0.3, labour: { annualCareDaysPerHa: 14, harvestDaysPerTonne: 0.7 }, yields: { caloriesPerHaAtMaturity: 2_300_000, biomassKgPerHaAtMaturity: 9_000, woodKgPerHaAtMaturity: 0 } } }),
    createPlantGroup({ id: 'pg-roots', patchId: 'patch-roots', name: 'Root Crop Mix', functionalType: 'annual-crop', areaShare: 0.9, ageYears: 1, traits: { maturityYears: 1, shadeTolerance: 0.35, labour: { annualCareDaysPerHa: 22, harvestDaysPerTonne: 1.2 }, yields: { caloriesPerHaAtMaturity: 3_000_000, biomassKgPerHaAtMaturity: 12_000, woodKgPerHaAtMaturity: 0 } } }),
    createPlantGroup({ id: 'pg-pasture', patchId: 'patch-pasture', name: 'Pasture Forage', functionalType: 'grassland', areaShare: 0.85, ageYears: 3, traits: { perennial: true, maturityYears: 2, shadeTolerance: 0.5, labour: { annualCareDaysPerHa: 6, harvestDaysPerTonne: 0.3 }, yields: { caloriesPerHaAtMaturity: 800_000, biomassKgPerHaAtMaturity: 5_500, woodKgPerHaAtMaturity: 0 } } }),
    createPlantGroup({ id: 'pg-wood', patchId: 'patch-woodland', name: 'Mixed Woodland Coppice', functionalType: 'forest', areaShare: 0.9, ageYears: 9, traits: { perennial: true, maturityYears: 8, shadeTolerance: 0.85, labour: { annualCareDaysPerHa: 3, harvestDaysPerTonne: 0.25 }, yields: { caloriesPerHaAtMaturity: 250_000, biomassKgPerHaAtMaturity: 4_000, woodKgPerHaAtMaturity: 6_500 } } }),
    createPlantGroup({ id: 'pg-orchard', patchId: 'patch-orchard', name: 'Orchard and Nut Trees', functionalType: 'orchard', areaShare: 0.82, ageYears: 6, traits: { perennial: true, maturityYears: 5, shadeTolerance: 0.65, labour: { annualCareDaysPerHa: 15, harvestDaysPerTonne: 1.4 }, yields: { caloriesPerHaAtMaturity: 1_900_000, biomassKgPerHaAtMaturity: 7_500, woodKgPerHaAtMaturity: 900 } } }),
    createPlantGroup({ id: 'pg-gardens', patchId: 'patch-gardens', name: 'Intensive Market Gardens', functionalType: 'market-garden', areaShare: 0.95, ageYears: 1, traits: { maturityYears: 1, shadeTolerance: 0.25, labour: { annualCareDaysPerHa: 35, harvestDaysPerTonne: 2.2 }, yields: { caloriesPerHaAtMaturity: 2_800_000, biomassKgPerHaAtMaturity: 11_000, woodKgPerHaAtMaturity: 0 } } }),
    createPlantGroup({ id: 'pg-village-gardens', patchId: 'patch-village-lots', name: 'Village Mixed Gardens', functionalType: 'mixed', areaShare: 0.38, ageYears: 2, traits: { perennial: true, maturityYears: 2, shadeTolerance: 0.55, labour: { annualCareDaysPerHa: 16, harvestDaysPerTonne: 1 }, yields: { caloriesPerHaAtMaturity: 1_450_000, biomassKgPerHaAtMaturity: 6_800, woodKgPerHaAtMaturity: 150 } } }),
    createPlantGroup({ id: 'pg-vacant-regrowth', patchId: 'patch-vacant', name: 'Edge Land Regrowth', functionalType: 'regrowth', areaShare: 0.45, ageYears: 4, traits: { perennial: true, maturityYears: 6, shadeTolerance: 0.7, labour: { annualCareDaysPerHa: 4, harvestDaysPerTonne: 0.35 }, yields: { caloriesPerHaAtMaturity: 420_000, biomassKgPerHaAtMaturity: 4_200, woodKgPerHaAtMaturity: 1_800 } } })
  ];
}

function createBuildingRecords() {
  return [
    createBuilding({ id: 'b-apt-1', patchId: 'patch-downtown', settlementId: 'town', type: 'apartment', dwellingUnits: 24, occupiedUnits: 23, floorAreaM2: 2800, rentPerMonth: 980, estimatedValue: 2_800_000, condition: 0.78, heatDemandKwhPerYear: 58_000, insulationLevel: 0.52, heatingSystem: 'electric', retrofitLevel: 0.22, effects: { serviceCapacity: 0.6 } }),
    createBuilding({ id: 'b-apt-2', patchId: 'patch-downtown', settlementId: 'town', type: 'apartment', dwellingUnits: 20, occupiedUnits: 19, floorAreaM2: 2200, rentPerMonth: 920, estimatedValue: 2_300_000, condition: 0.75, heatDemandKwhPerYear: 49_000, insulationLevel: 0.5, heatingSystem: 'electric', retrofitLevel: 0.2, effects: { serviceCapacity: 0.5 } }),
    createBuilding({ id: 'b-town-mixed', patchId: 'patch-downtown', settlementId: 'town', type: 'mixedUse', dwellingUnits: 10, occupiedUnits: 9, floorAreaM2: 1500, rentPerMonth: 1_050, estimatedValue: 1_900_000, condition: 0.8, heatDemandKwhPerYear: 30_000, insulationLevel: 0.46, heatingSystem: 'mixed', retrofitLevel: 0.18 }),
    createBuilding({ id: 'b-old-home-1', patchId: 'patch-old-res', settlementId: 'town', type: 'dwelling', dwellingUnits: 12, occupiedUnits: 12, floorAreaM2: 1400, rentPerMonth: 760, estimatedValue: 820_000, condition: 0.7, heatDemandKwhPerYear: 36_000, insulationLevel: 0.3, heatingSystem: 'gas', retrofitLevel: 0.08 }),
    createBuilding({ id: 'b-old-home-2', patchId: 'patch-old-res', settlementId: 'town', type: 'dwelling', dwellingUnits: 10, occupiedUnits: 10, floorAreaM2: 1180, rentPerMonth: 740, estimatedValue: 780_000, condition: 0.72, heatDemandKwhPerYear: 31_000, insulationLevel: 0.32, heatingSystem: 'gas', retrofitLevel: 0.1 }),
    createBuilding({ id: 'b-suburb-1', patchId: 'patch-suburb', settlementId: 'town', type: 'dwelling', dwellingUnits: 18, occupiedUnits: 17, floorAreaM2: 2500, rentPerMonth: 680, estimatedValue: 1_100_000, condition: 0.83, heatDemandKwhPerYear: 56_000, insulationLevel: 0.38, heatingSystem: 'oil', retrofitLevel: 0.06 }),
    createBuilding({ id: 'b-suburb-2', patchId: 'patch-suburb', settlementId: 'town', type: 'dwelling', dwellingUnits: 14, occupiedUnits: 13, floorAreaM2: 1900, rentPerMonth: 640, estimatedValue: 920_000, condition: 0.8, heatDemandKwhPerYear: 44_000, insulationLevel: 0.36, heatingSystem: 'oil', retrofitLevel: 0.05 }),
    createBuilding({ id: 'b-village-homes', patchId: 'patch-village-lots', settlementId: 'village', type: 'dwelling', dwellingUnits: 16, occupiedUnits: 10, floorAreaM2: 1700, rentPerMonth: 430, estimatedValue: 620_000, condition: 0.76, heatDemandKwhPerYear: 42_000, insulationLevel: 0.34, heatingSystem: 'wood', retrofitLevel: 0.12 }),
    createBuilding({ id: 'b-village-mixed', patchId: 'patch-village-lots', settlementId: 'village', type: 'mixedUse', dwellingUnits: 8, occupiedUnits: 6, floorAreaM2: 900, rentPerMonth: 400, estimatedValue: 360_000, condition: 0.73, heatDemandKwhPerYear: 22_000, insulationLevel: 0.35, heatingSystem: 'mixed', retrofitLevel: 0.12 }),
    createBuilding({ id: 'b-barn-grain', patchId: 'patch-grain', settlementId: 'rural', type: 'barn', dwellingUnits: 0, occupiedUnits: 0, floorAreaM2: 680, rentPerMonth: 0, estimatedValue: 220_000, condition: 0.77, heatDemandKwhPerYear: 8_000, insulationLevel: 0.2, heatingSystem: 'wood', retrofitLevel: 0.04, effects: { storageCalories: 250_000, productionCapacity: 0.6 } }),
    createBuilding({ id: 'b-barn-roots', patchId: 'patch-roots', settlementId: 'rural', type: 'barn', dwellingUnits: 0, occupiedUnits: 0, floorAreaM2: 640, rentPerMonth: 0, estimatedValue: 210_000, condition: 0.75, heatDemandKwhPerYear: 7_500, insulationLevel: 0.18, heatingSystem: 'wood', retrofitLevel: 0.03, effects: { storageCalories: 180_000, productionCapacity: 0.55 } }),
    createBuilding({ id: 'b-workshop', patchId: 'patch-village-lots', settlementId: 'village', type: 'workshop', dwellingUnits: 0, occupiedUnits: 0, floorAreaM2: 520, rentPerMonth: 0, estimatedValue: 290_000, condition: 0.74, heatDemandKwhPerYear: 10_000, insulationLevel: 0.28, heatingSystem: 'mixed', retrofitLevel: 0.07, effects: { productionCapacity: 0.45, serviceCapacity: 0.3 } }),
    createBuilding({ id: 'b-market-hall', patchId: 'patch-downtown', settlementId: 'town', type: 'shop', dwellingUnits: 0, occupiedUnits: 0, floorAreaM2: 900, rentPerMonth: 0, estimatedValue: 560_000, condition: 0.82, heatDemandKwhPerYear: 15_000, insulationLevel: 0.42, heatingSystem: 'electric', retrofitLevel: 0.14, effects: { serviceCapacity: 0.8 } }),
    createBuilding({ id: 'b-school-clinic', patchId: 'patch-downtown', settlementId: 'town', type: 'institutional', dwellingUnits: 0, occupiedUnits: 0, floorAreaM2: 1200, rentPerMonth: 0, estimatedValue: 650_000, condition: 0.78, heatDemandKwhPerYear: 19_000, insulationLevel: 0.4, heatingSystem: 'electric', retrofitLevel: 0.12, effects: { serviceCapacity: 1 } }),
    createBuilding({ id: 'b-rural-homes', patchId: 'patch-vacant', settlementId: 'rural', type: 'dwelling', dwellingUnits: 24, occupiedUnits: 20, floorAreaM2: 2100, rentPerMonth: 320, estimatedValue: 540_000, condition: 0.7, heatDemandKwhPerYear: 62_000, insulationLevel: 0.27, heatingSystem: 'wood', retrofitLevel: 0.05 })
  ];
}

function createInfrastructureRecords() {
  return [
    createInfrastructure({ id: 'i-main-road', patchId: 'patch-downtown', networkId: 'n-road', type: 'road', condition: 0.82, capacity: 1, effects: { transportCostReduction: 0.22, serviceAccessBonus: 0.25 }, maintenance: { labourDaysPerYear: 60, materialKgPerYear: 2_500, moneyPerYear: 32_000 } }),
    createInfrastructure({ id: 'i-local-roads', patchId: 'patch-old-res', networkId: 'n-road', type: 'road', condition: 0.76, capacity: 0.9, effects: { transportCostReduction: 0.14, serviceAccessBonus: 0.12 }, maintenance: { labourDaysPerYear: 45, materialKgPerYear: 1_800, moneyPerYear: 22_000 } }),
    createInfrastructure({ id: 'i-cart-trail', patchId: 'patch-village-lots', networkId: 'n-trail', type: 'trail', condition: 0.68, capacity: 0.55, effects: { transportCostReduction: 0.08, serviceAccessBonus: 0.08 }, maintenance: { labourDaysPerYear: 28, materialKgPerYear: 700, moneyPerYear: 8_000 } }),
    createInfrastructure({ id: 'i-root-cellar', patchId: 'patch-roots', type: 'rootCellar', condition: 0.72, capacity: 0.5, effects: { spoilageReduction: 0.03, storageCalories: 220_000, serviceAccessBonus: 0.04 }, maintenance: { labourDaysPerYear: 18, materialKgPerYear: 320, moneyPerYear: 3_500 } }),
    createInfrastructure({ id: 'i-barn-service', patchId: 'patch-grain', type: 'mill', condition: 0.7, capacity: 0.45, effects: { processingLabourReduction: 0.1, serviceAccessBonus: 0.05 }, maintenance: { labourDaysPerYear: 20, materialKgPerYear: 350, moneyPerYear: 4_200 } }),
    createInfrastructure({ id: 'i-market-hall', patchId: 'patch-downtown', type: 'marketHall', condition: 0.84, capacity: 0.8, effects: { transportCostReduction: 0.05, serviceAccessBonus: 0.2, spoilageReduction: 0.02 }, maintenance: { labourDaysPerYear: 24, materialKgPerYear: 420, moneyPerYear: 5_200 } }),
    createInfrastructure({ id: 'i-small-mill', patchId: 'patch-village-lots', type: 'mill', condition: 0.66, capacity: 0.35, effects: { processingLabourReduction: 0.08, serviceAccessBonus: 0.05 }, maintenance: { labourDaysPerYear: 16, materialKgPerYear: 260, moneyPerYear: 2_900 } }),
    createInfrastructure({ id: 'i-school', patchId: 'patch-downtown', type: 'school', condition: 0.78, capacity: 0.65, effects: { serviceAccessBonus: 0.22 }, maintenance: { labourDaysPerYear: 14, materialKgPerYear: 210, moneyPerYear: 3_100 } }),
    createInfrastructure({ id: 'i-clinic', patchId: 'patch-downtown', type: 'clinic', condition: 0.79, capacity: 0.6, effects: { serviceAccessBonus: 0.24 }, maintenance: { labourDaysPerYear: 14, materialKgPerYear: 240, moneyPerYear: 3_300 } }),
    createInfrastructure({ id: 'i-freight-spur', patchId: 'patch-village-lots', networkId: 'n-rail', type: 'rail', condition: 0.61, capacity: 0.42, effects: { transportCostReduction: 0.18, serviceAccessBonus: 0.06 }, maintenance: { labourDaysPerYear: 22, materialKgPerYear: 760, moneyPerYear: 12_400 } }),
    createInfrastructure({ id: 'i-river-landing', patchId: 'patch-gardens', networkId: 'n-water', type: 'water', condition: 0.64, capacity: 0.36, effects: { transportCostReduction: 0.14, serviceAccessBonus: 0.05 }, maintenance: { labourDaysPerYear: 18, materialKgPerYear: 520, moneyPerYear: 9_600 } }),
    createInfrastructure({ id: 'i-village-grid', patchId: 'patch-village-lots', type: 'powerLine', condition: 0.71, capacity: 0.55, effects: { serviceAccessBonus: 0.08 }, maintenance: { labourDaysPerYear: 12, materialKgPerYear: 300, moneyPerYear: 4_900 } })
    ,
    createInfrastructure({
      id: 'i-station-town',
      patchId: 'patch-downtown',
      networkId: 'n-rail-corridor',
      settlementId: 'town',
      type: 'railStation',
      condition: 0.72,
      capacity: 0.8,
      catchmentRadiusKm: 3.2,
      walkCatchmentPeople: 210,
      bicycleCatchmentPeople: 180,
      parkAndRideCatchmentPeople: 95,
      freightCatchmentHa: 220,
      passengerCapacityPerYear: 380_000,
      freightCapacityTonnePerYear: 48_000,
      serviceFrequencyPerDay: 3,
      loadingLabourDaysPerTonne: 0.08,
      transferCostPerPassenger: 2.1,
      transferCostPerTonne: 4.4,
      localAccessBonus: 0.24,
      developmentAttraction: 0.32,
      freightAnchorStrength: 0.28,
      effects: { transportCostReduction: 0.16, serviceAccessBonus: 0.2 },
      maintenance: { labourDaysPerYear: 18, materialKgPerYear: 520, moneyPerYear: 7_400 }
    }),
    createInfrastructure({
      id: 'i-halt-village',
      patchId: 'patch-village-lots',
      networkId: 'n-rail-corridor',
      settlementId: 'village',
      type: 'railHalt',
      condition: 0.69,
      capacity: 0.62,
      catchmentRadiusKm: 2.7,
      walkCatchmentPeople: 120,
      bicycleCatchmentPeople: 110,
      parkAndRideCatchmentPeople: 58,
      freightCatchmentHa: 180,
      passengerCapacityPerYear: 210_000,
      freightCapacityTonnePerYear: 32_000,
      serviceFrequencyPerDay: 2,
      loadingLabourDaysPerTonne: 0.1,
      transferCostPerPassenger: 2.4,
      transferCostPerTonne: 4.8,
      localAccessBonus: 0.2,
      developmentAttraction: 0.27,
      freightAnchorStrength: 0.24,
      effects: { transportCostReduction: 0.14, serviceAccessBonus: 0.16 },
      maintenance: { labourDaysPerYear: 14, materialKgPerYear: 420, moneyPerYear: 6_200 }
    }),
    createInfrastructure({
      id: 'i-freight-siding',
      patchId: 'patch-village-lots',
      networkId: 'n-rail-corridor',
      settlementId: 'village',
      type: 'freightSiding',
      condition: 0.66,
      capacity: 0.58,
      catchmentRadiusKm: 4.4,
      walkCatchmentPeople: 45,
      bicycleCatchmentPeople: 62,
      parkAndRideCatchmentPeople: 40,
      freightCatchmentHa: 320,
      passengerCapacityPerYear: 30_000,
      freightCapacityTonnePerYear: 68_000,
      serviceFrequencyPerDay: 1,
      loadingLabourDaysPerTonne: 0.12,
      transferCostPerPassenger: 2.9,
      transferCostPerTonne: 3.9,
      localAccessBonus: 0.12,
      developmentAttraction: 0.22,
      freightAnchorStrength: 0.36,
      effects: { transportCostReduction: 0.2, serviceAccessBonus: 0.08 },
      maintenance: { labourDaysPerYear: 16, materialKgPerYear: 500, moneyPerYear: 6_900 }
    }),
    createInfrastructure({
      id: 'i-market-depot',
      patchId: 'patch-gardens',
      networkId: 'n-rail-corridor',
      settlementId: 'town',
      type: 'marketDepot',
      condition: 0.67,
      capacity: 0.55,
      catchmentRadiusKm: 3.8,
      walkCatchmentPeople: 70,
      bicycleCatchmentPeople: 90,
      parkAndRideCatchmentPeople: 35,
      freightCatchmentHa: 160,
      passengerCapacityPerYear: 24_000,
      freightCapacityTonnePerYear: 42_000,
      serviceFrequencyPerDay: 1,
      loadingLabourDaysPerTonne: 0.14,
      transferCostPerPassenger: 3.1,
      transferCostPerTonne: 3.4,
      localAccessBonus: 0.14,
      developmentAttraction: 0.2,
      freightAnchorStrength: 0.44,
      effects: { transportCostReduction: 0.19, spoilageReduction: 0.03, serviceAccessBonus: 0.08 },
      maintenance: { labourDaysPerYear: 15, materialKgPerYear: 460, moneyPerYear: 6_700 }
    }),
    createInfrastructure({
      id: 'i-wood-depot',
      patchId: 'patch-woodland',
      networkId: 'n-rail-corridor',
      settlementId: 'rural',
      type: 'woodDepot',
      condition: 0.63,
      capacity: 0.52,
      catchmentRadiusKm: 5.2,
      walkCatchmentPeople: 18,
      bicycleCatchmentPeople: 25,
      parkAndRideCatchmentPeople: 24,
      freightCatchmentHa: 260,
      passengerCapacityPerYear: 8_000,
      freightCapacityTonnePerYear: 38_000,
      serviceFrequencyPerDay: 1,
      loadingLabourDaysPerTonne: 0.16,
      transferCostPerPassenger: 3.3,
      transferCostPerTonne: 3.2,
      localAccessBonus: 0.08,
      developmentAttraction: 0.16,
      freightAnchorStrength: 0.48,
      effects: { transportCostReduction: 0.18, serviceAccessBonus: 0.05 },
      maintenance: { labourDaysPerYear: 12, materialKgPerYear: 380, moneyPerYear: 5_600 }
    }),
    createInfrastructure({
      id: 'i-grain-depot',
      patchId: 'patch-grain',
      networkId: 'n-rail-corridor',
      stationId: 'i-freight-siding',
      settlementId: 'rural',
      type: 'grainDepot',
      condition: 0.68,
      commodityTypes: ['foodStaples', 'farmInputs'],
      annualThroughputTonnes: 2_100,
      railCapturePotential: 0.72,
      roadCapturePotential: 0.55,
      storageCapacityTonnes: 1_500,
      spoilageReduction: 0.16,
      loadingEfficiency: 0.64,
      loadingLabourDaysPerTonne: 0.08,
      catchmentRadiusKm: 6.5,
      serviceFrequencyRequirement: 1,
      anchorStrength: 0.62,
      freightAnchorStrength: 0.62,
      effects: { transportCostReduction: 0.18, spoilageReduction: 0.04, serviceAccessBonus: 0.05 },
      maintenance: { labourDaysPerYear: 18, materialKgPerYear: 540, moneyPerYear: 7_200 }
    }),
    createInfrastructure({
      id: 'i-root-cellar-depot',
      patchId: 'patch-roots',
      networkId: 'n-rail-corridor',
      stationId: 'i-freight-siding',
      settlementId: 'rural',
      type: 'rootCellarDepot',
      condition: 0.7,
      commodityTypes: ['freshFood', 'foodStaples'],
      annualThroughputTonnes: 1_200,
      railCapturePotential: 0.6,
      roadCapturePotential: 0.66,
      storageCapacityTonnes: 1_000,
      spoilageReduction: 0.34,
      loadingEfficiency: 0.58,
      loadingLabourDaysPerTonne: 0.1,
      catchmentRadiusKm: 5.8,
      serviceFrequencyRequirement: 1,
      anchorStrength: 0.58,
      freightAnchorStrength: 0.58,
      effects: { transportCostReduction: 0.14, spoilageReduction: 0.08, serviceAccessBonus: 0.04 },
      maintenance: { labourDaysPerYear: 16, materialKgPerYear: 500, moneyPerYear: 6_800 }
    }),
    createInfrastructure({
      id: 'i-repair-materials-depot',
      patchId: 'patch-village-lots',
      networkId: 'n-rail-corridor',
      stationId: 'i-halt-village',
      settlementId: 'village',
      type: 'repairMaterialsDepot',
      condition: 0.69,
      commodityTypes: ['repairGoods', 'constructionMaterials', 'householdGoods'],
      annualThroughputTonnes: 850,
      railCapturePotential: 0.56,
      roadCapturePotential: 0.64,
      storageCapacityTonnes: 650,
      spoilageReduction: 0.08,
      loadingEfficiency: 0.55,
      loadingLabourDaysPerTonne: 0.11,
      catchmentRadiusKm: 4.2,
      serviceFrequencyRequirement: 1,
      anchorStrength: 0.5,
      freightAnchorStrength: 0.5,
      effects: { transportCostReduction: 0.11, serviceAccessBonus: 0.07 },
      maintenance: { labourDaysPerYear: 14, materialKgPerYear: 420, moneyPerYear: 5_900 }
    }),
    createInfrastructure({
      id: 'i-compost-transfer',
      patchId: 'patch-gardens',
      networkId: 'n-rail-corridor',
      stationId: 'i-market-depot',
      settlementId: 'town',
      type: 'compostTransferDepot',
      condition: 0.67,
      commodityTypes: ['compostWaste', 'farmInputs'],
      annualThroughputTonnes: 640,
      railCapturePotential: 0.42,
      roadCapturePotential: 0.62,
      storageCapacityTonnes: 420,
      spoilageReduction: 0.06,
      loadingEfficiency: 0.52,
      loadingLabourDaysPerTonne: 0.13,
      catchmentRadiusKm: 3.9,
      serviceFrequencyRequirement: 1,
      anchorStrength: 0.46,
      freightAnchorStrength: 0.46,
      effects: { transportCostReduction: 0.09, serviceAccessBonus: 0.06 },
      maintenance: { labourDaysPerYear: 12, materialKgPerYear: 360, moneyPerYear: 4_800 }
    })
  ];
}

function createHouseholds(buildings) {
  const households = [];

  const townBuildingIds = ['b-apt-1', 'b-apt-2', 'b-town-mixed', 'b-old-home-1', 'b-old-home-2', 'b-suburb-1', 'b-suburb-2'];
  const villageBuildingIds = ['b-village-homes', 'b-village-mixed'];
  const ruralBuildingIds = ['b-rural-homes'];

  const addHousehold = (id, settlementId, homeBuildingId, profile) => {
    households.push(createHousehold({
      id,
      settlementId,
      homeBuildingId,
      people: profile.people,
      income: profile.income,
      skills: profile.skills,
      access: profile.access,
      reserves: profile.reserves,
      preferences: profile.preferences,
      state: profile.state
    }));
  };

  for (let i = 0; i < 40; i += 1) {
    addHousehold(`hh-town-${i + 1}`, 'town', townBuildingIds[i % townBuildingIds.length], {
      people: { total: 3, workers: 2, dependents: 1 },
      income: { wageIncome: 48_000 + (i % 6) * 2_000, farmIncome: 600, transferIncome: 1_500, enterpriseIncome: 2_500 },
      skills: { farming: 0.3, forestry: 0.2, repair: 0.5, preserving: 0.35, trade: 0.65, care: 0.55 },
      access: { landHa: 0.08, tools: 0.55, vehicleAccess: 0.5, transitAccess: 0.8, draftPower: 0.05, machinePower: 0.45, marketAccess: 0.88 },
      reserves: { calories: 35_000, firewoodKg: 450, cash: 2_500 },
      preferences: { urbanPreference: 0.65, ruralPreference: 0.35, commuteTolerance: 0.55, landAccessDesire: 0.35 },
      state: { health: 0.82, morale: 0.7 }
    });
  }

  for (let i = 0; i < 10; i += 1) {
    addHousehold(`hh-village-${i + 1}`, 'village', villageBuildingIds[i % villageBuildingIds.length], {
      people: { total: 3, workers: 2, dependents: 1 },
      income: { wageIncome: 34_000 + (i % 4) * 1_200, farmIncome: 6_000, transferIncome: 1_500, enterpriseIncome: 2_800 },
      skills: { farming: 0.58, forestry: 0.35, repair: 0.55, preserving: 0.48, trade: 0.5, care: 0.6 },
      access: { landHa: 0.65, tools: 0.62, vehicleAccess: 0.55, transitAccess: 0.45, draftPower: 0.35, machinePower: 0.35, marketAccess: 0.68 },
      reserves: { calories: 58_000, firewoodKg: 900, cash: 1_800 },
      preferences: { urbanPreference: 0.45, ruralPreference: 0.55, commuteTolerance: 0.45, landAccessDesire: 0.6 },
      state: { health: 0.84, morale: 0.74 }
    });
  }

  for (let i = 0; i < 20; i += 1) {
    addHousehold(`hh-rural-${i + 1}`, 'rural', ruralBuildingIds[0], {
      people: { total: 4, workers: 2, dependents: 2 },
      income: { wageIncome: 21_000 + (i % 5) * 800, farmIncome: 15_000, transferIncome: 1_800, enterpriseIncome: 1_200 },
      skills: { farming: 0.72, forestry: 0.6, repair: 0.58, preserving: 0.62, trade: 0.38, care: 0.65 },
      access: { landHa: 2.5, tools: 0.7, vehicleAccess: 0.6, transitAccess: 0.2, draftPower: 0.55, machinePower: 0.5, marketAccess: 0.46 },
      reserves: { calories: 90_000, firewoodKg: 2_200, cash: 1_400 },
      preferences: { urbanPreference: 0.3, ruralPreference: 0.7, commuteTolerance: 0.4, landAccessDesire: 0.8 },
      state: { health: 0.8, morale: 0.76 }
    });
  }

  const buildingById = new Map(buildings.map((building) => [building.id, building]));
  for (const building of buildings) {
    if (building.dwellingUnits <= 0) {
      continue;
    }
    building.occupiedUnits = households.filter((household) => household.homeBuildingId === building.id).length;
  }

  return households;
}

export function createDemoWorld() {
  const patches = createPatchRecords();
  const accessDefaultsByPatch = {
    'patch-downtown': { walkAccessIndex: 0.92, bicycleAccessIndex: 0.84, transitAccessIndex: 0.88, localServiceAccessIndex: 0.95, freightAccessIndex: 0.78, transportResilienceScore: 0.82 },
    'patch-old-res': { walkAccessIndex: 0.8, bicycleAccessIndex: 0.72, transitAccessIndex: 0.68, localServiceAccessIndex: 0.74, freightAccessIndex: 0.7, transportResilienceScore: 0.7 },
    'patch-suburb': { walkAccessIndex: 0.44, bicycleAccessIndex: 0.5, transitAccessIndex: 0.45, localServiceAccessIndex: 0.48, freightAccessIndex: 0.62, transportResilienceScore: 0.48 },
    'patch-village-lots': { walkAccessIndex: 0.86, bicycleAccessIndex: 0.74, transitAccessIndex: 0.56, localServiceAccessIndex: 0.82, freightAccessIndex: 0.68, transportResilienceScore: 0.73 },
    'patch-grain': { walkAccessIndex: 0.22, bicycleAccessIndex: 0.34, transitAccessIndex: 0.2, localServiceAccessIndex: 0.28, freightAccessIndex: 0.62, transportResilienceScore: 0.52 },
    'patch-roots': { walkAccessIndex: 0.24, bicycleAccessIndex: 0.32, transitAccessIndex: 0.22, localServiceAccessIndex: 0.3, freightAccessIndex: 0.6, transportResilienceScore: 0.51 },
    'patch-pasture': { walkAccessIndex: 0.18, bicycleAccessIndex: 0.26, transitAccessIndex: 0.16, localServiceAccessIndex: 0.22, freightAccessIndex: 0.55, transportResilienceScore: 0.49 },
    'patch-woodland': { walkAccessIndex: 0.12, bicycleAccessIndex: 0.2, transitAccessIndex: 0.12, localServiceAccessIndex: 0.14, freightAccessIndex: 0.48, transportResilienceScore: 0.46 },
    'patch-orchard': { walkAccessIndex: 0.34, bicycleAccessIndex: 0.45, transitAccessIndex: 0.3, localServiceAccessIndex: 0.42, freightAccessIndex: 0.58, transportResilienceScore: 0.57 },
    'patch-gardens': { walkAccessIndex: 0.68, bicycleAccessIndex: 0.64, transitAccessIndex: 0.52, localServiceAccessIndex: 0.72, freightAccessIndex: 0.66, transportResilienceScore: 0.69 },
    'patch-wetland': { walkAccessIndex: 0.08, bicycleAccessIndex: 0.14, transitAccessIndex: 0.08, localServiceAccessIndex: 0.1, freightAccessIndex: 0.34, transportResilienceScore: 0.34 },
    'patch-vacant': { walkAccessIndex: 0.3, bicycleAccessIndex: 0.38, transitAccessIndex: 0.28, localServiceAccessIndex: 0.35, freightAccessIndex: 0.52, transportResilienceScore: 0.5 }
  };
  for (const patch of patches) {
    patch.metrics = { ...patch.metrics, ...(accessDefaultsByPatch[patch.id] ?? {}) };
  }

  const plantGroups = createPlantGroups();
  const buildings = createBuildingRecords();
  const infrastructures = createInfrastructureRecords();
  const households = createHouseholds(buildings);

  const patchById = new Map(patches.map((patch) => [patch.id, patch]));

  for (const plant of plantGroups) {
    const patch = patchById.get(plant.patchId);
    patch?.plantGroupIds.push(plant.id);
  }

  for (const building of buildings) {
    const patch = patchById.get(building.patchId);
    patch?.buildingIds.push(building.id);
  }

  for (const infrastructure of infrastructures) {
    const patch = patchById.get(infrastructure.patchId);
    patch?.infrastructureIds.push(infrastructure.id);
  }

  const settlements = [
    createSettlement({
      id: 'town',
      name: 'Town Centre',
      patchIds: ['patch-downtown', 'patch-old-res', 'patch-suburb', 'patch-gardens'],
      householdIds: households.filter((household) => household.settlementId === 'town').map((household) => household.id),
      buildingIds: buildings.filter((building) => building.settlementId === 'town').map((building) => building.id),
      infrastructureIds: infrastructures.filter((infrastructure) => ['patch-downtown', 'patch-old-res'].includes(infrastructure.patchId)).map((infrastructure) => infrastructure.id),
      populationUrban: households.filter((household) => household.settlementId === 'town').reduce((sum, household) => sum + household.people.total, 0),
      populationRural: 0,
      socialCohesion: 0.66,
      institutionalTrust: 0.63
    }),
    createSettlement({
      id: 'village',
      name: 'Village Node',
      patchIds: ['patch-village-lots', 'patch-orchard'],
      householdIds: households.filter((household) => household.settlementId === 'village').map((household) => household.id),
      buildingIds: buildings.filter((building) => building.settlementId === 'village').map((building) => building.id),
      infrastructureIds: infrastructures.filter((infrastructure) => infrastructure.patchId === 'patch-village-lots').map((infrastructure) => infrastructure.id),
      populationUrban: 0,
      populationRural: households.filter((household) => household.settlementId === 'village').reduce((sum, household) => sum + household.people.total, 0),
      socialCohesion: 0.74,
      institutionalTrust: 0.58
    }),
    createSettlement({
      id: 'rural',
      name: 'Rural Fringe',
      patchIds: ['patch-grain', 'patch-roots', 'patch-pasture', 'patch-woodland', 'patch-wetland', 'patch-vacant'],
      householdIds: households.filter((household) => household.settlementId === 'rural').map((household) => household.id),
      buildingIds: buildings.filter((building) => building.settlementId === 'rural').map((building) => building.id),
      infrastructureIds: infrastructures.filter((infrastructure) => ['patch-grain', 'patch-roots'].includes(infrastructure.patchId)).map((infrastructure) => infrastructure.id),
      populationUrban: 0,
      populationRural: households.filter((household) => household.settlementId === 'rural').reduce((sum, household) => sum + household.people.total, 0),
      socialCohesion: 0.78,
      institutionalTrust: 0.52
    })
  ];

  const networks = [
    createNetwork({
      id: 'n-local-roads',
      type: 'localRoad',
      nodes: ['town', 'village'],
      edges: [['town', 'village']],
      segments: [
        {
          id: 'seg-local-town',
          type: 'localRoad',
          lengthKm: 24,
          condition: 0.75,
          capacityPassengerKmPerYear: 1_800_000,
          capacityTonneKmPerYear: 420_000,
          maintenanceCostPerKmPerYear: 14_000,
          maintenanceLabourDaysPerKmPerYear: 18,
          maintenanceMaterialsKgPerKmPerYear: 2_200,
          capitalRenewalCostPerKm: 620_000,
          bridgeOrCulvertFactor: 1.1,
          winterMaintenanceFactor: 1.22,
          climateStressFactor: 1.08,
          rightOfWayStatus: 'active',
          dieselTractionAvailable: true,
          maxSpeedKmh: 50,
          stopsOrSidings: 0,
          connectsSettlementIds: ['town', 'village'],
          notes: 'Town and suburban local streets'
        },
        {
          id: 'seg-collector-village',
          type: 'collectorRoad',
          lengthKm: 18,
          condition: 0.72,
          capacityPassengerKmPerYear: 1_250_000,
          capacityTonneKmPerYear: 360_000,
          maintenanceCostPerKmPerYear: 16_500,
          maintenanceLabourDaysPerKmPerYear: 19,
          maintenanceMaterialsKgPerKmPerYear: 2_450,
          capitalRenewalCostPerKm: 710_000,
          bridgeOrCulvertFactor: 1.18,
          winterMaintenanceFactor: 1.25,
          climateStressFactor: 1.1,
          rightOfWayStatus: 'active',
          dieselTractionAvailable: true,
          maxSpeedKmh: 70,
          stopsOrSidings: 0,
          connectsSettlementIds: ['town', 'village', 'rural'],
          notes: 'County collector between town and village'
        }
      ],
      metrics: { averageCondition: 0.74, freightCostPerTonneKm: 0.75, commuteCostPerKm: 0.45, maintenanceBacklog: 0 }
    }),
    createNetwork({
      id: 'n-rural-gravel',
      type: 'gravelRoad',
      nodes: ['village', 'rural'],
      edges: [['village', 'rural']],
      segments: [
        {
          id: 'seg-rural-gravel-1',
          type: 'gravelRoad',
          lengthKm: 31,
          condition: 0.66,
          capacityPassengerKmPerYear: 780_000,
          capacityTonneKmPerYear: 520_000,
          maintenanceCostPerKmPerYear: 8_600,
          maintenanceLabourDaysPerKmPerYear: 14,
          maintenanceMaterialsKgPerKmPerYear: 1_850,
          capitalRenewalCostPerKm: 320_000,
          bridgeOrCulvertFactor: 1.28,
          winterMaintenanceFactor: 1.2,
          climateStressFactor: 1.22,
          rightOfWayStatus: 'active',
          dieselTractionAvailable: true,
          maxSpeedKmh: 55,
          stopsOrSidings: 0,
          connectsSettlementIds: ['village', 'rural'],
          notes: 'Rural gravel concession roads'
        },
        {
          id: 'seg-cart-trail',
          type: 'trailCartPath',
          lengthKm: 16,
          condition: 0.63,
          capacityPassengerKmPerYear: 330_000,
          capacityTonneKmPerYear: 120_000,
          maintenanceCostPerKmPerYear: 4_200,
          maintenanceLabourDaysPerKmPerYear: 11,
          maintenanceMaterialsKgPerKmPerYear: 620,
          capitalRenewalCostPerKm: 110_000,
          bridgeOrCulvertFactor: 1.05,
          winterMaintenanceFactor: 0.9,
          climateStressFactor: 1.05,
          rightOfWayStatus: 'protected',
          dieselTractionAvailable: false,
          maxSpeedKmh: 18,
          stopsOrSidings: 0,
          connectsSettlementIds: ['village', 'rural'],
          notes: 'Cart/trail connectors for low-energy movement'
        }
      ],
      metrics: { averageCondition: 0.65, freightCostPerTonneKm: 0.62, commuteCostPerKm: 0.36, maintenanceBacklog: 0 }
    }),
    createNetwork({
      id: 'n-rail-corridor',
      type: 'traditionalRail',
      nodes: ['town', 'village'],
      edges: [['town', 'village']],
      segments: [
        {
          id: 'seg-rail-main',
          type: 'traditionalRail',
          lengthKm: 26,
          condition: 0.64,
          capacityPassengerKmPerYear: 2_200_000,
          capacityTonneKmPerYear: 4_600_000,
          maintenanceCostPerKmPerYear: 24_500,
          maintenanceLabourDaysPerKmPerYear: 21,
          maintenanceMaterialsKgPerKmPerYear: 2_600,
          capitalRenewalCostPerKm: 1_480_000,
          bridgeOrCulvertFactor: 1.16,
          winterMaintenanceFactor: 1.08,
          climateStressFactor: 1.1,
          rightOfWayStatus: 'active',
          electrified: false,
          electricTractionAvailable: false,
          dieselTractionAvailable: true,
          maxSpeedKmh: 95,
          stopsOrSidings: 3,
          connectsSettlementIds: ['town', 'village'],
          notes: 'Traditional diesel rail corridor'
        }
      ],
      metrics: { averageCondition: 0.64, freightCostPerTonneKm: 0.46, commuteCostPerKm: 0.3, maintenanceBacklog: 0 }
    }),
    createNetwork({
      id: 'n-water-route',
      type: 'waterRoute',
      nodes: ['town', 'rural'],
      edges: [['town', 'rural']],
      segments: [
        {
          id: 'seg-water-river',
          type: 'waterRoute',
          lengthKm: 22,
          condition: 0.67,
          capacityPassengerKmPerYear: 420_000,
          capacityTonneKmPerYear: 1_900_000,
          maintenanceCostPerKmPerYear: 6_700,
          maintenanceLabourDaysPerKmPerYear: 8,
          maintenanceMaterialsKgPerKmPerYear: 700,
          capitalRenewalCostPerKm: 240_000,
          bridgeOrCulvertFactor: 1,
          winterMaintenanceFactor: 1.15,
          climateStressFactor: 1.06,
          rightOfWayStatus: 'active',
          electrified: false,
          electricTractionAvailable: false,
          dieselTractionAvailable: true,
          maxSpeedKmh: 28,
          stopsOrSidings: 2,
          connectsSettlementIds: ['town', 'rural'],
          notes: 'Seasonal small water freight route'
        }
      ],
      metrics: { averageCondition: 0.67, freightCostPerTonneKm: 0.4, commuteCostPerKm: 0.32, maintenanceBacklog: 0 }
    })
  ];

  const markets = [
    createMarket({
      id: 'market-town',
      settlementId: 'town',
      prices: {
        foodCalories: 0.00045,
        firewoodKg: 0.22,
        dieselLitre: 1.6,
        electricityKwh: 0.2,
        rentUnit: 760,
        landHa: 9_200,
        labourDay: 135
      },
      demand: { housingUnits: 0, foodCalories: 0, labourDays: 0, landHa: 0 },
      supply: { housingUnits: 0, foodCalories: 0, labourDays: 0, landHa: 0 }
    })
  ];

  return createWorld({
    patches,
    plantGroups,
    households,
    buildings,
    infrastructures,
    settlements,
    networks,
    markets,
    metricsByYear: []
  });
}
