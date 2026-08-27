import {
  centroid,
  distanceToGeometry,
  metresBetween,
  normalizeStreet,
  type Feature,
  type Position,
} from "./building-coverage";
import {
  isCanvassableStructureType,
  operationalTargetForStructure,
} from "./operational-target";

type Road = Feature & { properties: Record<string, any> };

const numericPart = (value: unknown) => {
  const match = String(value ?? "").match(/(\d+)/);
  return match?.[1] ?? "";
};

const roadName = (road: Road | undefined) =>
  String(road?.properties?.name ?? "").trim();

const nearestRoad = (point: Position, roads: Road[]) =>
  roads
    .map((road) => ({ road, distance_m: distanceToGeometry(point, road.geometry) }))
    .filter((item) => roadName(item.road))
    .sort(
      (left, right) =>
        left.distance_m - right.distance_m ||
        roadName(left.road).localeCompare(roadName(right.road)),
    )[0]?.road;

const roadById = (roads: Road[], roadId: unknown) => {
  const value = String(roadId ?? "");
  return roads.find((road) => String(road.properties.road_id ?? "") === value);
};

const firstNumber = (properties: Record<string, any>) =>
  String(
    properties.inferred_civic_number ??
      properties.civic_numbers?.[0] ??
      properties.fallback_civic_number ??
      numericPart(properties.civic_label),
  ).replace(/\.0$/, "");

const formatEstimatedLabel = (number: string, street: string) =>
  number && street ? `~${number} ${street}` : "";

type LegacyAddress = {
  label?: string;
  civic_number?: string;
  street?: string;
  unit?: string;
  structure_id?: string;
  external_source?: string;
};

/**
 * Repair the address metadata used by operational roof targets. References
 * produced by the old citywide-nearest heuristic are removed from targeting.
 * A former address on the same physical roof is retained as a clearly marked
 * legacy fallback; otherwise the existing road-range estimate is completed
 * with the nearest named road. Neither fallback is presented as NAR data.
 */
