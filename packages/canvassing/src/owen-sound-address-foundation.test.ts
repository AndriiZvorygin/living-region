import { describe, expect, it } from "vitest";
import {
  classifyBuildingUse,
  csvRecordParser,
  groupAddressUnitsByLocation,
  normalizeStreetParts,
  normalizedAddressKey,
  parseCsvLine,
  pointInBoundary,
  reconcileExistingAddresses,
  utm17NorthToWgs84,
  type AddressUnit,
} from "./owen-sound-address-foundation";
import type { Feature } from "./building-coverage";

const unit = (overrides: Partial<AddressUnit> = {}): AddressUnit => ({
  address_id: "addr-guid",
  internal_address_id: "address_new",
  location_id: "loc-guid",
  apartment_or_suite: "",
  civic_number: "123",
  civic_number_suffix: "",
  official_street_name: "9th",
  official_street_type: "AVE",
  official_street_direction: "E",
  mailing_street_name: "9TH AVE",
  mailing_street_type: "",
  mailing_street_direction: "E",
  mailing_municipality: "OWEN SOUND",
  mailing_province: "ON",
  postal_code: "N4K1A1",
  building_use_code: "1",
  building_use: "residential",
  source_retrieval_date: "2026-08-26",
  source_file: "Addresses/Address_35_part_1.csv",
  latitude: 44.56,
  longitude: -80.93,
  normalized_key: normalizedAddressKey("123", "9th", "AVE", "E"),
  normalized_base_key: normalizedAddressKey("123", "9th", "AVE", "E"),
  label: "123 9th A Avenue East",
  ...overrides,
});

describe("Owen Sound address foundation utilities", () => {
  it("parses quoted CSV fields and escaped quotes", () => {
    expect(parseCsvLine('"123 Main, East","A ""quoted"" unit",x')).toEqual([
      "123 Main, East",
      'A "quoted" unit',
      "x",
    ]);
  });

  it("handles records split across streamed chunks", () => {
    const rows: string[][] = [];
    const parser = csvRecordParser((row) => {
      if (row[0] !== "a") rows.push(row);
    });
    parser.push("a,b\n1,");
    parser.push("2\n3,4\n");
    parser.finish();
    expect(rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("normalizes official and existing street conventions", () => {
    expect(normalizeStreetParts("9th A", "AVE", "E")).toBe("9TH A AVE E");
    expect(normalizeStreetParts("9th Avenue East")).toBe("9TH AVE E");
    expect(normalizedAddressKey("123", "9th Avenue East", "", "", "Unit 2")).toBe(
      "123|9TH AVE E|2",
    );
  });

  it("maps all NAR building-use codes without treating unknown as residential", () => {
    expect(classifyBuildingUse("1")).toBe("residential");
    expect(classifyBuildingUse("2")).toBe("partly_residential");
    expect(classifyBuildingUse("3")).toBe("non_residential");
    expect(classifyBuildingUse("4")).toBe("unknown");
    expect(classifyBuildingUse("")).toBe("unknown");
  });

  it("keeps apartment and house units grouped at one physical location", () => {
    const units = [
      unit({ address_id: "house", apartment_or_suite: "", location_id: "loc" }),
      unit({ address_id: "apt-1", apartment_or_suite: "1", location_id: "loc" }),
      unit({ address_id: "other", location_id: "other-loc" }),
    ];
    expect(groupAddressUnitsByLocation(units).get("loc")?.map((row) => row.address_id)).toEqual([
      "house",
      "apt-1",
    ]);
    expect(groupAddressUnitsByLocation(units).get("other-loc")).toHaveLength(1);
  });

  it("supports explicit municipal-boundary exclusion", () => {
    const boundary: Feature = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
      },
    };
    expect(pointInBoundary([0.5, 0.5], [boundary])).toBe(true);
    expect(pointInBoundary([2, 0.5], [boundary])).toBe(false);
  });

  it("converts UTM zone 17 north coordinates to WGS84", () => {
    const [longitude, latitude] = utm17NorthToWgs84(500000, 4930000);
    expect(longitude).toBeCloseTo(-81, 4);
    expect(latitude).toBeCloseTo(44.523, 2);
  });

  it("reuses existing internal IDs for exact and distance-safe matches", () => {
    const existing: Feature[] = [
      {
        type: "Feature",
        properties: {
          address_id: "address_old",
          civic_number: "123",
          street: "9th Avenue East",
          unit: "",
          label: "123 9th Avenue East",
          external_source: "openstreetmap",
          external_id: "n1",
          structure_id: "structure_old",
        },
        geometry: { type: "Point", coordinates: [-80.93001, 44.56] },
      },
    ];
    const result = reconcileExistingAddresses([unit()], existing);
    expect(result.matches[0]).toMatchObject({
      internal_address_id: "address_old",
      status: "matched_exact",
      structure_id: "structure_old",
    });
    expect(result.unmatchedExisting).toHaveLength(0);
  });

  it("accepts legacy exports that name the stable id internal_address_id", () => {
    const result = reconcileExistingAddresses(
      [unit({ address_id: "nar-guid", civic_number: "12", official_street_name: "Main", official_street_type: "ST" })],
      [{
        type: "Feature",
        properties: {
          internal_address_id: "address_legacy",
          civic_number: "99",
          street: "Old Street",
          unit: "",
          label: "99 Old Street",
          external_source: "legacy",
          structure_id: "structure-old",
        },
        geometry: { type: "Point", coordinates: [-80.95, 44.56] },
      }],
    );
    expect(result.unmatchedExisting).toHaveLength(1);
    expect(result.unmatchedExisting[0].internal_address_id).toBe("address_legacy");
  });
});
