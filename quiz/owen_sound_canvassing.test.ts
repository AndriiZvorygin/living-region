import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));

describe("Owen Sound canvassing preparation", () => {
  test("prepared features use unique stable internal IDs and preserve external IDs", async () => {
    const structures = await readJson("packages/web-client/public/canvassing/structures.geojson");
    const addresses = await readJson("packages/web-client/public/canvassing/addresses.geojson");
    expect(new Set(structures.features.map((feature: any) => feature.properties.structure_id)).size).toBe(structures.features.length);
    expect(new Set(addresses.features.map((feature: any) => feature.properties.address_id)).size).toBe(addresses.features.length);
    expect(
      structures.features.every(
        (feature: any) =>
          feature.properties.external_source &&
          feature.properties.external_id &&
          feature.properties.geometry_provenance,
      ),
    ).toBe(true);
  });

  test("every civic address has a roof or an explicit review-point status", async () => {
    const addresses = await readJson("packages/web-client/public/canvassing/addresses.geojson");
    const usesNationalAddressRegister = addresses.features.some(
      (feature: any) =>
        feature.properties.external_source ===
        "statistics_canada_national_address_register",
    );
    expect(
      addresses.features.every(
        (feature: any) =>
          feature.geometry.type === "Point" &&
          (Boolean(feature.properties.structure_id) ||
            feature.properties.association_status === "unresolved") &&
          (!usesNationalAddressRegister ||
            feature.properties.address_source_status === "authoritative"),
      ),
    ).toBe(true);
  });

  test("manifest records offline sources, CRS, counts, and unavailable parcels", async () => {
    const manifest = await readJson("packages/web-client/public/canvassing/manifest.json");
    const parcels = await readJson("packages/web-client/public/canvassing/parcels.geojson");
    expect(manifest.crs).toContain("CRS84");
    expect(manifest.counts.structures).toBeGreaterThan(6_000);
    expect(manifest.counts.addresses).toBeGreaterThan(6_000);
    if (manifest.address_foundation?.source === "statistics_canada_national_address_register")
      expect(manifest.address_foundation.residential_units +
        manifest.address_foundation.partly_residential_units).toBe(10_909);
    else
      expect(manifest.counts.match_confidence.inferred_range).toBeGreaterThan(
        2_000,
      );
    const coverage = await readJson(
      "packages/web-client/public/canvassing/building-coverage-audit.json",
    );
    expect(coverage.generated_geometry_conflicts).toBe(0);
    expect(parcels.metadata.status).toBe("unavailable");
  });
});
