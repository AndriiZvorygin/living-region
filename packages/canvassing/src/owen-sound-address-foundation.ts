import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { stableId, type Feature, geometryContains, metresBetween } from "./building-coverage";

export const STATCAN_NAR_URL =
  "https://www150.statcan.gc.ca/n1/pub/46-26-0002/2022001/202606.zip";
export const STATCAN_NAR_CATALOGUE_URL =
  "https://www150.statcan.gc.ca/n1/en/catalogue/46260002";
export const STATCAN_NAR_PRODUCT_URL =
  "https://www150.statcan.gc.ca/n1/pub/46-26-0002/462600022022001-eng.htm";
export const STATCAN_NAR_GUIDE_URL =
  "https://www150.statcan.gc.ca/n1/pub/46-26-0002/462600022026001-eng.htm";
export const GREY_OPEN_DATA_URL = "https://maps.grey.ca/pages/open-data";
export const GREY_BUILDING_FOOTPRINTS_URL =
  "https://services1.arcgis.com/wE2uWQWlTTnVDgyt/arcgis/rest/services/Building_Footprints/FeatureServer";
export const GREY_BUILDING_FOOTPRINTS_ITEM_URL =
  "https://www.arcgis.com/sharing/rest/content/items/1c937b952166443f91914e1123f7b924?f=json";
export const GREY_TERMS_URL = "https://maps.grey.ca/pages/terms";
export const GREY_ADDRESS_LIKE_ITEM_URL =
  "https://www.arcgis.com/sharing/rest/content/items/961a5af1a0eb43b498747df759275973?f=json";

export const OWEN_SOUND_CSD_CODE = "3542059";
export const OWEN_SOUND_CSD_NAME = "Owen Sound";
export const ONTARIO_PROVINCE_CODE = "35";

export type BuildingUse =
  | "residential"
  | "partly_residential"
  | "non_residential"
  | "unknown";

export type CsvRow = Record<string, string>;

export type NarLocation = {
  loc_guid: string;
  csd_code: string;
  latitude: number;
  longitude: number;
  source_file: string;
};

export type AddressUnit = {
  address_id: string;
  internal_address_id: string;
  location_id: string;
  apartment_or_suite: string;
  civic_number: string;
  civic_number_suffix: string;
  official_street_name: string;
  official_street_type: string;
  official_street_direction: string;
  mailing_street_name: string;
  mailing_street_type: string;
  mailing_street_direction: string;
  mailing_municipality: string;
  mailing_province: string;
  postal_code: string;
  building_use_code: string;
  building_use: BuildingUse;
  source_retrieval_date: string;
  source_file: string;
  latitude: number;
  longitude: number;
  normalized_key: string;
  normalized_base_key: string;
  label: string;
};

export type ExistingAddress = {
  internal_address_id: string;
  label: string;
  civic_number: string;
  street: string;
  unit: string;
  longitude: number;
  latitude: number;
  external_source: string;
  external_id: string;
  structure_id: string | null;
  normalized_key: string;
  normalized_base_key: string;
};

export type ReconciliationMatch = {
  internal_address_id: string;
  address_id: string;
  status: "matched_exact" | "matched_base_distance" | "new";
  distance_m: number | null;
  structure_id: string | null;
};

export type AddressFoundationResult = {
  locations: NarLocation[];
  units: AddressUnit[];
  source_counts: {
    residential: number;
    partly_residential: number;
    non_residential: number;
    unknown: number;
  };
  validation: {
    addresses_seen_in_ontario_files: number;
    addresses_with_owen_sound_name: number;
    addresses_joined_to_owen_sound_locations: number;
    addresses_missing_location: number;
    locations_in_csd: number;
    locations_with_coordinates: number;
    records_outside_boundary: number;
    records_missing_coordinates: number;
    duplicate_addr_guid: number;
    duplicate_normalized_addresses: number;
    conflicting_normalized_addresses: number;
    outside_boundary_sample: Array<{
      address_id: string;
      location_id: string;
      civic_number: string;
      street: string;
      building_use_code: string;
      longitude: number;
      latitude: number;
    }>;
  };
};

