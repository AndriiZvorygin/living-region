import { describe, expect, test } from 'vitest';
import { createDemoWorld } from '../program/data/demo_world.mjs';
import { exportGeoJSON } from '../program/gis/export_geojson.mjs';

describe('geojson export', () => {
  test('GeoJSON export returns FeatureCollection for patches and buildings', () => {
    const world = createDemoWorld();
    const output = exportGeoJSON(world);

    expect(output.patches.type).toBe('FeatureCollection');
    expect(output.buildings.type).toBe('FeatureCollection');
    expect(output.patches.features.length).toBeGreaterThan(0);
    expect(output.buildings.features.length).toBeGreaterThan(0);
  });
});
