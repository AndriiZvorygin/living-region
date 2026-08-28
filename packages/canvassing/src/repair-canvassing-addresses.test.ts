import { describe, expect, it } from "vitest";
import {
  assertNoAnonymousActiveAddressLabels,
  repairCanvassingStructureAddresses,
} from "./repair-canvassing-addresses";

const roof = (id: string, properties: Record<string, any>) => ({
  type: "Feature" as const,
  properties: { structure_id: id, building_type: "residential", ...properties },
  geometry: {
    type: "Polygon",
    coordinates: [[[-80.95, 44.57], [-80.9499, 44.57], [-80.9499, 44.5701], [-80.95, 44.5701], [-80.95, 44.57]]],
  },
}) as any;

const road = {
  type: "Feature" as const,
  properties: { road_id: "road-1", name: "8th Street East" },
  geometry: { type: "LineString", coordinates: [[-80.95, 44.569], [-80.95, 44.571]] },
};

describe("canvassing roof address repair", () => {
  it("removes citywide references and completes a road-range address", () => {
    const structures = [
      roof("roof-1", {
        civic_label: "3098",
        civic_numbers: ["3098"],
        inferred_civic_number: 3098,
        address_reference_ids: ["old-address"],
        address_relation: "provisional_nearest",
        address_relation_confidence: "distant_review",
      }),
    ];
    const result = repairCanvassingStructureAddresses({
      structures,
      roads: [road],
      addresses: [],
    });
    expect(result.removed_reference_ids).toBe(1);
    expect(structures[0].properties).toMatchObject({
      civic_label: "~3098 8th Street East",
      fallback_civic_number: "3098",
      fallback_street: "8th Street East",
      address_quality: "grid_estimated",
    });
    expect(structures[0].properties.address_reference_ids).toBeUndefined();
    expect(() => assertNoAnonymousActiveAddressLabels(structures)).not.toThrow();
  });

  it("uses a former address only for the same physical roof", () => {
    const structures = [roof("roof-1", { civic_label: "1450" })];
    repairCanvassingStructureAddresses({
      structures,
      roads: [road],
      addresses: [],
      legacyAddresses: [
        {
          type: "Feature",
          properties: {
            structure_id: "roof-1",
            civic_number: "1450",
            street: "8th Street East",
            label: "1450 8th Street East",
          },
          geometry: { type: "Point", coordinates: [-80.95, 44.57] },
        },
      ],
    });
    expect(structures[0].properties).toMatchObject({
      civic_label: "1450 8th Street East",
      address_quality: "legacy_unverified",
      address_label_source: "legacy_unverified",
    });
  });

  it("does not treat legacy NAR provenance as roof validation", () => {
    const structures = [roof("roof-1", { civic_label: "1450" })];
    repairCanvassingStructureAddresses({
      structures,
      roads: [road],
      addresses: [],
      legacyAddresses: [
        {
          type: "Feature",
          properties: {
            structure_id: "roof-1",
            civic_number: "1450",
            street: "8th Street East",
            label: "1450 8th Street East",
            external_source: "statistics_canada_national_address_register",
          },
          geometry: { type: "Point", coordinates: [-80.95, 44.57] },
        },
      ],
    });
    expect(structures[0].properties.address_quality).toBe("legacy_unverified");
  });

  it("never accepts an anonymous or blank canvassable label", () => {
    expect(() =>
      assertNoAnonymousActiveAddressLabels([
        roof("roof-1", { canvassable: true, civic_label: "Canvassing roof abc" }),
      ]),
    ).toThrow(/lack a human-readable address/);
  });
});