const asString = (value: unknown) => String(value ?? "").trim();

/** Parse one RFC-4180-ish CSV record. NAR files do not contain embedded newlines. */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index++;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      fields.push(field);
      field = "";
    } else field += character;
  }
  fields.push(field);
  return fields;
}

export function csvRecordParser(onRecord: (row: string[]) => void) {
  let buffer = "";
  return {
    push(chunk: string) {
      buffer += chunk;
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        if (line) onRecord(parseCsvLine(line));
        newline = buffer.indexOf("\n");
      }
    },
    finish() {
      const line = buffer.replace(/\r$/, "");
      if (line) onRecord(parseCsvLine(line));
    },
  };
}

export function normalizeAddressText(value: unknown): string {
  return asString(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

const streetTypeAliases: Record<string, string> = {
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
  NE: "NE",
  NORTHEAST: "NE",
  NW: "NW",
  NORTHWEST: "NW",
  S: "S",
  SOUTH: "S",
  SE: "SE",
  SOUTHEAST: "SE",
  SW: "SW",
  SOUTHWEST: "SW",
  W: "W",
  WEST: "W",
};

function normalizeCivic(value: unknown) {
  return normalizeAddressText(value).replace(/\s+/g, "");
}

function normalizeUnit(value: unknown) {
  const normalized = normalizeAddressText(value).replace(/\s+/g, "");
  const stripped = normalized.replace(/^(APT|APARTMENT|UNIT|SUITE|STE)(?=\w)/, "");
  return stripped || normalized;
}

export function normalizeStreetParts(
  name: unknown,
  type: unknown = "",
  direction: unknown = "",
) {
  const nameParts = normalizeAddressText(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => streetTypeAliases[part] ?? directionAliases[part] ?? part);
  const typeValue = streetTypeAliases[normalizeAddressText(type)] ?? normalizeAddressText(type);
  const directionValue = directionAliases[normalizeAddressText(direction)] ?? normalizeAddressText(direction);
  return [...nameParts, typeValue, directionValue].filter(Boolean).join(" ");
}

export function normalizedAddressKey(
  civicNumber: unknown,
  streetName: unknown,
  streetType = "",
  streetDirection = "",
  unit = "",
) {
  return [
    normalizeCivic(civicNumber),
    normalizeStreetParts(streetName, streetType, streetDirection),
    normalizeUnit(unit),
  ].join("|");
}

export function normalizedBaseAddressKey(
  civicNumber: unknown,
  streetName: unknown,
  streetType = "",
  streetDirection = "",
) {
  return normalizedAddressKey(civicNumber, streetName, streetType, streetDirection, "");
}

export function classifyBuildingUse(value: unknown): BuildingUse {
  switch (normalizeAddressText(value)) {
    case "1":
      return "residential";
    case "2":
      return "partly_residential";
    case "3":
      return "non_residential";
    default:
      return "unknown";
  }
}

export function utm17NorthToWgs84(easting: number, northing: number): [number, number] {
  const a = 6378137;
  const eccSquared = 0.00669438;
  const k0 = 0.9996;
  const x = easting - 500000;
  const y = northing;
  const eccPrimeSquared = eccSquared / (1 - eccSquared);
  const m = y / k0;
  const mu = m / (a * (1 - eccSquared / 4 - (3 * eccSquared ** 2) / 64 - (5 * eccSquared ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - eccSquared)) / (1 + Math.sqrt(1 - eccSquared));
  const j1 = (3 * e1) / 2 - (27 * e1 ** 3) / 32;
  const j2 = (21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32;
  const j3 = (151 * e1 ** 3) / 96;
  const j4 = (1097 * e1 ** 4) / 512;
  const fp = mu + j1 * Math.sin(2 * mu) + j2 * Math.sin(4 * mu) + j3 * Math.sin(6 * mu) + j4 * Math.sin(8 * mu);
  const sinFp = Math.sin(fp);
  const cosFp = Math.cos(fp);
  const tanFp = Math.tan(fp);
  const c1 = eccPrimeSquared * cosFp ** 2;
  const t1 = tanFp ** 2;
  const r1 = (a * (1 - eccSquared)) / (1 - eccSquared * sinFp ** 2) ** 1.5;
  const n1 = a / Math.sqrt(1 - eccSquared * sinFp ** 2);
  const d = x / (n1 * k0);
  const q1 = n1 * tanFp / r1;
  const q2 = d ** 2 / 2;
  const q3 = ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * eccPrimeSquared) * d ** 4) / 24;
  const q4 = ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * eccPrimeSquared - 3 * c1 ** 2) * d ** 6) / 720;
  const latitude = fp - q1 * (q2 - q3 + q4);
  const q5 = d;
  const q6 = ((1 + 2 * t1 + c1) * d ** 3) / 6;
  const q7 = ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * eccPrimeSquared + 24 * t1 ** 2) * d ** 5) / 120;
  const longitude = (-81 * Math.PI) / 180 + (q5 - q6 + q7) / cosFp;
  return [(longitude * 180) / Math.PI, (latitude * 180) / Math.PI];
}

