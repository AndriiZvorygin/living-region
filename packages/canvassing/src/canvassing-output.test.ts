import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const readJson = async (path: string) =>
  JSON.parse(await readFile(path, "utf8"));

describe("Owen Sound canvassing prepared data", () => {
  it("gives every civic address a sourced roof, safe estimate, or review point", async () => {
    const addresses = await readJson(
      "packages/web-client/public/canvassing/addresses.geojson",
    );
    const usesNationalAddressRegister = addresses.features.some(
      (feature: any) =>
        feature.properties.external_source ===
        "statistics_canada_national_address_register",
    );
    const counts: Record<string, number> = {};
    for (const feature of addresses.features) {
      const status = feature.properties.association_status;
      counts[status] = (counts[status] ?? 0) + 1;
      if (usesNationalAddressRegister)
        expect(
          Boolean(feature.properties.structure_id) || status === "unresolved",
        ).toBe(true);
      else
        expect(Boolean(feature.properties.structure_id)).toBe(
          status !== "unresolved",
        );
    }
    if (usesNationalAddressRegister) {
      const quality = await readJson(
        "packages/web-client/public/canvassing/address-quality.json",
      );
      expect(addresses.features.length).toBe(quality.totals.civic_addresses);
      expect(
        addresses.features.some(
          (feature: any) =>
            feature.properties.nar_placement_status === "ambiguous" ||
            feature.properties.nar_placement_status === "unmatched",
        ),
      ).toBe(true);
      expect(
        addresses.features.every(
          (feature: any) =>
            feature.properties.address_source_status === "authoritative",
        ),
      ).toBe(true);
    } else {
      expect(counts.exact).toBeGreaterThan(0);
      expect(counts.high_confidence).toBeGreaterThan(0);
      expect(counts.probable_sourced).toBeGreaterThan(0);
      expect(counts.inferred_range).toBeGreaterThan(0);
      expect(counts.estimated).toBeGreaterThan(0);
      expect(counts.unresolved).toBeGreaterThan(0);
    }
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
    if (quality.source === "statistics_canada_national_address_register")
      expect(quality.totals.primary_nar_units).toBe(quality.totals.civic_addresses);
    else expect(quality.automatic_join_counts.inferred_range).toBeGreaterThan(0);
  });

  it("publishes the stable legacy-only address list used by the server seed", async () => {
    const legacy = await readJson(
      "packages/web-client/public/canvassing/legacy-unmatched-address-ids.json",
    );
    expect(legacy.schema_version).toBe(1);
    const reconciliation = await readJson(
      "packages/web-client/public/canvassing/legacy-history-reconciliation.json",
    );
    expect(legacy.address_ids).toHaveLength(reconciliation.links.length);
    expect(new Set(legacy.address_ids).size).toBe(legacy.address_ids.length);
  });

  it("publishes the legacy activity reconciliation without embedding event data", async () => {
    const reconciliation = await readJson(
      "packages/web-client/public/canvassing/legacy-history-reconciliation.json",
    );
    expect(reconciliation.links).toHaveLength(reconciliation.summary.legacy_rows);
    expect(
      reconciliation.summary.confident +
        reconciliation.summary.ambiguous +
        reconciliation.summary.unmatched,
    ).toBe(reconciliation.summary.legacy_rows);
    expect(
      reconciliation.links.every((link: any) =>
        Object.keys(link).every((key) =>
          [
            "legacy_address_id",
            "canonical_address_id",
            "canonical_location_id",
            "match_status",
            "distance_m",
            "candidate_count",
            "candidate_location_count",
            "reason",
          ].includes(key),
        ),
      ),
    ).toBe(true);
  });

  it("publishes no generated roof collisions", async () => {
    const audit = await readJson(
      "packages/web-client/public/canvassing/building-coverage-audit.json",
    );
    expect(audit.generated_geometry_conflicts).toBe(0);
    expect(audit.address_placement).toBeTruthy();
    expect(audit.civic_addresses).toBeGreaterThan(0);
    expect(audit.total_display_footprints).toBeGreaterThan(0);
    expect(audit.structures_with_civic_labels).toBeLessThanOrEqual(
      audit.total_display_footprints,
    );
    expect(audit.structures_without_civic_labels).toBe(
      audit.total_display_footprints - audit.structures_with_civic_labels,
    );
    expect(audit.unaddressed_structure_references.unresolved).toBe(0);
    expect(
      audit.structures_with_civic_labels +
        audit.structures_without_civic_labels,
    ).toBe(audit.total_display_footprints);
    expect(audit.address_placement.unique_structures_receiving_nar_locations).toBeGreaterThan(0);
  });

  it("publishes a stable selection target for every canvassable roof", async () => {
    const structures = await readJson(
      "packages/web-client/public/canvassing/structures.geojson",
    );
    const canvassable = structures.features.filter(
      (feature: any) => feature.properties.canvassable,
    );
    expect(canvassable.length).toBeGreaterThan(0);
    expect(
      canvassable.filter(
        (feature: any) => !String(feature.properties.selection_target_id ?? ""),
      ),
    ).toHaveLength(0);
    expect(
      canvassable.every(
        (feature: any) =>
          Array.isArray(feature.properties.selection_target_ids) &&
          feature.properties.selection_target_ids.length > 0 &&
          feature.properties.selection_target_ids.includes(
            feature.properties.selection_target_id,
          ),
      ),
    ).toBe(true);
  });

  it("keeps every active canvassable roof human-addressed and honestly classified", async () => {
    const structures = await readJson(
      "packages/web-client/public/canvassing/structures.geojson",
    );
    const canvassable = structures.features.filter(
      (feature: any) => feature.properties.canvassable,
    );
    expect(
      canvassable.filter(
        (feature: any) =>
          !String(feature.properties.civic_label ?? "").trim() ||
          /^Canvassing roof\b/i.test(String(feature.properties.civic_label)),
      ),
    ).toHaveLength(0);
    expect(
      canvassable.every((feature: any) =>
        [
          "nar_contained_footprint",
          "nar_validated_nearest",
          "nar_documented_exception",
          "legacy_nar_confirmed",
          "legacy_spatially_consistent",
          "legacy_unverified",
          "grid_estimated",
          "unresolved",
        ].includes(String(feature.properties.address_quality)),
      ),
    ).toBe(true);
    expect(
      canvassable.filter(
        (feature: any) =>
          !String(feature.properties.fallback_civic_number ?? "").trim() &&
          !String(feature.properties.civic_numbers?.[0] ?? "").trim(),
      ),
    ).toHaveLength(0);
  });

  it("publishes one auditable row for every primary NAR physical location", async () => {
    const audit = await readJson(
      "data/derived/owen-sound-address-foundation/nar-placement-audit.json",
    );
    expect(audit.rows).toHaveLength(audit.summary.primary_loc_guid_values);
    expect(audit.summary.primary_loc_guid_values).toBeGreaterThan(0);
    expect(
      audit.rows.every(
        (row: any) =>
          typeof row.loc_guid === "string" &&
          Array.isArray(row.addr_guid_values) &&
          row.nar_coordinates &&
          typeof row.confidence_classification === "string" &&
          (row.rejection_or_review_reason === null ||
            typeof row.rejection_or_review_reason === "string"),
      ),
    ).toBe(true);
    expect(audit.summary.maximum_loc_guid_values_per_structure).toBeLessThanOrEqual(4);
    expect(audit.summary.nar_locations_with_no_credible_structure_match).toBeGreaterThan(0);
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
