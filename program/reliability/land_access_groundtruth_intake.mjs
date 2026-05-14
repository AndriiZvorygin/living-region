// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

const ALLOWED_QUALITY_TIERS = new Set([
  'direct_local',
  'regional_proxy',
  'provincial_proxy',
  'national_proxy',
  'scenario_only',
  'unknown'
]);

const ALLOWED_LINKAGE_METHODS = new Set([
  'source_provided',
  'spatial_join',
  'manual_review',
  'inferred',
  'unknown'
]);

const ALLOWED_LINKAGE_CONFIDENCE = new Set(['high', 'medium', 'low', 'unknown']);

function parseCsv(text) {
  const rows = [];
  let cur = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      row.push(cur);
      cur = '';
      continue;
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cur);
      cur = '';
      if (row.some((v) => String(v).trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    cur += ch;
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    if (row.some((v) => String(v).trim() !== '')) rows.push(row);
  }
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((h) => String(h).trim());
  const records = rows.slice(1).map((r) => {
    const out = {};
    headers.forEach((h, idx) => { out[h] = String(r[idx] ?? '').trim(); });
    return out;
  });
  return { headers, records };
}

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function ensureHeaders(headers, required, failures, label) {
  for (const h of required) {
    if (!headers.includes(h)) failures.push(`${label} missing required header: ${h}`);
  }
}

function boolLike(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (['true', 'yes', '1'].includes(s)) return true;
  if (['false', 'no', '0'].includes(s)) return false;
  if (s === 'unknown') return 'unknown';
  return null;
}

function loadSourceRefs(sourceManifestPath) {
  const p = path.resolve(sourceManifestPath ?? 'know/source-manifest.json');
  if (!fs.existsSync(p)) return new Set();
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    return new Set((parsed.entries ?? []).map((e) => e.source_id).filter(Boolean));
  } catch {
    return new Set();
  }
}

function validateQualityTier(value, rowLabel, failures, warnings) {
  if (!value) {
    warnings.push(`${rowLabel} missing quality_tier; defaulting to unknown`);
    return 'unknown';
  }
  if (!ALLOWED_QUALITY_TIERS.has(value)) {
    failures.push(`${rowLabel} invalid quality_tier '${value}'`);
    return value;
  }
  if (value === 'unknown') warnings.push(`${rowLabel} quality_tier is unknown`);
  return value;
}