function finiteCoordinate(value: unknown) {
  if (asString(value) === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) > 0 ? number : null;
}

function csvRows(headers: string[], values: string[]): CsvRow {
  const result: CsvRow = {};
  headers.forEach((header, index) => {
    result[header.replace(/^\uFEFF/, "")] = values[index] ?? "";
  });
  return result;
}

async function commandOutput(command: string, args: string[]) {
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
  const chunks: Buffer[] = [];
  const errors: Buffer[] = [];
  child.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => errors.push(Buffer.from(chunk)));
  const code = await new Promise<number>((resolvePromise, reject) => {
    child.once("error", reject);
    child.once("close", (exitCode) => resolvePromise(exitCode ?? 1));
  });
  if (code !== 0) throw new Error(`${command} failed: ${Buffer.concat(errors).toString("utf8")}`);
  return Buffer.concat(chunks).toString("utf8");
}

async function zipEntries(zipPath: string) {
  return (await commandOutput("unzip", ["-Z1", zipPath]))
    .split(/\r?\n/)
    .filter(Boolean);
}

async function forEachZipCsv(zipPath: string, entry: string, onRow: (row: CsvRow) => void) {
  const child = spawn("unzip", ["-p", zipPath, entry], { stdio: ["ignore", "pipe", "pipe"] });
  let headers: string[] | undefined;
  const parser = csvRecordParser((values) => {
    if (!headers) headers = values;
    else onRow(csvRows(headers, values));
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk.toString("utf8")));
  for await (const chunk of child.stdout) parser.push(Buffer.from(chunk).toString("utf8"));
  parser.finish();
  const code = await new Promise<number>((resolvePromise, reject) => {
    child.once("error", reject);
    child.once("close", (exitCode) => resolvePromise(exitCode ?? 1));
  });
  if (code !== 0) throw new Error(`unzip failed for ${entry}: ${stderr}`);
}

export function pointInBoundary(point: [number, number], boundary: Feature[]) {
  return boundary.some((feature) => geometryContains(feature.geometry, point));
}

function unitLabel(row: CsvRow) {
  return asString(row.APT_NO_LABEL);
}

function officialLabel(row: CsvRow) {
  const civic = [asString(row.CIVIC_NO), asString(row.CIVIC_NO_SUFFIX)].filter(Boolean).join("");
  const street = normalizeStreetParts(row.OFFICIAL_STREET_NAME, row.OFFICIAL_STREET_TYPE, row.OFFICIAL_STREET_DIR)
    .replace(/\bAVE\b/g, "Avenue")
    .replace(/\bST\b/g, "Street")
    .replace(/\bRD\b/g, "Road")
    .replace(/\bE\b/g, "East")
    .replace(/\bW\b/g, "West")
    .replace(/\bN\b/g, "North")
    .replace(/\bS\b/g, "South");
  const unit = unitLabel(row);
  return `${civic} ${street}${unit ? ` Unit ${unit}` : ""}`.trim();
}

