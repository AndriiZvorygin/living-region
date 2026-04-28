// SPDX-License-Identifier: AGPL-3.0-or-later
import { average, clamp01, safeDivide } from '../util/math.mjs';

const STATION_TYPES = new Set([
  'railStation',
  'railHalt',
  'freightSiding',
  'intermodalDepot',
  'marketDepot',
  'grainElevator',
  'woodDepot',
  'coldStorageDepot',
  'repairDepot',
  'grainDepot',
  'rootCellarDepot',
  'woodFuelDepot',
  'timberSiding',
  'farmInputDepot',
  'nurseryStockDepot',
  'repairMaterialsDepot',
  'compostTransferDepot',
  'constructionMaterialsDepot',
  'emergencySupplyDepot'
]);
const PASSENGER_STATION_TYPES = new Set(['railStation', 'railHalt', 'intermodalDepot']);

function householdPatchId(household, buildingById) {
  const home = buildingById.get(household.homeBuildingId);
  return home?.patchId ?? null;
}

function stationBaseFrequency(station, constants) {
  const railConstants = constants?.railCorridor ?? {};
  const minFrequency = railConstants.minimumServiceFrequencyPerDay ?? 1;
  return Math.max(minFrequency, station.serviceFrequencyPerDay ?? minFrequency);
}

