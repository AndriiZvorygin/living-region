/**
 * The one display formatter for authoritative National Address Register
 * address parts.  The database and GeoJSON keep the source fields separate;
 * this module only turns those fields into the human-readable label used by
 * maps, search, routes, and household details.
 */

export type OfficialAddressParts = {
  civicNumber: unknown;
  civicNumberSuffix?: unknown;
  streetName: unknown;
  streetType?: unknown;
  streetDirection?: unknown;
  unit?: unknown;
};

const STREET_TYPES: Record<string, string> = {
  AV: "Avenue",
  AVE: "Avenue",
  AVENUE: "Avenue",
  BLVD: "Boulevard",
  BOULEVARD: "Boulevard",
  CIR: "Circle",
  CIRCLE: "Circle",
  CRES: "Crescent",
  CRESCENT: "Crescent",
  DR: "Drive",
  DRIVE: "Drive",
  HWY: "Highway",
  HIGHWAY: "Highway",
  LN: "Lane",
  LANE: "Lane",
  PKWY: "Parkway",
  PARKWAY: "Parkway",
  PL: "Place",
  PLACE: "Place",
  RD: "Road",
  ROAD: "Road",
  ST: "Street",
  STREET: "Street",
  TER: "Terrace",
  TERRACE: "Terrace",
  WAY: "Way",
};

const DIRECTIONS: Record<string, string> = {
  E: "East",
  EAST: "East",
  N: "North",
  NORTH: "North",
  NE: "Northeast",
  NORTHEAST: "Northeast",
  NW: "Northwest",
  NORTHWEST: "Northwest",
  S: "South",
  SOUTH: "South",
  SE: "Southeast",
  SOUTHEAST: "Southeast",
  SW: "Southwest",
  SOUTHWEST: "Southwest",
  W: "West",
  WEST: "West",
};

const text = (value: unknown) => String(value ?? "").trim();

/** Keep a civic suffix attached to the civic number (155A, 10411/2). */
export function formatCivicNumber(
  civicNumber: unknown,
  civicNumberSuffix: unknown = "",
) {
  const civic = text(civicNumber);
  const suffix = text(civicNumberSuffix);
  if (!suffix) return civic;
  if (!civic) return suffix;
  return civic.endsWith(suffix) ? civic : `${civic}${suffix}`;
}

function titleWord(value: string) {
  if (/^\d+(?:ST|ND|RD|TH)$/i.test(value)) {
    const match = value.match(/^(\d+)(ST|ND|RD|TH)$/i)!;
    return `${match[1]}${match[2].toLowerCase()}`;
  }
  if (/^[A-Z]\d+$/i.test(value)) return value.toUpperCase();
  const lower = value.toLocaleLowerCase("en-CA");
  return lower.replace(/(^|[-'’])([a-zà-ÿ])/g, (_m, prefix, letter) =>
    `${prefix}${letter.toLocaleUpperCase("en-CA")}`,
  );
}

export function formatOfficialStreet(
  streetName: unknown,
  streetType: unknown = "",
  streetDirection: unknown = "",
) {
  const name = text(streetName)
    .replace(/[,_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(titleWord)
    .join(" ");
  const typeKey = text(streetType).replace(/\./g, "").toUpperCase();
  const directionKey = text(streetDirection).replace(/\./g, "").toUpperCase();
  return [name, STREET_TYPES[typeKey] ?? text(streetType), DIRECTIONS[directionKey] ?? text(streetDirection)]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function formatUnit(unit: unknown) {
  const value = text(unit);
  if (!value) return "";
  return value.replace(/^(?:apt|apartment|unit|suite|ste)\s*/i, "").trim();
}

export function formatOfficialAddress(
  parts: OfficialAddressParts,
  includeUnit = true,
) {
  const civic = formatCivicNumber(parts.civicNumber, parts.civicNumberSuffix);
  const street = formatOfficialStreet(
    parts.streetName,
    parts.streetType,
    parts.streetDirection,
  );
  const unit = includeUnit ? formatUnit(parts.unit) : "";
  return [civic, street, unit ? `Unit ${unit}` : ""].filter(Boolean).join(" ").trim();
}

export function formatOfficialBaseAddress(parts: OfficialAddressParts) {
  return formatOfficialAddress(parts, false);
}