export async function downloadNar(zipPath: string, url = STATCAN_NAR_URL) {
  await mkdir(dirname(zipPath), { recursive: true });
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`NAR download failed: ${response.status} ${response.statusText}`);
  await pipeline(response.body, createWriteStream(zipPath));
}

export async function loadBoundary(path: string): Promise<Feature[]> {
  const value = JSON.parse(await readFile(path, "utf8"));
  return (value.features ?? []) as Feature[];
}

export async function extractOwenSoundNar(options: {
  zipPath: string;
  boundary: Feature[];
  retrievalDate: string;
}): Promise<AddressFoundationResult> {
  const entries = await zipEntries(options.zipPath);
  const locationEntries = entries.filter((entry) => /^Locations\/Location_35(?:_part_\d+)?\.csv$/i.test(entry));
  const addressEntries = entries.filter((entry) => /^Addresses\/Address_35(?:_part_\d+)?\.csv$/i.test(entry));
  if (!locationEntries.length || !addressEntries.length) throw new Error("The supplied NAR ZIP does not contain Ontario location and address files");

  const locations = new Map<string, NarLocation>();
  const locationIdsInCsd = new Set<string>();
  let locationsWithCoordinates = 0;
  for (const entry of locationEntries)
    await forEachZipCsv(options.zipPath, entry, (row) => {
      if (asString(row.CSD_CODE) !== OWEN_SOUND_CSD_CODE) return;
      locationIdsInCsd.add(asString(row.LOC_GUID));
      const latitude = finiteCoordinate(row.BF_REPPOINT_LATITUDE) ?? finiteCoordinate(row.BG_LATITUDE);
      const longitude = finiteCoordinate(row.BF_REPPOINT_LONGITUDE) ?? finiteCoordinate(row.BG_LONGITUDE);
      if (latitude == null || longitude == null) return;
      const locGuid = asString(row.LOC_GUID);
      if (!locations.has(locGuid)) locationsWithCoordinates++;
      locations.set(locGuid, {
        loc_guid: locGuid,
        csd_code: asString(row.CSD_CODE),
        latitude,
        longitude,
        source_file: entry,
      });
    });

  const units: AddressUnit[] = [];
  const seenAddressIds = new Set<string>();
  const normalizedGroups = new Map<string, AddressUnit[]>();
  let addressesSeenInOntarioFiles = 0;
  let addressesWithOwenSoundName = 0;
  let addressesMissingLocation = 0;
  let recordsOutsideBoundary = 0;
  let recordsMissingCoordinates = 0;
  const outsideBoundarySample: AddressFoundationResult["validation"]["outside_boundary_sample"] = [];
  for (const entry of addressEntries)
    await forEachZipCsv(options.zipPath, entry, (row) => {
      if (asString(row.PROV_CODE) !== ONTARIO_PROVINCE_CODE) return;
      addressesSeenInOntarioFiles++;
      if (asString(row.CSD_ENG_NAME) !== OWEN_SOUND_CSD_NAME) return;
      addressesWithOwenSoundName++;
      const locationId = asString(row.LOC_GUID);
      const location = locations.get(locationId);
      if (!location) {
        if (locationIdsInCsd.has(locationId)) recordsMissingCoordinates++;
        else addressesMissingLocation++;
        return;
      }
      const point: [number, number] = [location.longitude, location.latitude];
      if (!pointInBoundary(point, options.boundary)) {
        recordsOutsideBoundary++;
        if (outsideBoundarySample.length < 25)
          outsideBoundarySample.push({
            address_id: asString(row.ADDR_GUID),
            location_id: locationId,
            civic_number: [asString(row.CIVIC_NO), asString(row.CIVIC_NO_SUFFIX)].filter(Boolean).join(""),
            street: normalizeStreetParts(row.OFFICIAL_STREET_NAME, row.OFFICIAL_STREET_TYPE, row.OFFICIAL_STREET_DIR),
            building_use_code: asString(row.BU_USE),
            longitude: location.longitude,
            latitude: location.latitude,
          });
        return;
      }
      const addressId = asString(row.ADDR_GUID);
      if (!addressId || seenAddressIds.has(addressId)) return;
      seenAddressIds.add(addressId);
      const civicNumber = [asString(row.CIVIC_NO), asString(row.CIVIC_NO_SUFFIX)].filter(Boolean).join("");
      const buildingUseCode = asString(row.BU_USE);
      const unit: AddressUnit = {
        address_id: addressId,
        internal_address_id: stableId("address", `statcan-nar:${addressId}`),
        location_id: locationId,
        apartment_or_suite: unitLabel(row),
        civic_number: asString(row.CIVIC_NO),
        civic_number_suffix: asString(row.CIVIC_NO_SUFFIX),
        official_street_name: asString(row.OFFICIAL_STREET_NAME),
        official_street_type: asString(row.OFFICIAL_STREET_TYPE),
        official_street_direction: asString(row.OFFICIAL_STREET_DIR),
        mailing_street_name: asString(row.MAIL_STREET_NAME),
        mailing_street_type: asString(row.MAIL_STREET_TYPE),
        mailing_street_direction: asString(row.MAIL_STREET_DIR),
        mailing_municipality: asString(row.MAIL_MUN_NAME),
        mailing_province: asString(row.MAIL_PROV_ABVN),
        postal_code: asString(row.MAIL_POSTAL_CODE),
        building_use_code: buildingUseCode,
        building_use: classifyBuildingUse(buildingUseCode),
        source_retrieval_date: options.retrievalDate,
        source_file: entry,
        latitude: location.latitude,
        longitude: location.longitude,
        normalized_key: normalizedAddressKey(civicNumber, row.OFFICIAL_STREET_NAME, row.OFFICIAL_STREET_TYPE, row.OFFICIAL_STREET_DIR, unitLabel(row)),
        normalized_base_key: normalizedBaseAddressKey(civicNumber, row.OFFICIAL_STREET_NAME, row.OFFICIAL_STREET_TYPE, row.OFFICIAL_STREET_DIR),
        label: officialLabel(row),
      };
      units.push(unit);
      const group = normalizedGroups.get(unit.normalized_key) ?? [];
      group.push(unit);
      normalizedGroups.set(unit.normalized_key, group);
    });

  const sourceCounts = { residential: 0, partly_residential: 0, non_residential: 0, unknown: 0 };
  for (const unit of units) sourceCounts[unit.building_use]++;
  const duplicateGroups = [...normalizedGroups.values()].filter((group) => group.length > 1);
  const conflictingGroups = duplicateGroups.filter((group) => new Set(group.map((unit) => unit.address_id)).size > 1);
  return {
    locations: [...locations.values()].sort((a, b) => a.loc_guid.localeCompare(b.loc_guid)),
    units: units.sort((a, b) => a.normalized_key.localeCompare(b.normalized_key) || a.address_id.localeCompare(b.address_id)),
    source_counts: sourceCounts,
    validation: {
      addresses_seen_in_ontario_files: addressesSeenInOntarioFiles,
      addresses_with_owen_sound_name: addressesWithOwenSoundName,
      addresses_joined_to_owen_sound_locations: units.length,
      addresses_missing_location: addressesMissingLocation,
      locations_in_csd: locationIdsInCsd.size,
      locations_with_coordinates: locationsWithCoordinates,
      records_outside_boundary: recordsOutsideBoundary,
      records_missing_coordinates: recordsMissingCoordinates,
      duplicate_addr_guid: Math.max(0, addressesWithOwenSoundName - seenAddressIds.size - addressesMissingLocation - recordsMissingCoordinates - recordsOutsideBoundary),
      duplicate_normalized_addresses: duplicateGroups.length,
      conflicting_normalized_addresses: conflictingGroups.length,
      outside_boundary_sample: outsideBoundarySample,
    },
  };
}

