import { metresBetween, type Feature, type Position } from "./building-coverage";

export type LegacyHistoryLinkStatus = "confident" | "ambiguous" | "unmatched";

export type LegacyHistoryLink = {
  legacy_address_id: string;
  canonical_address_id: string | null;
  canonical_location_id: string | null;
  match_status: LegacyHistoryLinkStatus;
  distance_m: number | null;
  candidate_count: number;
  candidate_location_count: number;
  reason: string;
};

type LegacyAddress = {
  internal_address_id: string;
  street: string;
  unit: string;
  civic_number: string;
  longitude: number;
  latitude: number;
};

type CanonicalAddress = {
  address_id: string;
  location_id: string;
  street_key: string;
  unit: string;
  civic_number: string;
  longitude: number;
  latitude: number;
};

const typeAliases: Record<string, string> = {
  AV: "AVE",
  AVE: "AVE",
  AVENUE: "AVE",
  BLVD: "BLVD",
  BOULEVARD: "BLVD",
  CRES: "CRES",
  CRESCENT: "CRES",
  DR: "DR",
  DRIVE: "DR",
  HWY: "HWY",
  HIGHWAY: "HWY",
  LN: "LN",
  LANE: "LN",
  PKWY: "PKWY",
  PARKWAY: "PKWY",
  PL: "PL",
  PLACE: "PL",
  RD: "RD",
  ROAD: "RD",
  ST: "ST",
  STREET: "ST",
  TER: "TER",
  TERRACE: "TER",
  WAY: "WAY",
};
const directionAliases: Record<string, string> = {
  E: "E",
  EAST: "E",
  N: "N",
  NORTH: "N",
  S: "S",
  SOUTH: "S",
  W: "W",
  WEST: "W",
  NE: "NE",
  NORTHEAST: "NE",
  NW: "NW",
  NORTHWEST: "NW",
  SE: "SE",
  SOUTHEAST: "SE",
  SW: "SW",
  SOUTHWEST: "SW",
};

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

const normalizeUnit = (value: unknown) =>
  normalizeText(value)
    .replace(/\s+/g, "")
    .replace(/^(APT|APARTMENT|UNIT|SUITE|STE)(?=\w)/, "");

/** Normalize both the old free-form street label and NAR's split fields. */
export function legacyHistoryStreetKey(value: unknown) {
  const parts = normalizeText(value).split(/\s+/).filter(Boolean);
  const typeIndex = parts.findIndex((part) => typeAliases[part]);
  if (typeIndex < 0) return parts.join(" ");
  let directionIndex = -1;
  for (let index = typeIndex + 1; index < parts.length; index++) {
    if (directionAliases[parts[index]]) {
      directionIndex = index;
      break;
    }
  }
  return [
    ...parts.slice(0, typeIndex),
    ...parts.slice(typeIndex + 1, directionIndex < 0 ? parts.length : directionIndex),
    typeAliases[parts[typeIndex]],
    ...(directionIndex < 0 ? [] : [directionAliases[parts[directionIndex]]]),
  ].join(" ");
}

const canonicalStreetKey = (properties: Record<string, any>) =>
  [
    legacyHistoryStreetKey(properties.official_street_name),
    typeAliases[normalizeText(properties.official_street_type)] ??
      normalizeText(properties.official_street_type),
    directionAliases[normalizeText(properties.official_street_direction)] ??
      normalizeText(properties.official_street_direction),
  ]
    .filter(Boolean)
    .join(" ");

function legacyFromFeature(feature: Feature): LegacyAddress | null {
  const properties = feature.properties;
  const id = String(
    properties.address_id ?? properties.internal_address_id ?? feature.id ?? "",
  );
  const street = String(properties.street ?? "").trim();
  // A few older OSM rows have only a rough civic number and coordinates.
  // They are still historical roofs and must remain in reconciliation output;
  // missing street components make them unmatched, not nonexistent.
  if (!id) return null;
  const coordinates = feature.geometry.coordinates as Position;
  if (!Number.isFinite(Number(coordinates?.[0])) || !Number.isFinite(Number(coordinates?.[1])))
    return null;
  return {
    internal_address_id: id,
    street,
    unit: String(properties.unit ?? ""),
    civic_number: String(properties.civic_number ?? ""),
    longitude: Number(coordinates[0]),
    latitude: Number(coordinates[1]),
  };
}

function canonicalFromFeature(feature: Feature): CanonicalAddress | null {
  const properties = feature.properties;
  const addressId = String(properties.address_id ?? feature.id ?? "");
  const locationId = String(properties.source_location_guid ?? properties.location_id ?? "");
  const coordinates = feature.geometry.coordinates as Position;
  if (
    !addressId ||
    !locationId ||
    !Number.isFinite(Number(coordinates?.[0])) ||
    !Number.isFinite(Number(coordinates?.[1]))
  )
    return null;
  return {
    address_id: addressId,
    location_id: locationId,
    street_key: canonicalStreetKey(properties),
    unit: String(properties.unit ?? ""),
    civic_number: String(
      properties.civic_number_base ?? properties.civic_number ?? "",
    ),
    longitude: Number(coordinates[0]),
    latitude: Number(coordinates[1]),
  };
}

export type LegacyHistoryReconciliation = {
  links: LegacyHistoryLink[];
  summary: {
    legacy_rows: number;
    confident: number;
    ambiguous: number;
    unmatched: number;
    activity_visibility_candidates: number;
    distance_m: {
      p50: number | null;
      p90: number | null;
      p95: number | null;
      max: number | null;
    };
  };
};

