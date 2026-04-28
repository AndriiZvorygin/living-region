// SPDX-License-Identifier: AGPL-3.0-or-later
import { downloadFeatureLayerAsGeoJson } from './arcgis_rest_download.mjs';

export async function downloadHubItemGeoJson({ hubBaseUrl, itemId, layerId, serviceUrl, fetchImpl = fetch }) {
  const host = new URL(hubBaseUrl).host;
  const url = `https://${host}/api/download/v1/items/${itemId}/geojson?layers=${layerId}`;
  const response = await fetchImpl(url);
  if (response.ok) {
    return {
      ok: true,
      mode: 'hub-download',
      url,
      featureCollection: await response.json(),
      warnings: []
    };
  }

  if (!serviceUrl || layerId === null || layerId === undefined) {
    return {
      ok: false,
      mode: 'hub-download',
      url,
      featureCollection: { type: 'FeatureCollection', features: [] },
      warnings: [`hub download failed (${response.status}) and no REST fallback available`]
    };
  }

  const fallback = await downloadFeatureLayerAsGeoJson({ serviceUrl, layerId, fetchImpl });
  return {
    ok: true,
    mode: 'rest-fallback',
    url,
    featureCollection: fallback.featureCollection,
    warnings: [`hub download failed (${response.status}); used REST fallback`, ...(fallback.warnings ?? [])]
  };
}