function existingFromFeature(feature: Feature): ExistingAddress | null {
  const p = feature.properties;
  const internal = asString(p.address_id ?? feature.id);
  if (!internal) return null;
  const civic = asString(p.civic_number);
  const street = asString(p.street);
  if (!civic || !street) return null;
  const unit = asString(p.unit);
  return {
    internal_address_id: internal,
    label: asString(p.label),
    civic_number: civic,
    street,
    unit,
    longitude: Number(feature.geometry.coordinates[0]),
    latitude: Number(feature.geometry.coordinates[1]),
    external_source: asString(p.external_source),
    external_id: asString(p.external_id),
    structure_id: asString(p.structure_id) || null,
    normalized_key: normalizedAddressKey(civic, street, "", "", unit),
    normalized_base_key: normalizedBaseAddressKey(civic, street),
  };
}

export function reconcileExistingAddresses(
  units: AddressUnit[],
  existingFeatures: Feature[],
): {
  matches: ReconciliationMatch[];
  unmatchedExisting: ExistingAddress[];
  existing: ExistingAddress[];
  counts: Record<string, number>;
} {
  const existing = existingFeatures.map(existingFromFeature).filter((value): value is ExistingAddress => Boolean(value));
  const byKey = new Map<string, ExistingAddress[]>();
  const byBase = new Map<string, ExistingAddress[]>();
  for (const row of existing) {
    (byKey.get(row.normalized_key) ?? (byKey.set(row.normalized_key, []), byKey.get(row.normalized_key)!)).push(row);
    (byBase.get(row.normalized_base_key) ?? (byBase.set(row.normalized_base_key, []), byBase.get(row.normalized_base_key)!)).push(row);
  }
  const used = new Set<string>();
  const matches: ReconciliationMatch[] = [];
  for (const unit of units) {
    const exact = (byKey.get(unit.normalized_key) ?? []).filter((row) => !used.has(row.internal_address_id));
    const candidate = exact[0];
    if (candidate) {
      used.add(candidate.internal_address_id);
      matches.push({ internal_address_id: candidate.internal_address_id, address_id: unit.address_id, status: "matched_exact", distance_m: metresBetween([unit.longitude, unit.latitude], [candidate.longitude, candidate.latitude]), structure_id: candidate.structure_id });
      continue;
    }
    const baseCandidates = (byBase.get(unit.normalized_base_key) ?? [])
      .filter((row) => !used.has(row.internal_address_id))
      .map((row) => ({ row, distance: metresBetween([unit.longitude, unit.latitude], [row.longitude, row.latitude]) }))
      .filter((candidateRow) => candidateRow.distance <= 75)
      .sort((a, b) => a.distance - b.distance || a.row.internal_address_id.localeCompare(b.row.internal_address_id));
    if (baseCandidates[0]) {
      used.add(baseCandidates[0].row.internal_address_id);
      matches.push({ internal_address_id: baseCandidates[0].row.internal_address_id, address_id: unit.address_id, status: "matched_base_distance", distance_m: baseCandidates[0].distance, structure_id: baseCandidates[0].row.structure_id });
    } else matches.push({ internal_address_id: unit.internal_address_id, address_id: unit.address_id, status: "new", distance_m: null, structure_id: null });
  }
  const unmatchedExisting = existing.filter((row) => !used.has(row.internal_address_id));
  const counts: Record<string, number> = { matched_exact: 0, matched_base_distance: 0, new: 0 };
  for (const match of matches) counts[match.status]++;
  return { matches, unmatchedExisting, existing, counts };
}

