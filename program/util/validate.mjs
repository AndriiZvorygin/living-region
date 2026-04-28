const REQUIRED_ARRAY_KEYS = [
  'patches',
  'plantGroups',
  'households',
  'buildings',
  'infrastructures',
  'settlements',
  'networks',
  'markets'
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`World validation error: ${message}`);
  }
}

function assertUniqueIds(items, label) {
  const seen = new Set();
  for (const item of items) {
    assert(item && item.id, `${label} item missing id`);
    assert(!seen.has(item.id), `duplicate ${label} id: ${item.id}`);
    seen.add(item.id);
  }
}

function assertReferenceExists(id, lookup, message) {
  if (!id) {
    return;
  }
  assert(lookup.has(id), message);
}

export function validateWorld(world) {
  assert(world && typeof world === 'object', 'world must be an object');
  for (const key of REQUIRED_ARRAY_KEYS) {
    assert(Array.isArray(world[key]), `world.${key} must be an array`);
  }

  assertUniqueIds(world.patches, 'patch');
  assertUniqueIds(world.plantGroups, 'plantGroup');
  assertUniqueIds(world.households, 'household');
  assertUniqueIds(world.buildings, 'building');
  assertUniqueIds(world.infrastructures, 'infrastructure');
  assertUniqueIds(world.settlements, 'settlement');
  assertUniqueIds(world.networks, 'network');
  assertUniqueIds(world.markets, 'market');

  const patchIds = new Set(world.patches.map((patch) => patch.id));
  const settlementIds = new Set(world.settlements.map((settlement) => settlement.id));
  const buildingIds = new Set(world.buildings.map((building) => building.id));
  const householdIds = new Set(world.households.map((household) => household.id));

  for (const group of world.plantGroups) {
    assertReferenceExists(group.patchId, patchIds, `plantGroup ${group.id} has invalid patchId ${group.patchId}`);
  }

  for (const building of world.buildings) {
    assertReferenceExists(building.patchId, patchIds, `building ${building.id} has invalid patchId ${building.patchId}`);
    assertReferenceExists(building.settlementId, settlementIds, `building ${building.id} has invalid settlementId ${building.settlementId}`);
  }

  for (const household of world.households) {
    assertReferenceExists(household.settlementId, settlementIds, `household ${household.id} has invalid settlementId ${household.settlementId}`);
    assertReferenceExists(household.homeBuildingId, buildingIds, `household ${household.id} has invalid homeBuildingId ${household.homeBuildingId}`);
  }

  for (const settlement of world.settlements) {
    for (const householdId of settlement.householdIds || []) {
      assertReferenceExists(householdId, householdIds, `settlement ${settlement.id} references unknown household ${householdId}`);
    }
    for (const patchId of settlement.patchIds || []) {
      assertReferenceExists(patchId, patchIds, `settlement ${settlement.id} references unknown patch ${patchId}`);
    }
  }

  return true;
}