export function repairCanvassingStructureAddresses(options: {
  structures: Feature[];
  roads: Feature[];
  addresses: Feature[];
  legacyAddresses?: Feature[];
}) {
  const roads = options.roads as Road[];
  const currentByStructure = new Map<string, Feature[]>();
  for (const address of options.addresses) {
    const structureId = String(address.properties.structure_id ?? "");
    if (structureId)
      currentByStructure.set(structureId, [
        ...(currentByStructure.get(structureId) ?? []),
        address,
      ]);
  }
  const legacyByStructure = new Map<string, LegacyAddress[]>();
  for (const address of options.legacyAddresses ?? []) {
    const structureId = String(address.properties.structure_id ?? "");
    if (structureId)
      legacyByStructure.set(structureId, [
        ...(legacyByStructure.get(structureId) ?? []),
        address.properties as LegacyAddress,
      ]);
  }
  const stats = {
    authoritative: 0,
    legacy_fallback: 0,
    estimated_fallback: 0,
    unresolved: 0,
    removed_reference_ids: 0,
  };

  for (const structure of options.structures) {
    const properties = structure.properties;
    const structureId = String(properties.structure_id ?? "");
    const current = currentByStructure.get(structureId) ?? [];

    // These fields were produced by the old city-wide nearest-building
    // heuristic. They are never a valid source of a current household target,
    // even when a later NAR placement also exists on the same roof.
    const oldReferences = Array.isArray(properties.address_reference_ids)
      ? properties.address_reference_ids.length
      : 0;
    if (oldReferences) stats.removed_reference_ids += oldReferences;
    delete properties.address_reference_ids;
    delete properties.address_reference_structure_id;
    delete properties.address_reference_distance_m;

    if (current.length) {
      stats.authoritative++;
      const placementStatuses = current.map((address) =>
        String(address.properties.nar_placement_status ?? "nearest"),
      );
      const addressQuality = placementStatuses.every((status) => status === "exact")
        ? "nar_contained_footprint"
        : placementStatuses.every((status) => status === "nearest")
          ? "nar_validated_nearest"
          : "nar_documented_exception";
      const addressIds = current
        .map((address) => String(address.properties.address_id ?? ""))
        .filter((addressId) => addressId.startsWith("address_"));
      // A physical location is one selectable stop, even when it has several
      // NAR address units. The unit household IDs remain distinct so partial
      // coverage and unit history are not collapsed.
      properties.selection_target_kind = "address_household";
      properties.selection_target_ids = [...new Set(
        addressIds.map((addressId) => `household_${addressId.slice(8)}`),
      )];
      properties.selection_target_id = properties.selection_target_ids[0] ?? null;
      properties.canvassable = true;
      properties.address_count = current.length;
      properties.residential_unit_count = current.length;
      properties.address_quality = addressQuality;
      properties.address_source_status = "authoritative";
      properties.address_label_source = addressQuality;
      properties.address_relation = "statcan_authoritative_location";
      properties.address_relation_confidence = addressQuality;
      delete properties.fallback_civic_number;
      delete properties.fallback_street;
      delete properties.fallback_unit;
      continue;
    }

    // Do not let stale authoritative metadata survive a placement change.
    delete properties.authoritative_address_ids;
    delete properties.authoritative_location_ids;
    delete properties.authoritative_address_labels;
    delete properties.footprint_match_status;
    delete properties.footprint_match_distance_m;
    delete properties.footprint_source;
    delete properties.footprint_review_required;

    const canvassable = isCanvassableStructureType(properties.building_type);
    properties.canvassable = canvassable;
    if (!canvassable) {
      properties.selection_target_kind = null;
      properties.selection_target_ids = [];
      properties.selection_target_id = null;
      continue;
    }

    const legacy = legacyByStructure.get(structureId)?.find(
      (item) => item.civic_number && item.street,
    );
    if (legacy) {
      const label = String(
        legacy.label ?? `${legacy.civic_number} ${legacy.street}`,
      ).trim();
      properties.fallback_civic_number = String(legacy.civic_number);
      properties.fallback_street = String(legacy.street);
      properties.fallback_unit = String(legacy.unit ?? "");
      properties.civic_numbers = [String(legacy.civic_number)];
      properties.civic_label = label;
      const legacyQuality = String(legacy.external_source ?? "") ===
        "statistics_canada_national_address_register"
        ? "legacy_nar_confirmed"
        : "legacy_unverified";
      properties.address_label_source = legacyQuality;
      properties.address_source_status = "legacy_fallback";
      properties.address_quality = legacyQuality;
      properties.address_relation = "legacy_same_structure";
      properties.address_relation_confidence = legacyQuality;
      properties.address_count = 1;
      properties.selection_target_kind = "operational_roof";
      properties.selection_target_ids = [
        operationalTargetForStructure(structureId).householdId,
      ];
      properties.selection_target_id = properties.selection_target_ids[0];
      stats.legacy_fallback++;
      continue;
    }

    const priorAddressFallback =
      String(properties.legacy_address_fallback_source ?? "") === "prior_nar_association" &&
      String(properties.fallback_civic_number ?? "").trim() &&
      String(properties.fallback_street ?? "").trim();
    if (priorAddressFallback) {
      const label = `${properties.fallback_civic_number} ${properties.fallback_street}`.trim();
      properties.civic_label = label;
      properties.civic_numbers = [String(properties.fallback_civic_number)];
      properties.address_label_source = "legacy_unverified";
      properties.address_source_status = "legacy_fallback";
      properties.address_quality = "legacy_unverified";
      properties.address_relation = "prior_nar_same_structure_unverified";
      properties.address_relation_confidence = "legacy_unverified";
      properties.address_count = 1;
      properties.selection_target_kind = "operational_roof";
      properties.selection_target_ids = [
        operationalTargetForStructure(structureId).householdId,
      ];
      properties.selection_target_id = properties.selection_target_ids[0];
      stats.legacy_fallback++;
      continue;
    }

    const point = centroid(structure);
    const rangeRoad = roadById(roads, properties.address_range_road_id);
    const road = rangeRoad ?? nearestRoad(point, roads);
    let number = firstNumber(properties);
    let street = String(properties.fallback_street ?? "").trim() || roadName(road);
    if (number && street) {
      properties.fallback_civic_number = number;
      properties.fallback_street = street;
      properties.fallback_unit = "";
      properties.civic_numbers = [number];
      properties.civic_label = formatEstimatedLabel(number, street);
      properties.address_label_source = "owen_sound_grid_estimate";
      properties.address_source_status = "estimated";
      properties.address_quality = "grid_estimated";
      properties.address_relation = "grid_estimated_same_road";
      properties.address_relation_confidence = "estimated";
      properties.address_count = 1;
      properties.selection_target_kind = "operational_roof";
      properties.selection_target_ids = [
        operationalTargetForStructure(structureId).householdId,
      ];
      properties.selection_target_id = properties.selection_target_ids[0];
      stats.estimated_fallback++;
    } else {
      properties.civic_label = "";
      properties.address_quality = "unresolved";
      properties.address_source_status = "unresolved";
      properties.selection_target_kind = "operational_roof";
      properties.selection_target_ids = [
        operationalTargetForStructure(structureId).householdId,
      ];
      properties.selection_target_id = properties.selection_target_ids[0];
      stats.unresolved++;
    }
  }
  return stats;
}

export function assertNoAnonymousActiveAddressLabels(structures: Feature[]) {
  const failures = structures.filter((feature) => {
    const p = feature.properties;
    if (!p.canvassable) return false;
    const label = String(p.civic_label ?? "");
    return (
      /^Canvassing roof\b/i.test(label) ||
      !numericPart(p.civic_label) ||
      !normalizeStreet(label.replace(/^~?\d+[A-Z0-9/-]*\s*/i, ""))
    );
  });
  if (failures.length)
    throw new Error(
      `Canvassing address invariant failed: ${failures.length} active canvassable structures lack a human-readable address (${failures
        .slice(0, 5)
        .map((feature) => feature.properties.structure_id)
        .join(", ")})`,
    );
}