function unitFeature(unit: AddressUnit, match: ReconciliationMatch, category: string): Feature {
  return {
    type: "Feature",
    id: match.internal_address_id,
    properties: {
      address_id: match.internal_address_id,
      source_address_guid: unit.address_id,
      source_location_guid: unit.location_id,
      external_source: "statistics_canada_national_address_register",
      external_id: unit.address_id,
      source_retrieval_date: unit.source_retrieval_date,
      civic_number: [unit.civic_number, unit.civic_number_suffix].filter(Boolean).join(""),
      civic_number_suffix: unit.civic_number_suffix,
      street: normalizeStreetParts(unit.official_street_name, unit.official_street_type, unit.official_street_direction),
      unit: unit.apartment_or_suite,
      label: unit.label,
      official_street_name: unit.official_street_name,
      official_street_type: unit.official_street_type,
      official_street_direction: unit.official_street_direction,
      normalized_address: unit.normalized_key,
      normalized_base_address: unit.normalized_base_key,
      building_use_code: unit.building_use_code,
      building_use: unit.building_use,
      address_category: category,
      mailing_street_name: unit.mailing_street_name,
      mailing_street_type: unit.mailing_street_type,
      mailing_street_direction: unit.mailing_street_direction,
      mailing_municipality: unit.mailing_municipality,
      mailing_province: unit.mailing_province,
      postal_code: unit.postal_code,
      // The NAR establishes the civic address/location, but it does not by
      // itself claim that the point is a matched roof in our separate
      // building layer. Keep the existing association contract honest:
      // unmatched points remain explicit review points.
      association_status: match.structure_id
        ? "statcan_authoritative_address_location"
        : "unresolved",
      address_source_status: "authoritative",
      association_candidates: [],
      location_id: unit.location_id,
      structure_id: match.structure_id,
    },
    geometry: { type: "Point", coordinates: [unit.longitude, unit.latitude] },
  };
}

