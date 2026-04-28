function push(list, severity, code, message, context = {}) {
  list.push({ severity, code, message, ...context });
}

export function buildValidationReport(world) {
  const errors = [];
  const warnings = [];
  const info = [];

  const patchIds = new Set(world.patches.map((item) => item.id));
  const buildingIds = new Set(world.buildings.map((item) => item.id));
  const networkIds = new Set(world.networks.map((item) => item.id));

  for (const patch of world.patches) {
    if (!(patch.areaHa > 0)) {
      push(errors, 'error', 'patch.area.missing_or_invalid', `Patch ${patch.id} missing valid areaHa`, { patchId: patch.id });
    }
    if (!patch.geometry) {
      push(warnings, 'warning', 'patch.geometry.missing', `Patch ${patch.id} has no geometry`, { patchId: patch.id });
    }
  }

  for (const building of world.buildings) {
    if (!patchIds.has(building.patchId)) {
      push(errors, 'error', 'building.patch.unknown', `Building ${building.id} references unknown patchId ${building.patchId}`, { buildingId: building.id });
    }
    if (!building.geometry && !building.patchId) {
      push(warnings, 'warning', 'building.geometry.missing', `Building ${building.id} has no geometry and no patch reference`, { buildingId: building.id });
    }
    if (building.condition < 0 || building.condition > 1) {
      push(warnings, 'warning', 'building.condition.out_of_range', `Building ${building.id} has condition outside 0..1`, { buildingId: building.id, value: building.condition });
    }
  }

  const stationTypes = new Set(['railStation', 'railHalt', 'freightSiding', 'intermodalDepot', 'marketDepot', 'grainElevator', 'woodDepot', 'coldStorageDepot', 'repairDepot']);
  const anchorTypes = new Set(['grainDepot', 'rootCellarDepot', 'coldStorageDepot', 'woodFuelDepot', 'timberSiding', 'farmInputDepot', 'nurseryStockDepot', 'repairMaterialsDepot', 'compostTransferDepot', 'constructionMaterialsDepot', 'emergencySupplyDepot']);

  for (const infra of world.infrastructures) {
    if (!patchIds.has(infra.patchId)) {
      push(errors, 'error', 'infrastructure.patch.unknown', `Infrastructure ${infra.id} references unknown patchId ${infra.patchId}`, { infrastructureId: infra.id });
    }
    if (infra.networkId && !networkIds.has(infra.networkId)) {
      push(warnings, 'warning', 'infrastructure.network.unknown', `Infrastructure ${infra.id} references unknown networkId ${infra.networkId}`, { infrastructureId: infra.id });
    }
    if ((infra.maintenanceCostPerYear ?? 0) < 0 || (infra.maintenance?.moneyPerYear ?? 0) < 0) {
      push(warnings, 'warning', 'infrastructure.maintenance.negative', `Infrastructure ${infra.id} has negative maintenance cost`, { infrastructureId: infra.id });
    }
    if ((infra.condition ?? 0) < 0 || (infra.condition ?? 0) > 1) {
      push(warnings, 'warning', 'infrastructure.condition.out_of_range', `Infrastructure ${infra.id} has condition outside 0..1`, { infrastructureId: infra.id });
    }
    if (anchorTypes.has(infra.type) && !infra.stationId && !infra.networkId) {
      push(warnings, 'warning', 'freight_anchor.unlinked', `Freight anchor ${infra.id} has no stationId/networkId`, { infrastructureId: infra.id });
    }
  }

  for (const network of world.networks) {
    for (const segment of network.segments ?? []) {
      if (!(segment.lengthKm > 0)) {
        push(errors, 'error', 'network.segment.length.invalid', `Network segment ${segment.id} missing valid lengthKm`, { networkId: network.id, segmentId: segment.id });
      }
      if ((segment.condition ?? 0) < 0 || (segment.condition ?? 0) > 1) {
        push(warnings, 'warning', 'network.segment.condition.out_of_range', `Network segment ${segment.id} has condition outside 0..1`, { networkId: network.id, segmentId: segment.id });
      }
    }
    const isRail = (network.type ?? '').includes('Rail') || (network.type ?? '').toLowerCase().includes('rail');
    if (isRail) {
      const hasStation = world.infrastructures.some((infra) => stationTypes.has(infra.type) && (!infra.networkId || infra.networkId === network.id));
      if (!hasStation) {
        push(warnings, 'warning', 'rail.network.no_station', `Rail network ${network.id} has no station/siding features`, { networkId: network.id });
      }
    }
  }

  for (const household of world.households) {
    if (household.homeBuildingId && !buildingIds.has(household.homeBuildingId)) {
      push(errors, 'error', 'household.building.unknown', `Household ${household.id} references unknown homeBuildingId ${household.homeBuildingId}`, { householdId: household.id });
    }
  }

  push(info, 'info', 'geojson.crs.assumption', 'GeoJSON CRS should be WGS84; areaHa/lengthKm should be precomputed in GIS.', {});

  return { errors, warnings, info };
}
