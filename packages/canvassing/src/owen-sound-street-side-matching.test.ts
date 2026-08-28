import { describe, expect, it } from "vitest";
import type { Feature } from "./building-coverage";
import type { AddressUnit, NarLocation } from "./owen-sound-address-foundation";
import {
  addressStreetKey,
  civicHundredBlock,
  civicParity,
  matchUnresolvedNarLocations,
  parseRoofAddress,
  streetSideForPoint,
} from "./owen-sound-street-side-matching";
import { placeNarLocations } from "./owen-sound-footprint-placement";

const road = (): Feature => ({
  type: "Feature",
  id: "example-road",
  properties: {
    name: "7 AVE E",
    left_from: 700,
    left_to: 798,
    left_parity: "E",
    right_from: 701,
    right_to: 799,
    right_parity: "O",
  },
  geometry: { type: "LineString", coordinates: [[0, 0], [0.01, 0]] },
});

const roof = (
  id: string,
  number: string,
  x: number,
  y = 0.00006,
  street = "7 AVE E",
): Feature => ({
  type: "Feature",
  id,
  properties: {
    structure_id: id,
    external_source: "openstreetmap",
    external_id: id,
    building_type: "residential",
    civic_numbers: [number],
    civic_label: `${number} ${street}`,
    fallback_civic_number: number,
    fallback_street: street,
    canvassable: true,
  },
  geometry: {
    type: "Polygon",
    coordinates: [[
      [x - 0.00002, y - 0.00002],
      [x + 0.00002, y - 0.00002],
      [x + 0.00002, y + 0.00002],
      [x - 0.00002, y + 0.00002],
      [x - 0.00002, y - 0.00002],
    ]],
  },
});

const location = (
  id: string,
  number: string,
  longitude: number,
  latitude = 0.0002,
  coordinateSource: NarLocation["coordinate_source"] = "nar_building",
): NarLocation => ({
  loc_guid: id,
  csd_code: "3542059",
  longitude,
  latitude,
  coordinate_source: coordinateSource,
  source_file: "test",
});

const unit = (locationId: string, number: string): AddressUnit => ({
  address_id: `${locationId}-address`,
  internal_address_id: `${locationId}-internal`,
  location_id: locationId,
  apartment_or_suite: "",
  civic_number: number,
  civic_number_suffix: "",
  official_street_name: "7th",
  official_street_type: "Avenue",
  official_street_direction: "East",
  mailing_street_name: "7th",
  mailing_street_type: "Avenue",
  mailing_street_direction: "East",
  mailing_municipality: "OWEN SOUND",
  mailing_province: "ON",
  postal_code: "N4K1A1",
  building_use_code: "1",
  building_use: "residential",
  source_retrieval_date: "2026-08-27",
  source_file: "test",
  latitude: 0.0002,
  longitude: 0.001,
  coordinate_source: "nar_building",
  normalized_key: `${number}|7 AVE E|`,
  normalized_base_key: `${number}|7 AVE E|`,
  label: `${number} 7th Avenue East`,
});

describe("Owen Sound street-side NAR matching", () => {
  it("normalizes numeric and ordinal street names and exposes block/parity primitives", () => {
    expect(addressStreetKey("7th", "Avenue", "East"))
      .toBe(addressStreetKey("7", "AVE", "E"));
    expect(parseRoofAddress(roof("r", "702", 0))).toMatchObject({
      number: 702,
      street_key: addressStreetKey("7", "Avenue", "East"),
    });
    expect(civicHundredBlock(808)).toBe(8);
    expect(civicParity(808)).toBe("even");
    expect(civicParity(809)).toBe("odd");
  });

  it("determines frontage side and rejects an incompatible parity", () => {
    const roads = [road()];
    expect(streetSideForPoint(
      [0.001, 0.0002], "7th", "Avenue", "East", 702, roads,
    )).toBe("left");
    expect(streetSideForPoint(
      [0.001, -0.0002], "7th", "Avenue", "East", 701, roads,
    )).toBe("right");

    const placements = [
      { location_id: "loc-702", structure_id: null, status: "unmatched" as const, distance_m: null, footprint_id: null, footprint_source: null, candidates: [], point: [0.001, 0.0002] as [number, number] },
    ];
    const assignments = matchUnresolvedNarLocations({
      locations: [location("loc-702", "702", 0.001)],
      units: [unit("loc-702", "702")],
      structures: [roof("odd-roof", "701", 0.001)],
      roads,
      placements,
    });
    expect(assignments).toHaveLength(0);
  });

  it("matches official addresses monotonically one-to-one while permitting a skipped roof", () => {
    const roofs = [
      roof("roof-702", "702", 0.001),
      // This is a legitimate gap: no roof is supplied for the 704 address.
      roof("roof-706", "706", 0.005),
    ];
    const locations = [
      location("loc-702", "702", 0.001),
      location("loc-706", "706", 0.005),
    ];
    const placements = locations.map((item) => ({
      location_id: item.loc_guid,
      structure_id: null,
      status: "unmatched" as const,
      distance_m: null,
      footprint_id: null,
      footprint_source: null,
      candidates: [],
      point: [item.longitude, item.latitude] as [number, number],
    }));
    const assignments = matchUnresolvedNarLocations({
      locations,
      units: [unit("loc-702", "702"), unit("loc-706", "706")],
      structures: roofs,
      roads: [road()],
      placements,
    });
    expect(assignments.map((item) => item.location_id)).toEqual(["loc-702", "loc-706"]);
    expect(new Set(assignments.map((item) => item.structure_id)).size).toBe(2);
    expect(assignments.every((item) => item.evidence.side_match)).toBe(true);
  });

  it("never calls a BF_REPPOINT proximity/containment match fully validated", () => {
    const structure = roof("bf-roof", "702", 0.003, 0.0002);
    const result = placeNarLocations({
      locations: [location("bf-loc", "702", 0.003, 0.0002, "nar_block_face_fallback")],
      structures: [structure],
      units: [unit("bf-loc", "702")],
      roads: [road()],
    });
    expect(result.placements[0]).toMatchObject({
      status: "exact",
      match_method: "nar_contained_footprint",
      confidence_classification: "nar_nearest_no_known_conflict",
    });
  });

  it("classifies a unique close BG nearest match as validated only with the evidence chain", () => {
    const result = placeNarLocations({
      locations: [location("bg-loc", "702", 0.001, 0.0002)],
      structures: [roof("bg-roof", "702", 0.001)],
      units: [unit("bg-loc", "702")],
      roads: [road()],
    });
    expect(result.placements[0].status).toBe("nearest");
    expect(result.placements[0].confidence_classification).toBe("nar_validated_nearest");
    expect(result.placements[0].validation).toMatchObject({
      street_match: true,
      side_match: true,
      parity_match: true,
      hundred_block_match: true,
      conservative_distance_match: true,
    });
  });

  it("does not call an unknown footprint type fully validated", () => {
    const unknownRoof = roof("unknown-roof", "702", 0.001);
    unknownRoof.properties.building_type = "unclassified";
    const result = placeNarLocations({
      locations: [location("unknown-loc", "702", 0.001, 0.0002)],
      structures: [unknownRoof],
      units: [unit("unknown-loc", "702")],
      roads: [road()],
    });
    expect(result.placements[0].status).toBe("nearest");
    expect(result.placements[0].confidence_classification).toBe("nar_nearest_no_known_conflict");
    expect(result.placements[0].validation?.unique_plausible_footprint).toBe(false);
  });
});