export function groupAddressUnitsByLocation(units: AddressUnit[]) {
  const grouped = new Map<string, AddressUnit[]>();
  for (const unit of units) {
    const atLocation = grouped.get(unit.location_id) ?? [];
    atLocation.push(unit);
    grouped.set(unit.location_id, atLocation);
  }
  return grouped;
}

function locationFeature(location: NarLocation, units: AddressUnit[]): Feature {
  const atLocation = groupAddressUnitsByLocation(units).get(location.loc_guid) ?? [];
  const counts = { residential: 0, partly_residential: 0, non_residential: 0, unknown: 0 };
  for (const unit of atLocation) counts[unit.building_use]++;
  return {
    type: "Feature",
    id: location.loc_guid,
    properties: {
      location_id: location.loc_guid,
      source: "statistics_canada_national_address_register",
      source_retrieval_date: atLocation[0]?.source_retrieval_date ?? null,
      csd_code: location.csd_code,
      address_unit_count: atLocation.length,
      residential_unit_count: counts.residential + counts.partly_residential,
      residential_unit_count_strict: counts.residential,
      partly_residential_unit_count: counts.partly_residential,
      non_residential_unit_count: counts.non_residential,
      unknown_use_unit_count: counts.unknown,
      address_ids: atLocation.map((unit) => unit.address_id),
      labels: atLocation.map((unit) => unit.label),
    },
    geometry: { type: "Point", coordinates: [location.longitude, location.latitude] },
  };
}

