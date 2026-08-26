import { describe, expect, it } from "vitest";
import { normalizedAddressKey, type AddressUnit } from "./owen-sound-address-foundation";
import { validateOwenSoundAddressNumbering } from "./owen-sound-address-numbering";
import type { Feature } from "./building-coverage";

const unit = (overrides: Partial<AddressUnit>): AddressUnit => ({
  address_id: "address",
  internal_address_id: "internal",
  location_id: "location",
  apartment_or_suite: "",
  civic_number: "808",
  civic_number_suffix: "",
  official_street_name: "2nd",
  official_street_type: "AVE",
  official_street_direction: "E",
  mailing_street_name: "2ND",
  mailing_street_type: "AVE",
  mailing_street_direction: "E",
  mailing_municipality: "OWEN SOUND",
  mailing_province: "ON",
  postal_code: "N4K1A1",
  building_use_code: "1",
  building_use: "residential",
  source_retrieval_date: "2026-08-26",
  source_file: "test",
  latitude: 0,
  longitude: 0.2,
  normalized_key: normalizedAddressKey("808", "2nd", "AVE", "E"),
  normalized_base_key: normalizedAddressKey("808", "2nd", "AVE", "E"),
  label: "808 2nd Avenue East",
  ...overrides,
});
const road = (name: string, coordinates: number[][], props: Record<string, unknown> = {}): Feature => ({
  type: "Feature",
  id: name,
  properties: { name, road_id: name, ...props },
  geometry: { type: "LineString", coordinates },
});

describe("Owen Sound civic-number diagnostics", () => {
  it("recognizes the documented cross-street hundred-block examples", () => {
    const roads = [
      road("2nd Avenue East", [[0.2, -1], [0.2, 1]], { left_from: 800, left_to: 898, right_from: 801, right_to: 899 }),
      road("8th Street East", [[-1, 0], [1, 0]], { left_from: 200, left_to: 298, right_from: 201, right_to: 299, left_parity: "E", right_parity: "O" }),
    ];
    const report = validateOwenSoundAddressNumbering([
      unit({ address_id: "avenue", location_id: "avenue", longitude: 0.2, latitude: 0.01, label: "808 2nd Avenue East" }),
      unit({ address_id: "street", location_id: "street", civic_number: "254", official_street_name: "8th", official_street_type: "ST", official_street_direction: "E", longitude: 0.2, latitude: 0.01, label: "254 8th Street East" }),
    ], roads);
    expect(report.summary.hundred_block_anomalies).toBe(0);
    expect(report.spot_checks.map((spot) => spot.label)).toEqual(expect.arrayContaining(["808 2nd Avenue East", "254 8th Street East"]));
  });

  it("preserves suffixes and diagnoses unusual directions without rejecting NAR rows", () => {
    const report = validateOwenSoundAddressNumbering([unit({ civic_number: "155", civic_number_suffix: "A", official_street_direction: "E" })], []);
    expect(report.summary.suffix_anomalies).toBe(0);
    expect(report.summary.direction_anomalies).toBe(0);
    expect(report.summary.address_units).toBe(1);
  });
});
