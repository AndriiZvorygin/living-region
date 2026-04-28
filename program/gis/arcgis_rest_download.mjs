// SPDX-License-Identifier: AGPL-3.0-or-later

export function chunkObjectIds(objectIds, chunkSize = 500) {
  const chunks = [];
  for (let i = 0; i < objectIds.length; i += chunkSize) {
    chunks.push(objectIds.slice(i, i + chunkSize));
  }
  return chunks;
}

export function buildQueryUrl(baseLayerUrl, params) {
  const url = new URL(`${baseLayerUrl}/query`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function getObjectIds({ serviceUrl, layerId, where = '1=1', fetchImpl = fetch }) {
  const baseLayerUrl = `${serviceUrl.replace(/\/$/, '')}/${layerId}`;
  const url = buildQueryUrl(baseLayerUrl, {
    where,
    returnIdsOnly: true,
    f: 'json'
  });
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`getObjectIds failed: ${response.status}`);
  const json = await response.json();
  return json.objectIds ?? [];
}

export async function queryFeatureLayerPage({ serviceUrl, layerId, objectIds, where = '1=1', outFields = '*', outSR = 4326, fetchImpl = fetch }) {
  const baseLayerUrl = `${serviceUrl.replace(/\/$/, '')}/${layerId}`;
  const params = {
    where,
    outFields,
    returnGeometry: true,
    outSR,
    f: 'geojson'
  };
  if (Array.isArray(objectIds) && objectIds.length > 0) {
    params.objectIds = objectIds.join(',');
  }
  const url = buildQueryUrl(baseLayerUrl, params);
  const response = await fetchImpl(url);
  if (response.ok) {
    return { ok: true, mode: 'geojson', url, json: await response.json(), warnings: [] };
  }

  const fallbackUrl = buildQueryUrl(baseLayerUrl, {
    where,
    outFields,
    returnGeometry: true,
    outSR,
    f: 'json',
    ...(Array.isArray(objectIds) && objectIds.length > 0 ? { objectIds: objectIds.join(',') } : {})
  });
  const fallbackResponse = await fetchImpl(fallbackUrl);
  if (!fallbackResponse.ok) {
    throw new Error(`queryFeatureLayerPage failed: ${response.status}/${fallbackResponse.status}`);
  }
  return {
    ok: true,
    mode: 'json',
    url: fallbackUrl,
    json: await fallbackResponse.json(),
    warnings: ['geojson endpoint unavailable; returned esri json fallback']
  };
}

export function normalizeArcgisGeoJson(input) {
  if (!input) return { type: 'FeatureCollection', features: [] };
  if (input.type === 'FeatureCollection' && Array.isArray(input.features)) {
    return input;
  }
  if (Array.isArray(input.features)) {
    // Minimal fallback conversion for point/polyline/polygon esri json.
    const features = input.features.map((f) => {
      const attrs = f.attributes ?? {};
      const g = f.geometry ?? {};
      let geometry = null;
      if (Array.isArray(g.x) && Array.isArray(g.y)) {
        geometry = { type: 'Point', coordinates: [g.x, g.y] };
      } else if (typeof g.x === 'number' && typeof g.y === 'number') {
        geometry = { type: 'Point', coordinates: [g.x, g.y] };
      } else if (Array.isArray(g.paths) && g.paths[0]) {
        geometry = { type: 'LineString', coordinates: g.paths[0] };
      } else if (Array.isArray(g.rings) && g.rings[0]) {
        geometry = { type: 'Polygon', coordinates: g.rings };
      }
      return { type: 'Feature', geometry, properties: attrs };
    });
    return { type: 'FeatureCollection', features };
  }
  return { type: 'FeatureCollection', features: [] };
}

export function mergeFeatureCollections(collections) {
  return {
    type: 'FeatureCollection',
    features: collections.flatMap((c) => c.features ?? [])
  };
}

export async function downloadFeatureLayerAsGeoJson({ serviceUrl, layerId, where = '1=1', outFields = '*', outSR = 4326, fetchImpl = fetch }) {
  const objectIds = await getObjectIds({ serviceUrl, layerId, where, fetchImpl });
  const chunks = chunkObjectIds(objectIds);
  const warnings = [];
  if (chunks.length === 0) {
    const single = await queryFeatureLayerPage({ serviceUrl, layerId, where, outFields, outSR, fetchImpl });
    warnings.push(...single.warnings);
    return { featureCollection: normalizeArcgisGeoJson(single.json), warnings, source: { serviceUrl, layerId, chunkCount: 0 } };
  }

  const parts = [];
  for (const chunk of chunks) {
    const page = await queryFeatureLayerPage({ serviceUrl, layerId, objectIds: chunk, where, outFields, outSR, fetchImpl });
    warnings.push(...page.warnings);
    parts.push(normalizeArcgisGeoJson(page.json));
  }

  return {
    featureCollection: mergeFeatureCollections(parts),
    warnings,
    source: { serviceUrl, layerId, objectIds: objectIds.length, chunkCount: chunks.length }
  };
}