export async function writeFoundationOutputs(options: {
  result: AddressFoundationResult;
  reconciliation: ReturnType<typeof reconcileExistingAddresses>;
  existingFeatures: Feature[];
  outDir: string;
  publishAddressesPath?: string;
  sourceManifest: Record<string, unknown>;
}) {
  const { result, reconciliation } = options;
  const matches = new Map(reconciliation.matches.map((match) => [match.address_id, match]));
  const primary = result.units.filter((unit) => ["residential", "partly_residential"].includes(unit.building_use));
  const featureFor = (unit: AddressUnit) =>
    unitFeature(
      unit,
      matches.get(unit.address_id) ?? {
        internal_address_id: unit.internal_address_id,
        address_id: unit.address_id,
        status: "new",
        distance_m: null,
        structure_id: null,
      },
      unit.building_use,
    );
  const allFeatures = result.units.map(featureFor);
  const residentialFeatures = primary.map(featureFor);
  const unknownFeatures = result.units.filter((unit) => unit.building_use === "unknown").map(featureFor);
  const nonResidentialFeatures = result.units.filter((unit) => unit.building_use === "non_residential").map(featureFor);
  const locations = result.locations.map((location) => locationFeature(location, result.units));
  const legacyUnmatched = reconciliation.unmatchedExisting.map((row) => ({
    type: "Feature" as const,
    properties: { ...row, review_status: "legacy_existing_stop_not_matched_to_june_2026_nar" },
    geometry: { type: "Point", coordinates: [row.longitude, row.latitude] },
  }));
  await mkdir(options.outDir, { recursive: true });
  const writeGeoJson = (name: string, features: Feature[]) =>
    writeFile(join(options.outDir, name), JSON.stringify({ type: "FeatureCollection", features }) + "\n");
  await Promise.all([
    writeGeoJson("address-units.geojson", allFeatures),
    writeGeoJson("address-units-residential.geojson", residentialFeatures),
    writeGeoJson("address-units-unknown.geojson", unknownFeatures),
    writeGeoJson("address-units-non-residential.geojson", nonResidentialFeatures),
    writeGeoJson("canvassing-locations.geojson", locations),
    writeGeoJson("legacy-unmatched-stops.geojson", legacyUnmatched),
    writeFile(join(options.outDir, "source-provenance.json"), JSON.stringify(options.sourceManifest, null, 2) + "\n"),
    writeFile(join(options.outDir, "validation-report.json"), JSON.stringify({
      generated_at: new Date().toISOString(),
      source_counts: result.source_counts,
      validation: result.validation,
      reconciliation: {
        ...reconciliation.counts,
        existing_feature_count: existingFeaturesForReport(options.existingFeatures),
        existing_osm_stop_features: existingFeaturesForReport(options.existingFeatures, "openstreetmap"),
        existing_address_rows: reconciliation.existing.length,
        existing_3426_osm_stops: existingFeaturesForReport(options.existingFeatures, "openstreetmap"),
        unmatched_existing_rows: reconciliation.unmatchedExisting.length,
      },
      unique_physical_locations: locations.length,
      multi_unit_locations: locations.filter((feature) => Number(feature.properties.residential_unit_count) > 1).length,
      unique_streets: new Set(primary.map((unit) => normalizeStreetParts(unit.official_street_name, unit.official_street_type, unit.official_street_direction))).size,
      records_lacking_usable_coordinates: result.validation.records_missing_coordinates,
      records_outside_municipal_boundary: result.validation.records_outside_boundary,
    }, null, 2) + "\n"),
    writeFile(join(options.outDir, "reconciliation.json"), JSON.stringify({
      matches: reconciliation.matches,
      unmatched_existing: reconciliation.unmatchedExisting,
    }, null, 2) + "\n"),
  ]);
  if (options.publishAddressesPath)
    await writeFile(options.publishAddressesPath, JSON.stringify({ type: "FeatureCollection", features: residentialFeatures }) + "\n");
  return { residentialFeatures, allFeatures, locations, legacyUnmatched };
}

function existingFeaturesForReport(existingFeatures: Feature[], source?: string) {
  return existingFeatures.filter((feature) => !source || feature.properties.external_source === source).length;
}

export async function loadExistingFeatures(path: string): Promise<Feature[]> {
  const value = JSON.parse(await readFile(path, "utf8"));
  return (value.features ?? []) as Feature[];
}

export function migrationComparison(result: AddressFoundationResult, existing: Feature[]) {
  const reconciliation = reconcileExistingAddresses(result.units.filter((unit) => ["residential", "partly_residential"].includes(unit.building_use)), existing);
  return {
    existing_total: reconciliation.existing.length,
    existing_feature_count: existingFeaturesForReport(existing),
    existing_3426_osm_stops: existingFeaturesForReport(existing, "openstreetmap"),
    official_primary_units: result.units.filter((unit) => ["residential", "partly_residential"].includes(unit.building_use)).length,
    ...reconciliation.counts,
    unmatched_existing: reconciliation.unmatchedExisting.length,
  };
}

export async function discoverCachedNar(cacheDir: string) {
  const files = await readdir(cacheDir).catch(() => [] as string[]);
  return files.filter((file) => file.endsWith(".zip")).map((file) => resolve(cacheDir, file));
}