function summarizeCounts(rows, field) {
  const out = {};
  for (const row of rows) {
    const key = String(row[field] ?? '').trim() || 'unknown';
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

export function buildLandAccessGroundtruthSummary(options = {}) {
  const inputDir = path.resolve(options.inputDir ?? 'know/input/local-calibration');
  const schemaDir = path.resolve(options.schemaDir ?? 'know/schema/local-calibration');
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  const sourceManifestPath = path.resolve(options.sourceManifestPath ?? 'know/source-manifest.json');
  const strict = options.strict !== false;

  fs.mkdirSync(produceDir, { recursive: true });

  const failures = [];
  const warnings = [];
  const sourceRefs = loadSourceRefs(sourceManifestPath);

  const specs = [
    {
      key: 'address_points',
      csv: 'address-points.csv',
      schema: 'address-points.schema.json',
      required: ['address_id', 'civic_address', 'municipality', 'latitude', 'longitude', 'source_ref', 'quality_tier', 'notes']
    },
    {
      key: 'building_footprints',
      csv: 'building-footprints.csv',
      schema: 'building-footprints.schema.json',
      required: ['building_id', 'municipality', 'centroid_latitude', 'centroid_longitude', 'footprint_area_m2', 'building_type', 'source_ref', 'quality_tier', 'notes']
    },
    {
      key: 'parcels',
      csv: 'parcels.csv',
      schema: 'parcels.schema.json',
      required: ['parcel_id', 'municipality', 'land_area_m2', 'zoning_or_land_use', 'assessment_class', 'has_residential_use', 'source_ref', 'quality_tier', 'notes']
    },
    {
      key: 'parcel_address_linkage',
      csv: 'parcel-address-linkage.csv',
      schema: 'parcel-address-linkage.schema.json',
      required: ['parcel_id', 'address_id', 'building_id', 'linkage_method', 'linkage_confidence', 'source_ref', 'quality_tier', 'notes']
    }
  ];

  const rowsByType = {
    address_points: [],
    building_footprints: [],
    parcels: [],
    parcel_address_linkage: []
  };

  for (const spec of specs) {
    const schemaPath = path.join(schemaDir, spec.schema);
    if (!fs.existsSync(schemaPath)) failures.push(`Missing land-access schema: ${schemaPath}`);

    const csvPath = path.join(inputDir, spec.csv);
    if (!fs.existsSync(csvPath)) {
      warnings.push(`Missing land-access CSV (allowed empty intake): ${csvPath}`);
      continue;
    }

    const { headers, records } = parseCsv(fs.readFileSync(csvPath, 'utf8'));
    ensureHeaders(headers, spec.required, failures, spec.key);

    for (const [idx, rec] of records.entries()) {
      const rowLabel = `${spec.key} row ${idx + 2}`;
      for (const h of spec.required) {
        if (!String(rec[h] ?? '').trim()) failures.push(`${rowLabel} missing ${h}`);
      }

      const qualityTier = validateQualityTier(String(rec.quality_tier ?? '').trim(), rowLabel, failures, warnings);
      rec.quality_tier = qualityTier;

      if (rec.source_ref && !sourceRefs.has(rec.source_ref)) {
        warnings.push(`${rowLabel} source_ref not found in source manifest: ${rec.source_ref}`);
      }

      if (spec.key === 'address_points') {
        const lat = n(rec.latitude);
        const lon = n(rec.longitude);
        if (lat == null || lat < -90 || lat > 90) failures.push(`${rowLabel} invalid latitude`);
        if (lon == null || lon < -180 || lon > 180) failures.push(`${rowLabel} invalid longitude`);
      } else if (spec.key === 'building_footprints') {
        const lat = n(rec.centroid_latitude);
        const lon = n(rec.centroid_longitude);
        const area = n(rec.footprint_area_m2);
        if (lat == null || lat < -90 || lat > 90) failures.push(`${rowLabel} invalid centroid_latitude`);
        if (lon == null || lon < -180 || lon > 180) failures.push(`${rowLabel} invalid centroid_longitude`);
        if (area == null || area <= 0) failures.push(`${rowLabel} invalid footprint_area_m2`);
      } else if (spec.key === 'parcels') {
        const area = n(rec.land_area_m2);
        if (area == null || area <= 0) failures.push(`${rowLabel} invalid land_area_m2`);
        if (boolLike(rec.has_residential_use) == null) failures.push(`${rowLabel} invalid has_residential_use`);
      } else if (spec.key === 'parcel_address_linkage') {
        const method = String(rec.linkage_method ?? '').trim();
        const conf = String(rec.linkage_confidence ?? '').trim();
        if (!ALLOWED_LINKAGE_METHODS.has(method)) failures.push(`${rowLabel} invalid linkage_method '${method}'`);
        if (!ALLOWED_LINKAGE_CONFIDENCE.has(conf)) failures.push(`${rowLabel} invalid linkage_confidence '${conf}'`);
      }

      rowsByType[spec.key].push(rec);
    }
  }

  const addressRows = rowsByType.address_points;
  const buildingRows = rowsByType.building_footprints;
  const parcelRows = rowsByType.parcels;
  const linkRows = rowsByType.parcel_address_linkage;

  const linkedAddressIds = new Set(linkRows.map((r) => r.address_id));
  const linkedParcelIds = new Set(linkRows.map((r) => r.parcel_id));
  const addressIds = new Set(addressRows.map((r) => r.address_id));
  const parcelIds = new Set(parcelRows.map((r) => r.parcel_id));

  const residentialParcels = parcelRows.filter((r) => boolLike(r.has_residential_use) === true);
  const residentialLandAreaM2 = residentialParcels.reduce((sum, r) => sum + (n(r.land_area_m2) ?? 0), 0);

  const qualityTierCounts = summarizeCounts([
    ...addressRows,
    ...buildingRows,
    ...parcelRows,
    ...linkRows
  ], 'quality_tier');

  const linkageConfidenceCounts = summarizeCounts(linkRows, 'linkage_confidence');
  const linkageMethodCounts = summarizeCounts(linkRows, 'linkage_method');

  const allSourceBacked = linkRows.length > 0 && linkRows.every((r) => sourceRefs.has(r.source_ref));
  const inferredOnlyLinkage = linkRows.length > 0 && linkRows.every((r) => String(r.linkage_method ?? '').trim() === 'inferred');
  const hasDirectLocal = Object.entries(qualityTierCounts).some(([tier, count]) => tier === 'direct_local' && count > 0);
  const linkedShare = parcelIds.size > 0 ? linkedParcelIds.size / parcelIds.size : 0;

  const groundtruthStatus = (() => {
    if (!addressRows.length && !parcelRows.length && !buildingRows.length && !linkRows.length) return 'no_groundtruth';
    if (
      allSourceBacked
      && hasDirectLocal
      && linkedShare >= 0.8
      && !inferredOnlyLinkage
      && addressRows.length > 0
      && parcelRows.length > 0
      && linkRows.length > 0
    ) {
      return 'direct_groundtruth';
    }
    return 'partial_groundtruth';
  })();

  const limitations = [];
  if (groundtruthStatus === 'no_groundtruth') {
    limitations.push('No source-backed address/parcel/building/linkage rows were loaded.');
  }
  if (groundtruthStatus !== 'direct_groundtruth') {
    limitations.push('Land-access claims remain constrained by incomplete or indirect parcel-address-unit linkage evidence.');
  }
  if (inferredOnlyLinkage) {
    limitations.push('Linkage method is inferred-only; this cannot be treated as direct ground truth.');
  }
  if (!allSourceBacked && linkRows.length > 0) {
    limitations.push('Some linkage rows reference sources not found in source manifest.');
  }
  if (linkedShare > 0 && linkedShare < 0.8) {
    limitations.push(`Linked parcel coverage is partial (${(linkedShare * 100).toFixed(1)}%).`);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    sourceStatus: 'land_access_groundtruth_intake_contract',
    landAccessGroundtruthStatus: groundtruthStatus,
    address_count: addressRows.length,
    parcel_count: parcelRows.length,
    building_count: buildingRows.length,
    linked_address_count: [...addressIds].filter((id) => linkedAddressIds.has(id)).length,
    linked_parcel_count: [...parcelIds].filter((id) => linkedParcelIds.has(id)).length,
    residential_parcel_count: residentialParcels.length,
    residential_land_area_m2: residentialLandAreaM2,
    unlinked_address_count: [...addressIds].filter((id) => !linkedAddressIds.has(id)).length,
    unlinked_parcel_count: [...parcelIds].filter((id) => !linkedParcelIds.has(id)).length,
    quality_tier_counts: qualityTierCounts,
    linkage_confidence_counts: linkageConfidenceCounts,
    linkage_method_counts: linkageMethodCounts,
    inferred_only_linkage: inferredOnlyLinkage,
    all_linkage_rows_source_backed: allSourceBacked,
    limitations
  };

  const jsonPath = path.join(produceDir, 'land-access-groundtruth-summary.json');
  const mdPath = path.join(produceDir, 'land-access-groundtruth-summary.md');

  const md = [
    '# Land Access Ground-Truth Summary',
    '',
    '## What this is',
    'Summary of address/parcel/building/linkage calibration intake for land-access ground truth. This report is contract-first and safe with header-only inputs.',
    '',
    `- landAccessGroundtruthStatus: ${summary.landAccessGroundtruthStatus}`,
    `- address_count: ${summary.address_count}`,
    `- parcel_count: ${summary.parcel_count}`,
    `- building_count: ${summary.building_count}`,
    `- linked_address_count: ${summary.linked_address_count}`,
    `- linked_parcel_count: ${summary.linked_parcel_count}`,
    `- residential_parcel_count: ${summary.residential_parcel_count}`,
    `- residential_land_area_m2: ${summary.residential_land_area_m2}`,
    `- unlinked_address_count: ${summary.unlinked_address_count}`,
    `- unlinked_parcel_count: ${summary.unlinked_parcel_count}`,
    '',
    '## Quality Tier Counts',
    ...Object.entries(summary.quality_tier_counts).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Linkage Confidence Counts',
    ...(Object.keys(summary.linkage_confidence_counts).length
      ? Object.entries(summary.linkage_confidence_counts).map(([k, v]) => `- ${k}: ${v}`)
      : ['- none']),
    '',
    '## Linkage Method Counts',
    ...(Object.keys(summary.linkage_method_counts).length
      ? Object.entries(summary.linkage_method_counts).map(([k, v]) => `- ${k}: ${v}`)
      : ['- none']),
    '',
    '## Limitations',
    ...(summary.limitations.length ? summary.limitations.map((l) => `- ${l}`) : ['- none'])
  ].join('\n');

  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  fs.writeFileSync(mdPath, md);

  if (strict && failures.length) {
    return { status: 'fail', failures, warnings, summary, paths: { jsonPath, mdPath } };
  }
  return { status: failures.length ? 'fail' : 'pass', failures, warnings, summary, paths: { jsonPath, mdPath } };
}
