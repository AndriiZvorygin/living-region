// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'node:path';
import { mergeScenarioConstants, defaultConstants } from './default_constants.mjs';
import { importCalibrationCsvTables } from './import_calibration_csv.mjs';

function average(values, fallback = 0) {
  const valid = values.filter((item) => Number.isFinite(item));
  if (valid.length === 0) {
    return fallback;
  }
  return valid.reduce((sum, item) => sum + item, 0) / valid.length;
}

function mapTablesToOverrides(tables) {
  const overrides = {
    calibrationInput: {
      tables: Object.fromEntries(Object.entries(tables).map(([key, value]) => [key, value.rows]))
    }
  };

  const roadRows = tables.roadMaintenance?.rows ?? [];
  if (roadRows.length > 0) {
    overrides.roadMaintenance = {
      byNetworkType: Object.fromEntries(roadRows.map((row) => [row.networkType, {
        maintenanceCostPerKmPerYear: row.maintenanceCostPerKmPerYear,
        winterMaintenanceFactor: row.winterMaintenanceFactor,
        bridgeOrCulvertFactor: row.bridgeOrCulvertFactor,
        climateStressFactor: row.climateStressFactor
      }])),
      freezeThawStressMultiplier: average(roadRows.map((row) => row.climateStressFactor), 0.28),
      winterServiceMultiplier: average(roadRows.map((row) => row.winterMaintenanceFactor), 0.22)
    };
  }

  const railRows = tables.railMaintenance?.rows ?? [];
  if (railRows.length > 0) {
    overrides.railMaintenance = {
      byTrackType: Object.fromEntries(railRows.map((row) => [row.trackType, {
        maintenanceCostPerKmPerYear: row.maintenanceCostPerKmPerYear,
        electrificationMaintenanceCostPerKmPerYear: row.electrificationMaintenanceCostPerKmPerYear,
        capitalRenewalCostPerKm: row.capitalRenewalCostPerKm
      }]))
    };
    const firstOverride = railRows.find((row) => Number.isFinite(row.railFixedCostAnnualOverride));
    if (firstOverride) {
      overrides.railCorridor = {
        railFixedBaseAnnual: firstOverride.railFixedCostAnnualOverride
      };
    }
  }

  const vehicleRows = tables.vehicleCosts?.rows ?? [];
  if (vehicleRows.length > 0) {
    const privateIce = vehicleRows.find((row) => String(row.vehicleType).toLowerCase().includes('ice') || String(row.vehicleType).toLowerCase().includes('car'));
    const privateEv = vehicleRows.find((row) => String(row.vehicleType).toLowerCase().includes('ev') || String(row.vehicleType).toLowerCase().includes('electric'));
    overrides.transportEconomics = {
      privateIce: privateIce ? {
        fuelLitresPerKm: privateIce.fuelLitresPerKm,
        maintenanceCostPerKm: privateIce.maintenanceCostPerKm,
        insuranceAnnual: privateIce.insuranceAnnual,
        depreciationAnnual: privateIce.depreciationAnnual,
        financeOrCapitalAnnual: privateIce.fixedCostAnnual
      } : {},
      privateEv: privateEv ? {
        electricityKwhPerKm: privateEv.electricityKwhPerKm,
        maintenanceCostPerKm: privateEv.maintenanceCostPerKm,
        insuranceAnnual: privateEv.insuranceAnnual,
        depreciationAnnual: privateEv.depreciationAnnual,
        financeOrCapitalAnnual: privateEv.fixedCostAnnual
      } : {}
    };
  }

  const fuelRows = tables.fuelPrices?.rows ?? [];
  if (fuelRows.length > 0) {
    overrides.market = {
      fuelPricesByYear: Object.fromEntries(fuelRows.map((row) => [row.year, {
        gasolinePricePerLitre: row.gasolinePricePerLitre,
        dieselPricePerLitre: row.dieselPricePerLitre,
        electricityPricePerKwh: row.electricityPricePerKwh
      }]))
    };
  }

  const energyRows = tables.buildingEnergy?.rows ?? [];
  if (energyRows.length > 0) {
    overrides.energy = {
      buildingEnergyByType: Object.fromEntries(energyRows.map((row) => [row.buildingType, {
        heatDemandKwhPerM2: row.heatDemandKwhPerM2,
        electricityKwhPerPerson: row.electricityKwhPerPerson,
        retrofitCostPerM2: row.retrofitCostPerM2
      }]))
    };
  }

  const freightRows = tables.commodityFreight?.rows ?? [];
  if (freightRows.length > 0) {
    overrides.freightCommodities = Object.fromEntries(freightRows.map((row) => [row.commodity, {
      baseTonnesPerPerson: row.annualTonnes ? row.annualTonnes / 1000 : undefined,
      railSuitability: row.railSuitability,
      perishability: row.perishability,
      valuePerTonne: row.valuePerTonne,
      essentiality: row.essentiality
    }]));
  }

  const transitionRows = tables.landUseTransition?.rows ?? [];
  if (transitionRows.length > 0) {
    overrides.landUseTransition = {
      transitions: transitionRows
    };
  }

  return overrides;
}

export function loadCalibrationBundle(inputDir) {
  const calibrationDir = path.join(inputDir, 'calibration');
  const { tables, loadedFiles, warnings } = importCalibrationCsvTables(calibrationDir);
  const overrides = mapTablesToOverrides(tables);
  const constants = mergeScenarioConstants(defaultConstants, overrides);
  return {
    constants,
    loadedFiles,
    warnings,
    tables
  };
}