export function calculateStationCatchments(world, context) {
  const constants = context.constants ?? {};
  const railConstants = constants.railCorridor ?? {};
  const adaptation = context.adaptation ?? {};

  const stationBuildoutRate = adaptation.annualStationCatchmentBuildoutRate ?? 0;
  const frequencyBuildoutRate = adaptation.annualRailFrequencyIncreaseRate ?? 0;

  const buildingById = new Map(world.buildings.map((item) => [item.id, item]));
  const patchById = new Map(world.patches.map((item) => [item.id, item]));

  const stations = world.infrastructures.filter((infra) => STATION_TYPES.has(infra.type));

  const summaries = [];
  const uniqueServedHouseholdIds = new Set();
  for (const station of stations) {
    const stationPatch = patchById.get(station.patchId);
    if (!stationPatch) {
      continue;
    }

    const catchmentRadiusKm = Math.max(0.25, station.catchmentRadiusKm ?? 2.2);
    const frequencyCap = railConstants.maximumServiceFrequencyPerDay ?? 18;
    const serviceFrequencyPerDay = Math.min(
      frequencyCap,
      stationBaseFrequency(station, constants) * (1 + frequencyBuildoutRate * 6)
    );

    const servedHouseholds = world.households.filter((household) => {
      const patchId = householdPatchId(household, buildingById);
      const patch = patchId ? patchById.get(patchId) : null;
      if (!patch) {
        return false;
      }

      const distanceToStation = patch.distance.nearestSettlementKm * 0.55 + patch.distance.nearestRoadKm * 0.7;
      const accessIndex = (patch.metrics?.walkAccessIndex ?? 0.3) * 0.4
        + (patch.metrics?.bicycleAccessIndex ?? 0.3) * 0.3
        + (patch.metrics?.localServiceAccessIndex ?? 0.3) * 0.2
        + (household.access.vehicleAccess ?? 0.3) * 0.1
        + (station.localAccessBonus ?? 0) * 0.15;
      return distanceToStation <= catchmentRadiusKm * (0.45 + accessIndex * 0.75);
    });

    const catchmentPopulation = servedHouseholds.reduce((sum, household) => sum + household.people.total, 0);
    const catchmentHouseholds = servedHouseholds.length;
    const catchmentJobs = servedHouseholds.reduce((sum, household) => sum + household.people.workers, 0);

    const catchmentPatches = world.patches.filter((patch) => {
      const distanceToStation = patch.distance.nearestSettlementKm * 0.7 + patch.distance.nearestRoadKm * 0.5;
      return distanceToStation <= catchmentRadiusKm * 1.4;
    });

    const productiveLandHa = catchmentPatches
      .filter((patch) => ['cropland', 'pasture', 'mixed', 'woodland', 'vacant'].includes(patch.landUse))
      .reduce((sum, patch) => sum + patch.areaHa, 0);

    const marketGardenHa = catchmentPatches
      .filter((patch) => patch.id === 'patch-gardens' || patch.id === 'patch-village-lots')
      .reduce((sum, patch) => sum + patch.areaHa * 0.45, 0);

    const anchorStrength = clamp01(station.freightAnchorStrength + station.developmentAttraction * 0.55);
    const serviceFactor = clamp01(serviceFrequencyPerDay / Math.max(1, railConstants.maximumServiceFrequencyPerDay ?? 18));
    const conditionFactor = clamp01(station.condition ?? 0.7);

    const catchmentFreightTonnePotential = productiveLandHa * (1.4 + anchorStrength) * serviceFactor * conditionFactor;
    const catchmentFoodFreightPotential = catchmentFreightTonnePotential * (0.45 + station.localAccessBonus * 0.2);
    const catchmentWoodFreightPotential = catchmentFreightTonnePotential * (0.28 + anchorStrength * 0.22);
    const catchmentRepairGoodsPotential = catchmentFreightTonnePotential * (0.15 + station.developmentAttraction * 0.3);

    const catchmentServiceCapacity = (station.passengerCapacityPerYear ?? 0) * serviceFactor * conditionFactor;

    const catchmentWalkAccessShare = clamp01(average(catchmentPatches.map((patch) => patch.metrics?.walkAccessIndex ?? 0.3), 0.3));
    const catchmentBicycleAccessShare = clamp01(average(catchmentPatches.map((patch) => patch.metrics?.bicycleAccessIndex ?? 0.3), 0.3));
    const catchmentCarAccessShare = clamp01(average(servedHouseholds.map((household) => household.access.vehicleAccess ?? 0.35), 0.35));

    const stationAreaTransitionPotential = clamp01(
      (station.developmentAttraction ?? 0.2) * 0.4
      + serviceFactor * 0.25
      + catchmentWalkAccessShare * 0.2
      + clamp01(stationBuildoutRate * 8) * 0.15
    );

    station.serviceFrequencyPerDay = serviceFrequencyPerDay;
    station.metrics = {
      ...station.metrics,
      catchmentPopulation,
      catchmentHouseholds,
      catchmentJobs,
      catchmentServiceCapacity,
      catchmentFreightTonnePotential,
      catchmentFoodFreightPotential,
      catchmentWoodFreightPotential,
      catchmentRepairGoodsPotential,
      catchmentMarketGardenHa: marketGardenHa,
      catchmentProductiveLandHa: productiveLandHa,
      catchmentWalkAccessShare,
      catchmentBicycleAccessShare,
      catchmentCarAccessShare,
      stationAreaTransitionPotential
    };

    summaries.push({
      id: station.id,
      type: station.type,
      networkId: station.networkId,
      settlementId: station.settlementId,
      catchmentPopulation,
      catchmentHouseholds,
      catchmentJobs,
      catchmentServiceCapacity,
      catchmentFreightTonnePotential,
      catchmentFoodFreightPotential,
      catchmentWoodFreightPotential,
      catchmentRepairGoodsPotential,
      catchmentMarketGardenHa: marketGardenHa,
      catchmentProductiveLandHa: productiveLandHa,
      catchmentWalkAccessShare,
      catchmentBicycleAccessShare,
      catchmentCarAccessShare,
      serviceFrequencyPerDay,
      transferCostPerPassenger: station.transferCostPerPassenger ?? 0,
      transferCostPerTonne: station.transferCostPerTonne ?? 0,
      localAccessBonus: station.localAccessBonus ?? 0,
      freightAnchorStrength: station.freightAnchorStrength ?? 0,
      stationAreaTransitionPotential
    });
    const isPassengerStation = PASSENGER_STATION_TYPES.has(station.type)
      && (station.passengerCapacityPerYear ?? 0) > 0
      && serviceFrequencyPerDay >= (railConstants.minimumServiceFrequencyPerDay ?? 1);

    if (isPassengerStation) {
      for (const household of servedHouseholds) {
        uniqueServedHouseholdIds.add(household.id);
      }
    }
  }

  const uniqueServedHouseholds = world.households.filter((household) => uniqueServedHouseholdIds.has(household.id));
  const householdsWithViableRailAlternative = uniqueServedHouseholds.length;
  const totalHouseholds = world.households.length;
  const householdsCarDependentNoAlternative = Math.max(0, totalHouseholds - householdsWithViableRailAlternative);

  return {
    stations: summaries,
    stationCount: summaries.length,
    catchmentPopulation: uniqueServedHouseholds.reduce((sum, household) => sum + household.people.total, 0),
    catchmentHouseholds: householdsWithViableRailAlternative,
    catchmentJobs: uniqueServedHouseholds.reduce((sum, household) => sum + household.people.workers, 0),
    catchmentServiceCapacity: summaries.reduce((sum, item) => sum + item.catchmentServiceCapacity, 0),
    catchmentFreightTonnePotential: summaries.reduce((sum, item) => sum + item.catchmentFreightTonnePotential, 0),
    catchmentFoodFreightPotential: summaries.reduce((sum, item) => sum + item.catchmentFoodFreightPotential, 0),
    catchmentWoodFreightPotential: summaries.reduce((sum, item) => sum + item.catchmentWoodFreightPotential, 0),
    catchmentRepairGoodsPotential: summaries.reduce((sum, item) => sum + item.catchmentRepairGoodsPotential, 0),
    catchmentMarketGardenHa: summaries.reduce((sum, item) => sum + item.catchmentMarketGardenHa, 0),
    catchmentProductiveLandHa: summaries.reduce((sum, item) => sum + item.catchmentProductiveLandHa, 0),
    catchmentWalkAccessShare: average(summaries.map((item) => item.catchmentWalkAccessShare), 0),
    catchmentBicycleAccessShare: average(summaries.map((item) => item.catchmentBicycleAccessShare), 0),
    catchmentCarAccessShare: average(summaries.map((item) => item.catchmentCarAccessShare), 0),
    averageServiceFrequencyPerDay: average(summaries.map((item) => item.serviceFrequencyPerDay), 0),
    averageTransferCostPerPassenger: average(summaries.map((item) => item.transferCostPerPassenger), 0),
    averageTransferCostPerTonne: average(summaries.map((item) => item.transferCostPerTonne), 0),
    freightAnchorStrength: average(summaries.map((item) => item.freightAnchorStrength), 0),
    householdsWithViableRailAlternative,
    householdsCarDependentNoAlternative,
    viableRailHouseholdShare: safeDivide(householdsWithViableRailAlternative, Math.max(1, totalHouseholds), 0)
  };
}
