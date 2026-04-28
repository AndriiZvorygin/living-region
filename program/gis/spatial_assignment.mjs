// SPDX-License-Identifier: AGPL-3.0-or-later

function averagePoint(coords) {
  let sx = 0;
  let sy = 0;
  let n = 0;
  function visit(node) {
    if (!Array.isArray(node)) return;
    if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
      sx += node[0];
      sy += node[1];
      n += 1;
      return;
    }
    for (const child of node) visit(child);
  }
  visit(coords);
  if (n === 0) return null;
  return [sx / n, sy / n];
}

export function getGeometryCentroid(geometry) {
  if (!geometry?.type) return null;
  if (geometry.type === 'Point') return Array.isArray(geometry.coordinates) ? geometry.coordinates : null;
  if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon' || geometry.type === 'MultiLineString') {
    return averagePoint(geometry.coordinates);
  }
  if (geometry.type === 'LineString') {
    const line = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    if (line.length === 0) return null;
    const mid = line[Math.floor(line.length / 2)];
    if (Array.isArray(mid) && mid.length >= 2) return [mid[0], mid[1]];
    return averagePoint(line);
  }
  return averagePoint(geometry.coordinates);
}

function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(point, polygonGeometry) {
  if (!point || polygonGeometry?.type !== 'Polygon' || !Array.isArray(polygonGeometry.coordinates)) return false;
  const rings = polygonGeometry.coordinates;
  if (!rings[0] || !pointInRing(point, rings[0])) return false;
  for (let i = 1; i < rings.length; i += 1) {
    if (pointInRing(point, rings[i])) return false;
  }
  return true;
}

export function pointInMultiPolygon(point, multiPolygonGeometry) {
  if (!point || multiPolygonGeometry?.type !== 'MultiPolygon' || !Array.isArray(multiPolygonGeometry.coordinates)) return false;
  for (const polygonCoords of multiPolygonGeometry.coordinates) {
    if (pointInPolygon(point, { type: 'Polygon', coordinates: polygonCoords })) return true;
  }
  return false;
}

export function assignFeatureToPolygonByCentroid(feature, polygonFeatures, options = {}) {
  const centroid = getGeometryCentroid(feature?.geometry ?? null);
  if (!centroid) return { centroid: null, matched: null, method: 'unassigned' };

  for (const polygonFeature of polygonFeatures) {
    const g = polygonFeature?.geometry;
    const inside = g?.type === 'Polygon'
      ? pointInPolygon(centroid, g)
      : g?.type === 'MultiPolygon'
        ? pointInMultiPolygon(centroid, g)
        : false;
    if (inside) {
      return { centroid, matched: polygonFeature, method: options.methodName ?? 'geometryCentroid' };
    }
  }

  return { centroid, matched: null, method: 'unassigned' };
}

export function assignFeaturesToMunicipalitiesByCentroid(features, municipalityFeatures, options = {}) {
  const assignments = [];
  for (const feature of features) {
    assignments.push(assignFeatureToPolygonByCentroid(feature, municipalityFeatures, options));
  }
  return assignments;
}
