// SPDX-License-Identifier: AGPL-3.0-or-later

function firstOrNull(values) {
  return Array.isArray(values) && values.length > 0 ? values[0] : null;
}

function lowerText(value) {
  return String(value ?? '').toLowerCase();
}

function scoreTermMatches(text, terms = []) {
  const hay = lowerText(text);
  return terms.reduce((sum, term) => (hay.includes(lowerText(term)) ? sum + 1 : sum), 0);
}

function guessSemanticFields(fieldNames = []) {
  const names = fieldNames.map((x) => String(x));
  const pick = (patterns) => names.find((name) => patterns.some((p) => p.test(name))) ?? null;
  return {
    roadNameField: pick([/road.*name/i, /^name$/i, /street/i]),
    roadClassField: pick([/class/i, /func/i, /roadtype/i]),
    jurisdictionField: pick([/juris/i, /owner/i, /maint/i, /municip/i, /county/i]),
    surfaceField: pick([/surface/i, /pave/i]),
    speedField: pick([/speed/i, /limit/i]),
    lanesField: pick([/lane/i]),
    settlementNameField: pick([/settle/i, /community/i, /^name$/i]),
    landUseDesignationField: pick([/land[_\s]?use/i, /designation/i, /final.*type/i, /sched/i]),
    lotField: pick([/^lot$/i, /lot.*num/i]),
    concessionField: pick([/concession/i, /con_?no/i]),
    townshipField: pick([/township/i, /geo.*town/i]),
    municipalityField: pick([/municipal/i, /mun_?name/i, /^county$/i])
  };
}

