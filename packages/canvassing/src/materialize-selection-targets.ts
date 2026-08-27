import { readFile, writeFile } from "node:fs/promises";
import { isCanvassableStructureType, operationalTargetForStructure } from "./operational-target";

type Feature = { properties: Record<string, any> };

const structuresPath = "packages/web-client/public/canvassing/structures.geojson";
const addressesPath = "packages/web-client/public/canvassing/addresses.geojson";

const structures = JSON.parse(await readFile(structuresPath, "utf8")) as {
  type: "FeatureCollection";
  features: Feature[];
};
const addresses = JSON.parse(await readFile(addressesPath, "utf8")) as {
  features: Feature[];
};
const addressesByStructure = new Map<string, string[]>();
const addressIdBySourceGuid = new Map<string, string>();
for (const address of addresses.features) {
  const addressId = String(address.properties.address_id ?? "");
  const sourceGuid = String(address.properties.source_address_guid ?? "");
  if (sourceGuid && addressId) addressIdBySourceGuid.set(sourceGuid, addressId);
  const structureId = String(address.properties.structure_id ?? "");
  if (!structureId || !addressId) continue;
  addressesByStructure.set(structureId, [
    ...(addressesByStructure.get(structureId) ?? []),
    addressId,
  ]);
}

for (const structure of structures.features) {
  const properties = structure.properties,
    structureId = String(properties.structure_id ?? ""),
    addressIds = [
      ...(addressesByStructure.get(structureId) ?? []),
      ...(properties.authoritative_address_ids ?? [])
        .map((id: unknown) => addressIdBySourceGuid.get(String(id)))
        .filter(Boolean),
    ],
    householdIds = [
      ...new Set(
        addressIds
          .map(String)
          .filter((id) => id.startsWith("address_"))
          .map((id) => `household_${id.slice(8)}`),
      ),
    ],
    canvassable =
      householdIds.length > 0 ||
      isCanvassableStructureType(properties.building_type);
  if (canvassable && !householdIds.length) {
    householdIds.push(operationalTargetForStructure(structureId).householdId);
    properties.selection_target_kind = "operational_roof";
  } else if (householdIds.length) {
    properties.selection_target_kind = "address_household";
  } else {
    properties.selection_target_kind = null;
  }
  properties.canvassable = canvassable;
  properties.selection_target_ids = householdIds;
  properties.selection_target_id = householdIds[0] ?? null;
}

const missing = structures.features.filter(
  (feature) =>
    feature.properties.canvassable && !feature.properties.selection_target_id,
);
if (missing.length)
  throw new Error(
    `Canvassing data invariant failed: ${missing.length} canvassable structures lack selection targets`,
  );

await writeFile(structuresPath, JSON.stringify(structures) + "\n");
console.log(
  `Materialized selection targets for ${structures.features.filter((feature) => feature.properties.canvassable).length} canvassable structures; missing=${missing.length}`,
);
