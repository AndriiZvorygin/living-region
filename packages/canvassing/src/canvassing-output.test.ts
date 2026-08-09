import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const readJson = async (path: string) =>
  JSON.parse(await readFile(path, "utf8"));

describe("Owen Sound canvassing prepared data", () => {
  it("gives every civic address a sourced roof, safe estimate, or review point", async () => {
    const addresses = await readJson(
      "packages/web-client/public/canvassing/addresses.geojson",
    );
    const counts: Record<string, number> = {};
    for (const feature of addresses.features) {
      const status = feature.properties.association_status;
      counts[status] = (counts[status] ?? 0) + 1;
      expect(Boolean(feature.properties.structure_id)).toBe(
        status !== "unresolved",
      );
    }
    expect(counts.exact).toBeGreaterThan(0);
    expect(counts.high_confidence).toBeGreaterThan(0);
    expect(counts.probable_sourced).toBeGreaterThan(0);
    expect(counts.inferred_range).toBeGreaterThan(0);
    expect(counts.estimated).toBeGreaterThan(0);
    expect(counts.unresolved).toBeGreaterThan(0);
  });

  it("keeps address-quality totals internally consistent", async () => {
    const quality = await readJson(
      "packages/web-client/public/canvassing/address-quality.json",
    );
    const confidenceTotal = Object.values(quality.automatic_join_counts).reduce(
      (sum: number, value) => sum + Number(value),
      0,
    );
    expect(confidenceTotal).toBe(quality.totals.civic_addresses);
    expect(quality.automatic_join_counts.inferred_range).toBeGreaterThan(0);
  });

  it("publishes no generated roof collisions", async () => {
    const audit = await readJson(
      "packages/web-client/public/canvassing/building-coverage-audit.json",
    );
    expect(audit.generated_geometry_conflicts).toBe(0);
    expect(audit.inferred_range_addresses).toBeGreaterThan(0);
    expect(audit.civic_addresses).toBe(
      audit.imported_civic_addresses +
        audit.inferred_range_addresses +
        audit.manual_number_calibrations_applied,
    );
    expect(audit.city_map_candidates).toBeGreaterThan(6_000);
    expect(audit.city_map_additional_footprints).toBeGreaterThan(5_000);
    expect(audit.structures_with_civic_labels).toBe(
      audit.total_display_footprints,
    );
    expect(audit.structures_without_civic_labels).toBe(0);
    expect(audit.unaddressed_structure_references.unresolved).toBe(0);
    expect(
      audit.structures_with_civic_labels +
        audit.structures_without_civic_labels,
    ).toBe(audit.total_display_footprints);
    expect(audit.small_frontage_inferred).toBeGreaterThan(50);
  });

  it("records city-map provenance and keeps it private", async () => {
    const source = await readJson(
        "data/canvassing/owen-sound-city-map-source.json",
      ),
      structures = await readJson(
        "packages/web-client/public/canvassing/structures.geojson",
      ),
      cityRoofs = structures.features.filter(
        (feature: any) =>
          feature.properties.external_source === "owen_sound_city_map_pdf",
      );
    expect(source.source_pdf_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(source.source_layer).toContain("BuildingFootprints");
    expect(source.private_reference_only).toBe(true);
    expect(cityRoofs.length).toBeGreaterThan(5_000);
    expect(
      cityRoofs.every(
        (feature: any) => feature.properties.private_reference_only,
      ),
    ).toBe(true);
    const townhouseUnits = cityRoofs.filter(
      (feature: any) => feature.properties.subdivision_method,
    );
    expect(townhouseUnits.length).toBeGreaterThan(50);
    expect(
      townhouseUnits.every(
        (feature: any) =>
          feature.properties.townhouse_unit_index >= 1 &&
          feature.properties.townhouse_unit_index <=
            feature.properties.townhouse_unit_count,
      ),
    ).toBe(true);
    for (const parentId of new Set(
      townhouseUnits.map(
        (feature: any) => feature.properties.source_parent_geometry_id,
      ),
    )) {
      const siblings = townhouseUnits.filter(
        (feature: any) =>
          feature.properties.source_parent_geometry_id === parentId,
      );
      expect(
        new Set(
          siblings.map(
            (feature: any) => feature.properties.townhouse_unit_index,
          ),
        ).size,
      ).toBe(siblings.length);
    }
  });

  it("keeps campaign fields out of public OSM QA geography", async () => {
    const exported = await readJson(
      "artifacts/owen-sound-building-import/public-building-geography.geojson",
    );
    const allowed = [
      "source_footprint_id",
      "source",
      "licence",
      "existing_osm_overlap_result",
      "geometry_validation_result",
      "candidate_import_batch",
    ];
    for (const feature of exported.features)
      expect(Object.keys(feature.properties).sort()).toEqual(
        [...allowed].sort(),
      );
    expect(
      exported.features.some(
        (feature: any) =>
          feature.properties.source === "owen_sound_city_map_pdf",
      ),
    ).toBe(false);
    expect(exported.metadata.api_uploading_enabled).toBe(false);
  });
});