export function extractArcgisItemIdFromHtml(html) {
  if (!html) return null;
  const matches = [];
  const regexes = [
    /itemId["'\s:=>]+([a-f0-9]{32})/ig,
    /"id"\s*:\s*"([a-f0-9]{32})"/ig,
    /"item"\s*:\s*\{[^}]*"id"\s*:\s*"([a-f0-9]{32})"/ig,
    /\/items\/([a-f0-9]{32})/ig,
    /[?&]id=([a-f0-9]{32})/ig
  ];
  for (const re of regexes) {
    for (const match of html.matchAll(re)) {
      if (match[1]) matches.push(match[1]);
    }
  }
  return firstOrNull([...new Set(matches)]);
}

export function extractServiceUrlFromHtml(html) {
  if (!html) return null;
  const regex = /(https?:\/\/[^"'\s]+\/(FeatureServer|MapServer))/ig;
  const matches = [];
  for (const m of html.matchAll(regex)) {
    matches.push(m[1]);
  }
  return firstOrNull([...new Set(matches)]);
}

export async function fetchArcgisItemMetadata(itemId, fetchImpl = fetch) {
  const url = `https://www.arcgis.com/sharing/rest/content/items/${itemId}?f=json`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    return { ok: false, url, status: response.status, metadata: null, warnings: [`item metadata request failed: ${response.status}`] };
  }
  const json = await response.json();
  return { ok: true, url, status: response.status, metadata: json, warnings: [] };
}

export async function fetchServiceMetadata(serviceUrl, fetchImpl = fetch) {
  const url = `${serviceUrl.replace(/\/$/, '')}?f=json`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    return { ok: false, url, status: response.status, metadata: null, warnings: [`service metadata request failed: ${response.status}`] };
  }
  const json = await response.json();
  return { ok: true, url, status: response.status, metadata: json, warnings: [] };
}

async function fetchLayerMetadata(serviceUrl, layerId, fetchImpl = fetch) {
  if (layerId === null || layerId === undefined) return { ok: false, metadata: null, warnings: [] };
  const url = `${serviceUrl.replace(/\/$/, '')}/${layerId}?f=json`;
  const response = await fetchImpl(url);
  if (!response.ok) return { ok: false, metadata: null, warnings: [`layer metadata request failed: ${response.status}`] };
  return { ok: true, metadata: await response.json(), warnings: [] };
}

export async function discoverArcgisDatasetFromHubPage(sourcePageUrl, options = {}) {
  const warnings = [];
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(sourcePageUrl);
  if (!response.ok) {
    return {
      ok: false,
      sourcePageUrl,
      html: null,
      itemId: null,
      serviceUrl: null,
      warnings: [`hub page request failed: ${response.status}`]
    };
  }
  const html = await response.text();
  const itemId = extractArcgisItemIdFromHtml(html);
  const serviceUrl = extractServiceUrlFromHtml(html);
  if (!itemId) warnings.push('itemId not found in page html');
  if (!serviceUrl) warnings.push('serviceUrl not found in page html');

  return {
    ok: true,
    sourcePageUrl,
    html,
    itemId,
    serviceUrl,
    warnings
  };
}

export async function searchArcgisItems(searchQuery, fetchImpl = fetch) {
  const url = new URL('https://www.arcgis.com/sharing/rest/search');
  url.searchParams.set('q', searchQuery);
  url.searchParams.set('f', 'json');
  url.searchParams.set('num', '10');
  url.searchParams.set('sortField', 'relevance');
  url.searchParams.set('sortOrder', 'desc');
  const response = await fetchImpl(url.toString());
  if (!response.ok) {
    return { ok: false, searchQuery, url: url.toString(), results: [], warnings: [`search failed: ${response.status}`] };
  }
  const json = await response.json();
  return {
    ok: true,
    searchQuery,
    url: url.toString(),
    results: Array.isArray(json.results) ? json.results : [],
    warnings: []
  };
}

export function rankArcgisCandidates({ candidates, source }) {
  const slug = source.sourcePageUrl?.split('/').slice(-2).join('/') ?? '';
  return candidates
    .map((candidate) => {
      const title = candidate.title ?? '';
      const owner = candidate.owner ?? '';
      const url = candidate.url ?? '';
      const type = candidate.type ?? '';
      let score = 0;
      score += scoreTermMatches(title, source.expectedTitleTerms ?? []) * 12;
      score += scoreTermMatches(owner, source.expectedOwnerTerms ?? []) * 5;
      score += scoreTermMatches(url, source.expectedUrlTerms ?? []) * 6;
      if (slug && lowerText(candidate.snippet ?? '').includes(lowerText(slug))) score += 4;
      if (/featureservice/i.test(type)) score += 10;
      if (/map service/i.test(type)) score += 6;
      if ((candidate.access ?? '').toLowerCase() === 'public') score += 4;
      if (/FeatureServer|MapServer/i.test(url)) score += 8;
      if (source.preferredItemId && candidate.id === source.preferredItemId) score += 25;
      if (/grey|service_grey|maps\.grey\.ca/i.test(owner) || /maps\.grey\.ca|gis\.grey\.ca/i.test(url)) score += 12;
      if ((source.expectedOwnerTerms ?? []).includes('grey') && !/grey|service_grey|maps\.grey\.ca/i.test(owner) && !/maps\.grey\.ca|gis\.grey\.ca/i.test(url)) score -= 10;
      if ((source.id ?? '').includes('road-centrelines')) {
        if (/grey county roads|all roads in grey county/i.test(title)) score += 22;
        if (/transfer/i.test(title)) score -= 30;
      }
      if ((source.id ?? '').includes('trail') || (source.id ?? '').includes('cycling') || (source.id ?? '').includes('transit')) {
        if (/trail|cycling|cycle|transit|bus/i.test(title)) score += 10;
      }
      if ((source.id ?? '').includes('lot-fabric')) {
        if (/ontario|lio|mnrf|geohub/i.test(owner) || /geohub\.lio\.gov\.on\.ca/i.test(url)) score += 20;
        if (/peel|regionofpeel|city|municipality/i.test(owner)) score -= 15;
      }
      return { ...candidate, score };
    })
    .sort((a, b) => b.score - a.score);
}

export function chooseLayerFromService(serviceMeta, source) {
  const layers = Array.isArray(serviceMeta?.layers) ? serviceMeta.layers : [];
  const expectedGeometry = (source.expectedGeometryType ?? '').toLowerCase();
  const expectedTerms = source.expectedTitleTerms ?? [];
  const scored = layers.map((layer) => {
    let score = 0;
    const layerName = lowerText(layer.name ?? '');
    if (expectedGeometry.includes('polygon') && /polygon/i.test(layer.geometryType ?? '')) score += 10;
    if (expectedGeometry.includes('line') && /(polyline|line)/i.test(layer.geometryType ?? '')) score += 10;
    score += scoreTermMatches(layerName, expectedTerms) * 6;
    if ((source.id ?? '').includes('road-centrelines') && /transfer/i.test(layerName)) score -= 8;
    return { ...layer, score };
  }).sort((a, b) => b.score - a.score);

  const selected = scored[0] ?? null;
  return {
    selectedLayerId: selected?.id ?? null,
    selectedLayerName: selected?.name ?? null,
    layers: layers.map((l) => ({ id: l.id, name: l.name, type: l.type, geometryType: l.geometryType })),
    scoredLayers: scored.map((l) => ({ id: l.id, name: l.name, score: l.score, geometryType: l.geometryType }))
  };
}

function confidenceFromScore(score) {
  if (score >= 26) return 0.9;
  if (score >= 18) return 0.75;
  if (score >= 12) return 0.6;
  if (score >= 8) return 0.45;
  return 0.25;
}

function normalizeServiceUrlAndLayerId(serviceUrl, layerId) {
  if (!serviceUrl) return { serviceUrl: null, layerId: layerId ?? null };
  const clean = serviceUrl.replace(/\/$/, '');
  const match = clean.match(/(.*\/(FeatureServer|MapServer))\/(\d+)$/i);
  if (!match) {
    return { serviceUrl: clean, layerId: layerId ?? null };
  }
  const baseServiceUrl = match[1];
  const derivedLayerId = Number(match[3]);
  return {
    serviceUrl: baseServiceUrl,
    layerId: layerId ?? (Number.isFinite(derivedLayerId) ? derivedLayerId : null)
  };
}

export async function discoverLayerDownloadInfo(source, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const warnings = [];

  const page = await discoverArcgisDatasetFromHubPage(source.sourcePageUrl, { fetchImpl });
  warnings.push(...(page.warnings ?? []));

  let itemId = source.itemId ?? page.itemId ?? null;
  let serviceUrl = source.serviceUrl ?? page.serviceUrl ?? null;
  let layerId = source.layerId ?? null;
  let itemMetadata = null;
  let serviceMetadata = null;
  let candidates = [];
  let selectedCandidate = null;

  if (!itemId && !serviceUrl) {
    const queries = source.searchQueries ?? [];
    for (const q of queries) {
      const search = await searchArcgisItems(q, fetchImpl);
      warnings.push(...(search.warnings ?? []));
      candidates.push(...search.results.map((result) => ({ ...result, searchQuery: q })));
    }

    const ranked = rankArcgisCandidates({ candidates, source });
    candidates = ranked;
    selectedCandidate = ranked[0] ?? null;
    if (selectedCandidate?.id) {
      itemId = selectedCandidate.id;
    }
  }

  if (itemId) {
    const item = await fetchArcgisItemMetadata(itemId, fetchImpl);
    warnings.push(...(item.warnings ?? []));
    itemMetadata = item.metadata;
    if (!serviceUrl && itemMetadata?.url) {
      serviceUrl = itemMetadata.url;
    }
  }

  ({ serviceUrl, layerId } = normalizeServiceUrlAndLayerId(serviceUrl, layerId));

  let layerInfo = { selectedLayerId: layerId, selectedLayerName: null, layers: [], scoredLayers: [] };
  if (serviceUrl && /(FeatureServer|MapServer)/i.test(serviceUrl)) {
    const service = await fetchServiceMetadata(serviceUrl, fetchImpl);
    warnings.push(...(service.warnings ?? []));
    serviceMetadata = service.metadata;
    layerInfo = chooseLayerFromService(serviceMetadata, source);
    if (layerId === null || layerId === undefined) {
      layerId = layerInfo.selectedLayerId;
    }
  }
  const layerMeta = await fetchLayerMetadata(serviceUrl, layerId, fetchImpl);
  warnings.push(...(layerMeta.warnings ?? []));

  const confidenceScore = selectedCandidate?.score ?? (itemId || serviceUrl ? 15 : 0);
  const confidence = confidenceFromScore(confidenceScore);
  if (confidence < 0.5 && (itemId || serviceUrl)) {
    warnings.push('low-confidence selection; verify itemId/serviceUrl manually');
  }

  return {
    id: source.id,
    name: source.name,
    sourcePageUrl: source.sourcePageUrl,
    itemId,
    serviceUrl,
    layerId: layerId ?? null,
    layerName: layerInfo.selectedLayerName ?? null,
    layers: layerInfo.layers,
    candidates: candidates.map((c) => ({
      id: c.id ?? null,
      title: c.title ?? null,
      owner: c.owner ?? null,
      type: c.type ?? null,
      access: c.access ?? null,
      url: c.url ?? null,
      score: c.score ?? 0,
      searchQuery: c.searchQuery ?? null
    })),
    selectedCandidate: selectedCandidate ? {
      itemId: selectedCandidate.id ?? null,
      title: selectedCandidate.title ?? null,
      owner: selectedCandidate.owner ?? null,
      type: selectedCandidate.type ?? null,
      access: selectedCandidate.access ?? null,
      score: selectedCandidate.score ?? 0
    } : null,
    itemMetadataSummary: itemMetadata ? {
      itemId: itemMetadata.id ?? null,
      title: itemMetadata.title ?? null,
      owner: itemMetadata.owner ?? null,
      type: itemMetadata.type ?? null,
      access: itemMetadata.access ?? null,
      url: itemMetadata.url ?? null,
      snippet: itemMetadata.snippet ?? null,
      description: itemMetadata.description ?? null,
      licenseInfo: itemMetadata.licenseInfo ?? null,
      termsOfUse: itemMetadata.termsOfUse ?? null
    } : null,
    serviceFieldNames: Array.isArray(layerMeta.metadata?.fields)
      ? layerMeta.metadata.fields.map((f) => f.name).filter(Boolean)
      : [],
    semanticFieldGuesses: guessSemanticFields(
      Array.isArray(layerMeta.metadata?.fields) ? layerMeta.metadata.fields.map((f) => f.name) : []
    ),
    confidence,
    confidenceScore,
    warnings,
    ok: Boolean(itemId || serviceUrl)
  };
}