const percentile = (values: number[], quantile: number) =>
  values.length
    ? values[Math.floor((values.length - 1) * quantile)]
    : null;

/**
 * Link only old source rows that were not matched to a NAR unit by the normal
 * address reconciliation. Confident links are projected onto the canonical
 * household by SQLite views; ambiguous rows remain visible as historical
 * review points so a multi-unit building can never inherit all activity by
 * accident.
 */
export function reconcileLegacyHistory(
  existingFeatures: Feature[],
  canonicalFeatures: Feature[],
  unmatchedLegacyAddressIds: ReadonlySet<string>,
): LegacyHistoryReconciliation {
  const legacy = existingFeatures
    .map(legacyFromFeature)
    .filter((row): row is LegacyAddress =>
      Boolean(row && unmatchedLegacyAddressIds.has(row.internal_address_id)),
    );
  const canonical = canonicalFeatures
    .map(canonicalFromFeature)
    .filter((row): row is CanonicalAddress => Boolean(row));
  const byStreet = new Map<string, CanonicalAddress[]>();
  for (const row of canonical) {
    const list = byStreet.get(row.street_key) ?? [];
    list.push(row);
    byStreet.set(row.street_key, list);
  }

  const links = legacy.map((oldRow): LegacyHistoryLink => {
    const candidates = (byStreet.get(legacyHistoryStreetKey(oldRow.street)) ?? [])
      .map((row) => ({ row, distance: metresBetween(
        [oldRow.longitude, oldRow.latitude],
        [row.longitude, row.latitude],
      ) }))
      .filter((candidate) => candidate.distance <= 75)
      .sort((a, b) => a.distance - b.distance || a.row.address_id.localeCompare(b.row.address_id));
    const within = candidates.filter((candidate) => candidate.distance <= 50);
    const pool = within.length ? within : candidates;
    const locationDistances = new Map<string, number>();
    for (const candidate of pool)
      locationDistances.set(
        candidate.row.location_id,
        Math.min(locationDistances.get(candidate.row.location_id) ?? Infinity, candidate.distance),
      );
    const locations = [...locationDistances.entries()].sort((a, b) => a[1] - b[1]);
    const unit = normalizeUnit(oldRow.unit);
    const exactUnit = unit
      ? pool.filter((candidate) => normalizeUnit(candidate.row.unit) === unit)
      : [];
    const bestLocationId = locations[0]?.[0] ?? null;
    const bestLocationCandidates = bestLocationId
      ? pool.filter((candidate) => candidate.row.location_id === bestLocationId)
      : [];
    const preferred = exactUnit.length
      ? exactUnit[0]
      : bestLocationCandidates.length === 1
        ? bestLocationCandidates[0]
        : pool[0];
    const bestDistance = locations[0]?.[1] ?? null;
    const nextLocationDistance = locations[1]?.[1] ?? null;
    const hasStrongSingleLocation =
      Boolean(preferred) &&
      bestLocationCandidates.length === 1 &&
      (locations.length === 1 ||
        (nextLocationDistance != null && nextLocationDistance - (bestDistance ?? 0) >= 8));
    const exactUnitMatch = Boolean(exactUnit.length && bestLocationCandidates.some(
      (candidate) => candidate.row.address_id === exactUnit[0].row.address_id,
    ));
    if (!preferred || bestDistance == null) {
      return {
        legacy_address_id: oldRow.internal_address_id,
        canonical_address_id: null,
        canonical_location_id: null,
        match_status: "unmatched",
        distance_m: null,
        candidate_count: 0,
        candidate_location_count: 0,
        reason: "no_same_street_canonical_location_within_75m",
      };
    }
    if (bestDistance <= 50 && (exactUnitMatch || hasStrongSingleLocation)) {
      return {
        legacy_address_id: oldRow.internal_address_id,
        canonical_address_id: preferred.row.address_id,
        canonical_location_id: preferred.row.location_id,
        match_status: "confident",
        distance_m: bestDistance,
        candidate_count: pool.length,
        candidate_location_count: locations.length,
        reason: exactUnitMatch
          ? "same_street_nearest_exact_unit"
          : "same_street_unique_nearest_single_unit_location",
      };
    }
    return {
      legacy_address_id: oldRow.internal_address_id,
      canonical_address_id: null,
      canonical_location_id: bestLocationId,
      match_status: bestDistance <= 75 ? "ambiguous" : "unmatched",
      distance_m: bestDistance,
      candidate_count: pool.length,
      candidate_location_count: locations.length,
      reason: bestDistance <= 75
        ? bestLocationCandidates.length > 1
          ? "same_location_has_multiple_canonical_units"
          : "multiple_plausible_canonical_locations"
        : "nearest_candidate_exceeds_safe_threshold",
    };
  });
  const distances = links
    .map((link) => link.distance_m)
    .filter((value): value is number => value != null && Number.isFinite(value))
    .sort((a, b) => a - b);
  return {
    links,
    summary: {
      legacy_rows: links.length,
      confident: links.filter((link) => link.match_status === "confident").length,
      ambiguous: links.filter((link) => link.match_status === "ambiguous").length,
      unmatched: links.filter((link) => link.match_status === "unmatched").length,
      activity_visibility_candidates: links.filter((link) => link.match_status !== "confident").length,
      distance_m: {
        p50: percentile(distances, 0.5),
        p90: percentile(distances, 0.9),
        p95: percentile(distances, 0.95),
        max: distances.at(-1) ?? null,
      },
    },
  };
}
