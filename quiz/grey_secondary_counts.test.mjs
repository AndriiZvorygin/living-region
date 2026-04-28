import { describe, expect, test } from 'vitest';
import { summarizeGreySecondaryCollections } from '../program/data/grey_secondary_counts.mjs';

describe('grey secondary counts helper', () => {
  test('handles missing collections as zero', () => {
    const summary = summarizeGreySecondaryCollections({});
    expect(summary.transitStopCount).toBe(0);
    expect(summary.trailFeatureCount).toBe(0);
    expect(summary.secondaryDataCoverageScore).toBe(0);
  });

  test('uses collection counts when present', () => {
    const summary = summarizeGreySecondaryCollections({
      transitStops: [{}, {}],
      trails: [{}, {}],
      cyclingRoutes: [{}],
      forestAreas: [{}],
      ruralBusinesses: [{}],
      facilities: [{}],
      roadStructures: [{}]
    });
    expect(summary.transitStopCount).toBe(2);
    expect(summary.trailFeatureCount).toBe(2);
    expect(summary.cyclingRouteFeatureCount).toBe(1);
    expect(summary.secondaryDataCoverageScore).toBeGreaterThan(0.8);
  });

  test('falls back to seed summary when collections absent', () => {
    const summary = summarizeGreySecondaryCollections({
      seedMeta: {
        summary: {
          transitStopCount: 23,
          trailFeatureCount: 145,
          cyclingRouteFeatureCount: 23,
          managedForestFeatureCount: 45,
          ruralBusinessCount: 197,
          facilityCount: 35,
          roadStructureCount: 31
        }
      }
    });

    expect(summary.transitStopCount).toBe(23);
    expect(summary.trailFeatureCount).toBe(145);
    expect(summary.cyclingRouteFeatureCount).toBe(23);
    expect(summary.managedForestFeatureCount).toBe(45);
    expect(summary.ruralBusinessCount).toBe(197);
    expect(summary.facilityCount).toBe(35);
    expect(summary.roadStructureCount).toBe(31);
  });
});
