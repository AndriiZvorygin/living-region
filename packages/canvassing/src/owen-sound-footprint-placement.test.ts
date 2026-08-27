import { describe, expect, it } from "vitest";
import { stableId, type Feature } from "./building-coverage";
import {
  applyAuthoritativePlacements,
  placeNarLocations,
  placementSummary,
} from "./owen-sound-footprint-placement";
import type { AddressUnit, NarLocation } from "./owen-sound-address-foundation";

const polygon = (id: string, source = "openstreetmap", x = 0, y = 0): Feature => ({
  type: "Feature",
  id,
  properties: {
    structure_id: id,
    external_source: source,
    external_id: id,
    building_type: "residential",
    civic_numbers: ["100"],
    civic_label: "100 Example Street",
  },
  geometry: { type: "Polygon", coordinates: [[[x, y], [x + 0.0001, y], [x + 0.0001, y + 0.0001], [x, y + 0.0001], [x, y]]] },
});

const unaddressedPolygon = (id: string, x = 0, y = 0): Feature => ({
  ...polygon(id, "openstreetmap", x, y),
  properties: {
    structure_id: id,
    external_source: "openstreetmap",
    external_id: id,
    building_type: "residential",
  },
});

const location = (id: string, longitude: number, latitude: number): NarLocation => ({
  loc_guid: id,
  csd_code: "3542059",
  longitude,
  latitude,
  coordinate_source: "nar_building",
  source_file: "test",
});

const unit = (locationId: string, number = "100"): AddressUnit => ({
  address_id: `${locationId}-address`,
  internal_address_id: `${locationId}-internal`,
  location_id: locationId,
  apartment_or_suite: "",
  civic_number: number,
  civic_number_suffix: "",
  official_street_name: "Example",
  official_street_type: "ST",
  official_street_direction: "",
  mailing_street_name: "Example",
  mailing_street_type: "ST",
  mailing_street_direction: "",
  mailing_municipality: "OWEN SOUND",
  mailing_province: "ON",
  postal_code: "N4K1A1",
  coordinate_source: "nar_building",
  building_use_code: "1",
  building_use: "residential",
  source_retrieval_date: "2026-08-26",
  source_file: "test",
  latitude: 0,
  longitude: 0,
  normalized_key: "100|EXAMPLE ST|",
  normalized_base_key: "100|EXAMPLE ST|",
  label: "100 Example Street",
});

describe("NAR location to building placement", () => {
  it("prefers a containing Grey footprint", () => {
    const result = placeNarLocations({
      locations: [location("loc", 0.00005, 0.00005)],
      structures: [polygon("existing", "openstreetmap", 0, 0)],
      greyFootprints: [polygon("grey", "grey_county_building_footprints", 0, 0)],
      units: [unit("loc")],
    });
    expect(result.placements[0]).toMatchObject({ status: "exact", footprint_source: "grey_county_building_footprints" });
  });

  it("uses a nearby plausible footprint and sends an equidistant ambiguity to review", () => {
    const result = placeNarLocations({
      locations: [location("near", 0.00035, 0.00005), location("ambiguous", 0.00015, 0.00005)],
      structures: [unaddressedPolygon("left", 0, 0), unaddressedPolygon("right", 0.0002, 0)],
      units: [unit("near"), unit("ambiguous", "999")],
      thresholdM: 50,
    });
    expect(result.placements[0].status).toBe("nearest");
    expect(result.placements[1].status).toBe("ambiguous");
    expect(placementSummary(result.placements)).toMatchObject({ nearest_matches: 1, ambiguous_matches: 1 });
    expect(result.placements[0].candidates[0].footprint_area_m2).toBeGreaterThan(0);
  });

  it("does not citywide-match a point beyond the conservative threshold", () => {
    const result = placeNarLocations({
      locations: [location("far", 0, 0)],
      structures: [polygon("far-roof", "openstreetmap", 0.001, 0)],
      units: [unit("far")],
      thresholdM: 50,
    });
    expect(result.placements[0]).toMatchObject({
      status: "unmatched",
      structure_id: null,
      rejection_reason: "no credible footprint within the conservative match threshold",
    });
  });

  it("does not collapse distinct same-point locations onto an ordinary footprint", () => {
    const result = placeNarLocations({
      locations: [location("one", 0.00005, 0.00005), location("two", 0.00005, 0.00005)],
      structures: [polygon("ordinary", "openstreetmap", 0, 0)],
      units: [unit("one", "100"), unit("two", "100")],
    });
    expect(result.placements.filter((placement) => placement.structure_id)).toHaveLength(1);
    expect(result.placements.filter((placement) => placement.status === "ambiguous")).toHaveLength(1);
  });

  it("keeps distinct units at one physical stop and applies authoritative labels", () => {
    const structure = polygon(stableId("structure", "test"));
    const placements = [{ location_id: "loc", structure_id: String(structure.properties.structure_id), status: "exact" as const, distance_m: 0, footprint_id: "test", footprint_source: "openstreetmap", candidates: [], point: [0, 0] as [number, number] }];
    const result = applyAuthoritativePlacements({ structures: [structure], units: [unit("loc", "100"), unit("loc", "100")], placements });
    expect(result.structures[0].properties.civic_label).toBe("100 Example Street");
    expect(result.structures[0].properties.address_count).toBe(2);
  });
});
