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
  validateNarPlacementEvidence,
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

  it("uses stable road-range metadata instead of a published label for roof ordering", () => {
    const feature = roof("range-roof", "999", 0.001);
    feature.properties.address_source_status = "authoritative";
    feature.properties.inferred_civic_number = 702;
    feature.properties.address_range_road_id = "example-road";
    delete feature.properties.fallback_civic_number;
    delete feature.properties.fallback_street;
    feature.properties.civic_label = "999 Wrong Street";
    expect(parseRoofAddress(feature, [road()])).toEqual({
      number: 702,
      suffix: "",
      street_key: addressStreetKey("7", "Avenue", "East"),
    });
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
    // The old roof label is intentionally wrong. Segment ordering is allowed
    // to correct that approximate label; the authoritative NAR number is not
    // rejected because of the stale value.
    expect(assignments).toHaveLength(1);
    expect(assignments[0]).toMatchObject({
      location_id: "loc-702",
      structure_id: "odd-roof",
      address_source: "nar_segment_assigned",
    });
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

  it("assigns BF_REPPOINT addresses by segment sequence, never by containment", () => {
    const structure = roof("bf-roof", "702", 0.003, 0.0002);
    const result = placeNarLocations({
      locations: [location("bf-loc", "702", 0.003, 0.0002, "nar_block_face_fallback")],
      structures: [structure],
      units: [unit("bf-loc", "702")],
      roads: [road()],
    });
    expect(result.placements[0]).toMatchObject({
      status: "nearest",
      match_method: "street_side_sequence",
      confidence_classification: "nar_block_face_sequence",
      address_source: "nar_segment_assigned",
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
    expect(result.placements[0].confidence_classification).toBe("nar_building_validated_nearest");
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

  it("orders roofs by their physical along-road position, correcting a wrong legacy number", () => {
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
      // The labels are intentionally reversed. They may support a cost, but
      // they must not establish the physical order of the roofs.
      structures: [roof("roof-at-702", "706", 0.001), roof("roof-at-706", "702", 0.005)],
      units: [unit("loc-702", "702"), unit("loc-706", "706")],
      roads: [road()],
      placements,
    });
    expect(new Map(assignments.map((item) => [item.location_id, item.structure_id]))).toEqual(
      new Map([
        ["loc-702", "roof-at-702"],
        ["loc-706", "roof-at-706"],
      ]),
    );
  });

  it("preserves the same assignments when the road geometry direction is reversed", () => {
    const reversed = {
      ...road(),
      geometry: { type: "LineString" as const, coordinates: [[0.01, 0], [0, 0]] },
    };
    const locations = [location("loc-702", "702", 0.001), location("loc-706", "706", 0.005)];
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
      structures: [roof("roof-at-702", "706", 0.001), roof("roof-at-706", "702", 0.005)],
      units: [unit("loc-702", "702"), unit("loc-706", "706")],
      roads: [reversed],
      placements,
    });
    expect(new Map(assignments.map((item) => [item.location_id, item.structure_id]))).toEqual(
      new Map([
        ["loc-702", "roof-at-702"],
        ["loc-706", "roof-at-706"],
      ]),
    );
  });

  it("keeps same-named road segments independent while ordering roofs physically", () => {
    const firstSegment = road();
    firstSegment.properties.road_id = "segment-first";
    const secondSegment = {
      ...road(),
      id: "segment-second",
      properties: { ...road().properties, road_id: "segment-second" },
      geometry: { type: "LineString" as const, coordinates: [[0.02, 0], [0.03, 0]] },
    };
    const firstRoof = roof("first-roof", "798", 0.001);
    firstRoof.properties.inferred_civic_number = 702;
    firstRoof.properties.address_range_road_id = "segment-first";
    const secondRoof = roof("second-roof", "702", 0.021);
    secondRoof.properties.inferred_civic_number = 706;
    secondRoof.properties.address_range_road_id = "segment-second";
    const locations = [location("loc-first", "702", 0.001), location("loc-second", "706", 0.021)];
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
      units: [unit("loc-first", "702"), unit("loc-second", "706")],
      structures: [firstRoof, secondRoof],
      roads: [firstSegment, secondSegment],
      placements,
    });
    expect(new Map(assignments.map((item) => [item.location_id, item.structure_id]))).toEqual(
      new Map([["loc-first", "first-roof"], ["loc-second", "second-roof"]]),
    );
  });

  it("uses the exact civic hundred block before geometric proximity at a segment join", () => {
    const firstSegment = road();
    firstSegment.properties.road_id = "block-7";
    const secondSegment = {
      ...road(),
      id: "block-8",
      properties: {
        ...road().properties,
        road_id: "block-8",
        left_from: 800,
        left_to: 898,
        right_from: 801,
        right_to: 899,
      },
      geometry: { type: "LineString" as const, coordinates: [[0.01, 0], [0.02, 0]] },
    };
    const locations = [
      location("loc-702", "702", 0.005),
      // At the shared endpoint, the block range—not nearest geometry—must
      // place 802 on the second segment.
      location("loc-802", "802", 0.01),
    ];
    const structures = [
      roof("roof-702", "999", 0.005),
      roof("roof-802", "999", 0.01005),
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
      units: [unit("loc-702", "702"), unit("loc-802", "802")],
      structures,
      roads: [firstSegment, secondSegment],
      placements,
    });
    expect(new Map(assignments.map((item) => [item.location_id, item.structure_id]))).toEqual(
      new Map([
        ["loc-702", "roof-702"],
        ["loc-802", "roof-802"],
      ]),
    );
  });

  it("records trusted lower and higher anchors for an interior address", () => {
    const structures = [roof("roof-702", "702", 0.001), roof("roof-704", "704", 0.003), roof("roof-706", "706", 0.005)];
    const locations = [location("loc-702", "702", 0.001), location("loc-704", "704", 0.003), location("loc-706", "706", 0.005)];
    const placements = locations.map((item, index) => ({
      location_id: item.loc_guid,
      structure_id: String(structures[index].properties.structure_id),
      status: "nearest" as const,
      distance_m: 2,
      footprint_id: String(structures[index].id ?? structures[index].properties.structure_id),
      footprint_source: "openstreetmap",
      candidates: [],
      point: [item.longitude, item.latitude] as [number, number],
      coordinate_source: "nar_building" as const,
      confidence_classification: index === 1
        ? "nar_nearest_no_known_conflict" as const
        : "nar_building_validated_nearest" as const,
    }));
    const evidence = validateNarPlacementEvidence({
      location: locations[1],
      units: locations.flatMap((item) => [unit(item.loc_guid, item.loc_guid === "loc-704" ? "704" : item.loc_guid === "loc-706" ? "706" : "702")]),
      placement: placements[1],
      structure: structures[1],
      placements,
      structures,
      roads: [road()],
    });
    expect(evidence.neighbouring_sequence_match).toBe(true);
    expect(evidence.neighbouring_anchors).toMatchObject({
      lower: { location_id: "loc-702", civic_number: 702 },
      higher: { location_id: "loc-706", civic_number: 706 },
      orientation: "increasing",
    });
  });

  it("does not promote a one-sided endpoint without stronger physical evidence", () => {
    const structures = [roof("roof-702", "702", 0.001), roof("roof-704", "704", 0.003)];
    const locations = [location("loc-702", "702", 0.001), location("loc-704", "704", 0.003)];
    const units = locations.map((item) => unit(item.loc_guid, item.loc_guid === "loc-702" ? "702" : "704"));
    const anchor = {
      location_id: "loc-702",
      structure_id: "roof-702",
      status: "nearest" as const,
      distance_m: 2,
      footprint_id: "roof-702",
      footprint_source: "openstreetmap",
      candidates: [],
      point: [0.001, 0.0002] as [number, number],
      coordinate_source: "nar_building" as const,
      confidence_classification: "nar_building_validated_nearest" as const,
    };
    const endpoint = {
      location_id: "loc-704",
      structure_id: "roof-704",
      status: "nearest" as const,
      distance_m: 20,
      footprint_id: "roof-704",
      footprint_source: "openstreetmap",
      candidates: [],
      point: [0.003, 0.0002] as [number, number],
      coordinate_source: "nar_building" as const,
      confidence_classification: "nar_nearest_no_known_conflict" as const,
    };
    const weak = validateNarPlacementEvidence({
      location: locations[1], units, placement: endpoint, structure: structures[1],
      placements: [anchor, endpoint], structures, roads: [road()],
    });
    expect(weak.neighbouring_sequence_match).toBe(false);
    const strong = validateNarPlacementEvidence({
      location: locations[1], units, placement: { ...endpoint, status: "exact", distance_m: 0 }, structure: structures[1],
      placements: [anchor, { ...endpoint, status: "exact", distance_m: 0 }], structures, roads: [road()],
    });
    expect(strong.neighbouring_sequence_match).toBe(true);
  });

  it("uses street-side sequencing for shared block-face points without a geometric distance claim", () => {
    const locations = [
      location("bf-702", "702", 0.003, 0.0002, "nar_block_face_fallback"),
      location("bf-704", "704", 0.003, 0.0002, "nar_block_face_fallback"),
      location("bf-706", "706", 0.003, 0.0002, "nar_block_face_fallback"),
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
      units: [unit("bf-702", "702"), unit("bf-704", "704"), unit("bf-706", "706")],
      structures: [roof("roof-702", "702", 0.001), roof("roof-704", "704", 0.003), roof("roof-706", "706", 0.005)],
      roads: [road()],
      placements,
    });
    expect(assignments).toHaveLength(3);
    expect(assignments.every((assignment) => assignment.classification === "nar_block_face_sequence")).toBe(true);
    expect(assignments.every((assignment) => assignment.distance_m === null)).toBe(true);
    expect(assignments.every((assignment) =>
      Number.isFinite(assignment.evidence.coordinate_offset_m ?? NaN),
    )).toBe(true);
  });

  it("leaves a symmetric block unresolved when neither orientation is superior", () => {
    const locations = [location("loc-a", "702", 0.003), location("loc-b", "702", 0.003)];
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
      units: [unit("loc-a", "702"), unit("loc-b", "702")],
      structures: [roof("roof-a", "702", 0.001), roof("roof-b", "702", 0.005)],
      roads: [road()],
      placements,
    });
    expect(assignments).toHaveLength(0);
  });
});
