import { describe, expect, test } from 'vitest';
import {
  getGeometryCentroid,
  pointInPolygon,
  pointInMultiPolygon,
  assignFeatureToPolygonByCentroid
} from '../program/gis/spatial_assignment.mjs';

describe('spatial assignment helpers', () => {
  test('pointInPolygon works for simple polygon', () => {
    const poly = { type: 'Polygon', coordinates: [[[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]] };
    expect(pointInPolygon([0, 0], poly)).toBe(true);
    expect(pointInPolygon([2, 2], poly)).toBe(false);
  });

  test('pointInMultiPolygon works', () => {
    const multi = { type: 'MultiPolygon', coordinates: [
      [[[-5, -5], [-3, -5], [-3, -3], [-5, -3], [-5, -5]]],
      [[[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]]
    ] };
    expect(pointInMultiPolygon([0, 0], multi)).toBe(true);
    expect(pointInMultiPolygon([3, 3], multi)).toBe(false);
  });

  test('LineString centroid assignment works', () => {
    const feature = { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [0.5, 0.5], [1, 1]] } };
    const polys = [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0.4, 0.4], [1.4, 0.4], [1.4, 1.4], [0.4, 1.4], [0.4, 0.4]]] }, municipalityId: 'x' }];
    const assigned = assignFeatureToPolygonByCentroid(feature, polys);
    expect(getGeometryCentroid(feature.geometry)).toBeTruthy();
    expect(assigned.matched?.municipalityId).toBe('x');
  });
});
