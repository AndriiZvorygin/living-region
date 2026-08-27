import { createHash } from "node:crypto";

const nonCanvassableStructureTypes = new Set([
  "accessory",
  "barn",
  "carport",
  "church",
  "civic",
  "commercial",
  "college",
  "garage",
  "hospital",
  "industrial",
  "institutional",
  "office",
  "public",
  "retail",
  "school",
  "shed",
  "warehouse",
]);

export const isCanvassableStructureType = (value: unknown) =>
  !nonCanvassableStructureTypes.has(String(value ?? "").toLowerCase());

/** Keep this format compatible with targets created by the old lazy fallback. */
export const operationalTargetForStructure = (structureId: string) => {
  const suffix = createHash("sha256")
    .update(`operational-roof-target:${structureId}`)
    .digest("hex")
    .slice(0, 20);
  return {
    addressId: `address_${suffix}`,
    householdId: `household_${suffix}`,
  };
};
