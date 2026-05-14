// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { assignFeatureToPolygonByCentroid } from '../program/gis/spatial_assignment.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    gisDir: 'know/input/gis',
    produceDir: 'know/produce',
    qaDir: 'output/qa',
    calibrationDir: 'know/input/local-calibration',
    sourceManifestPath: 'know/source-manifest.json',
    apply: false
  };
  for (const arg of argv) {
    if (arg.startsWith('--gis-dir=')) out.gisDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--produce-dir=')) out.produceDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--qa-dir=')) out.qaDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--calibration-dir=')) out.calibrationDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--manifest=')) out.sourceManifestPath = arg.split('=').slice(1).join('=');
    else if (arg === '--apply') out.apply = true;
  }
  return out;
}

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

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function writeCsv(filePath, headers, records) {
  const lines = [headers.join(',')];
  for (const row of records) {
    lines.push(headers.map((h) => csvEscape(row[h] ?? '')).join(','));
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

function sha256File(filePath) {
  const data = fs.readFileSync(filePath);
  return `sha256:${crypto.createHash('sha256').update(data).digest('hex')}`;
}

function geometryTypeCounts(features = []) {
  const out = {};
  for (const f of features) {
    const t = f?.geometry?.type ?? 'null';
    out[t] = (out[t] ?? 0) + 1;
  }
  return out;
}

function boundsForFeatures(features = []) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (coord) => {
    if (!Array.isArray(coord)) return;
    if (coord.length >= 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number') {
      minX = Math.min(minX, coord[0]);
      minY = Math.min(minY, coord[1]);
      maxX = Math.max(maxX, coord[0]);
      maxY = Math.max(maxY, coord[1]);
      return;
    }
    for (const child of coord) visit(child);
  };
  for (const f of features) visit(f?.geometry?.coordinates);
  if (!Number.isFinite(minX)) return null;
  return [minX, minY, maxX, maxY];
}

function inferLayerType(fileName, fields = []) {
  const n = fileName.toLowerCase();
  const f = fields.map((x) => x.toLowerCase());
  if (n.includes('address')) return 'address_points';
  if (n.includes('building') || n.includes('footprint')) return 'building_footprints';
  if (n.includes('parcel')) return 'parcels';
  if (n.includes('lots-and-concessions') || n.includes('lot-fabric')) return 'parcel_lot_fabric';
  if (n.includes('municipality')) return 'municipality_boundaries';
  if (n.includes('settlement')) return 'settlement_boundaries';
  if (n.includes('land-use') || n.includes('official-plan')) return 'land_use';
  if (n.includes('road-centre') || n.includes('road-centrelines')) return 'roads';
  if (n.includes('facilities') || n.includes('services')) return 'public_facilities';
  if (f.some((k) => k.includes('concession') || k === 'lot')) return 'parcel_lot_fabric';
  return 'unknown';
}

function likelyQualityTier(layerType, filePath) {
  if (filePath.includes('/know/input/gis/')) {
    if (['municipality_boundaries', 'settlement_boundaries', 'land_use', 'roads', 'parcel_lot_fabric'].includes(layerType)) {
      return 'direct_local';
    }
    return 'regional_proxy';
  }
  if (filePath.includes('/know/produce/')) return 'scenario_only';
  return 'unknown';
}

function importReadiness(layerType, filePath) {
  if (filePath.includes('/know/produce/')) return 'unsuitable';
  if (layerType === 'parcel_lot_fabric') return 'ready_to_bridge';
  if (['municipality_boundaries', 'settlement_boundaries', 'land_use', 'roads', 'public_facilities'].includes(layerType)) {
    return 'needs_field_mapping';
  }
  if (['address_points', 'building_footprints', 'parcels'].includes(layerType)) return 'ready_to_bridge';
  return 'unsuitable';
}

function recordForGeojson(filePath, rootType = 'input') {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const features = Array.isArray(parsed?.features) ? parsed.features : [];
  const fields = [...new Set(features.flatMap((x) => Object.keys(x?.properties ?? {})))].sort();
  const layerType = inferLayerType(path.basename(filePath), fields);
  const isPrimary = rootType === 'input';
  return {
    path: filePath,
    inferred_layer_type: layerType,
    feature_count: features.length,
    fields,
    geometry_type: Object.keys(geometryTypeCounts(features)).join(',') || 'none',
    bounds: boundsForFeatures(features),
    likely_quality_tier: likelyQualityTier(layerType, filePath),
    import_readiness: importReadiness(layerType, filePath),
    primary_source_eligible: isPrimary,
    notes: isPrimary
      ? ''
      : 'Generated/derived GeoJSON under know/produce is not treated as a primary source.'
  };
}

function updateSourceManifestWithGis(manifestPath, gisDir) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  const byPath = new Map(entries.map((e) => [path.resolve(e.local_path), e]));
  const geojsons = fs.readdirSync(gisDir).filter((f) => f.endsWith('.geojson')).sort();
  let added = 0;
  for (const name of geojsons) {
    const fullPath = path.resolve(gisDir, name);
    if (byPath.has(fullPath)) continue;
    const sourceId = `grey_gis_${name.replace(/\.geojson$/i, '').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;
    entries.push({
      source_id: sourceId,
      title: `Grey GIS snapshot: ${name}`,
      source_class: 'external_snapshot',
      local_origin: 'grey_open_data_download',
      retrieved_at: new Date().toISOString(),
      local_path: path.relative(path.resolve('.'), fullPath),
      content_hash: sha256File(fullPath),
      licence: 'Grey County Open Data terms',
      schema_version: '1.0',
      notes: 'Auto-registered existing local GIS snapshot for provenance bridge pass.'
    });
    added += 1;
  }
  manifest.entries = entries;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return { added, total: entries.length };
}

function readCalibrationCsv(csvPath, headers) {
  if (!fs.existsSync(csvPath)) {
    return { headers, records: [] };
  }
  const parsed = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  if (!parsed.headers.length) return { headers, records: [] };
  return parsed;
}

function bridgeLotsToParcels({ gisDir, manifest, calibrationDir }) {
  const lotsPath = path.join(gisDir, 'lots-and-concessions-grey.geojson');
  const muniPath = path.join(gisDir, 'municipality-boundaries.geojson');
  if (!fs.existsSync(lotsPath) || !fs.existsSync(muniPath)) {
    return {
      bridged: 0,
      readiness: 'unsuitable',
      notes: 'Required lots/concessions or municipality boundaries layer missing.',
      records: []
    };
  }

  const manifestEntry = (manifest.entries ?? []).find((e) => path.resolve(e.local_path) === path.resolve(lotsPath));
  if (!manifestEntry) {
    return {
      bridged: 0,
      readiness: 'needs_field_mapping',
      notes: 'Lots/concessions layer exists but is not source-manifested.',
      records: []
    };
  }

  const lots = JSON.parse(fs.readFileSync(lotsPath, 'utf8')).features ?? [];
  const munisRaw = JSON.parse(fs.readFileSync(muniPath, 'utf8')).features ?? [];
  const muniFeatures = munisRaw.map((f, idx) => ({
    type: 'Feature',
    geometry: f.geometry,
    municipalityName: String(
      f?.properties?.MUNI_NAME
      ?? f?.properties?.MUNIC_NAME
      ?? f?.properties?.MUNICIPALITY
      ?? f?.properties?.NAME
      ?? `municipality-${idx + 1}`
    )
  }));

  const rows = [];
  for (const [idx, feature] of lots.entries()) {
    const props = feature?.properties ?? {};
    const area = Number(props.ShapeSTArea);
    const assigned = assignFeatureToPolygonByCentroid(feature, muniFeatures);
    const municipality = assigned?.matched?.municipalityName ?? String(props.TOWNSHIP ?? 'unknown');
    const lot = String(props.LOT ?? '').trim();
    const concession = String(props.CONCESSION ?? '').trim();
    const legalDesc = String(props.LEGAL_DESCRIPTION ?? '').trim();
    rows.push({
      parcel_id: `lotcon-${props.OBJECTID ?? idx + 1}`,
      municipality,
      land_area_m2: Number.isFinite(area) && area > 0 ? area.toFixed(2) : '',
      zoning_or_land_use: 'unknown_lot_fabric_proxy',
      assessment_class: 'unknown',
      has_residential_use: 'unknown',
      source_ref: manifestEntry.source_id,
      quality_tier: 'direct_local',
      notes: `lot_fabric_proxy; lot=${lot}; concession=${concession}; legal=${legalDesc}; linkage=none`
    });
  }

  const parcelCsvPath = path.join(calibrationDir, 'parcels.csv');
  const expectedHeaders = ['parcel_id', 'municipality', 'land_area_m2', 'zoning_or_land_use', 'assessment_class', 'has_residential_use', 'source_ref', 'quality_tier', 'notes'];
  const existing = readCalibrationCsv(parcelCsvPath, expectedHeaders);
  const hasManualRows = existing.records.length > 0;

  return {
    bridged: rows.length,
    readiness: 'ready_to_bridge',
    notes: hasManualRows
      ? 'Manual parcel rows already exist; bridge will not overwrite.'
      : 'Lots/concessions bridged as parcel_lot_fabric proxy only (no address/building linkage).',
    records: rows,
    outputPath: parcelCsvPath,
    existingHeaders: existing.headers.length ? existing.headers : expectedHeaders,
    existingRecords: existing.records,
    hasManualRows
  };
}

function markdownInventory(items) {
  const lines = [
    '# GIS Source Inventory',
    '',
    '| Path | Layer type | Count | Geometry | Quality tier | Readiness | Primary eligible |',
    '|---|---|---:|---|---|---|---|'
  ];
  for (const item of items) {
    lines.push(`| ${item.path} | ${item.inferred_layer_type} | ${item.feature_count ?? item.row_count ?? 0} | ${item.geometry_type ?? 'n/a'} | ${item.likely_quality_tier} | ${item.import_readiness} | ${item.primary_source_eligible ? 'yes' : 'no'} |`);
  }
  return `${lines.join('\n')}\n`;
}

function markdownCandidates(cands) {
  const lines = [
    '# GIS Bridge Candidates',
    '',
    '| Candidate | Layer | Readiness | Bridged rows | Notes |',
    '|---|---|---|---:|---|'
  ];
  for (const c of cands) {
    lines.push(`| ${c.candidate_id} | ${c.layer} | ${c.readiness} | ${c.bridged_rows ?? 0} | ${c.notes ?? ''} |`);
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const opts = parseArgs();
  const gisDir = path.resolve(opts.gisDir);
  const produceDir = path.resolve(opts.produceDir);
  const qaDir = path.resolve(opts.qaDir);
  const calibrationDir = path.resolve(opts.calibrationDir);
  const manifestPath = path.resolve(opts.sourceManifestPath);

  fs.mkdirSync(qaDir, { recursive: true });

  const manifestUpdate = updateSourceManifestWithGis(manifestPath, gisDir);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const inventory = [];
  const inputGeojsons = fs.readdirSync(gisDir).filter((f) => f.endsWith('.geojson')).sort();
  for (const name of inputGeojsons) {
    inventory.push(recordForGeojson(path.join(gisDir, name), 'input'));
  }

  const produceFiles = fs.existsSync(produceDir) ? fs.readdirSync(produceDir).filter((f) => f.endsWith('.geojson') || f.includes('land-access')) : [];
  for (const name of produceFiles) {
    const full = path.join(produceDir, name);
    if (name.endsWith('.geojson')) {
      inventory.push(recordForGeojson(full, 'produce'));
    } else if (name.endsWith('.json')) {
      try {
        const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
        inventory.push({
          path: full,
          inferred_layer_type: 'unknown',
          row_count: Array.isArray(parsed) ? parsed.length : null,
          fields: Object.keys(parsed ?? {}),
          geometry_type: 'n/a',
          bounds: null,
          likely_quality_tier: 'scenario_only',
          import_readiness: 'unsuitable',
          primary_source_eligible: false,
          notes: 'Generated report artifact.'
        });
      } catch {
        // ignore
      }
    }
  }

  const bridgeLots = bridgeLotsToParcels({ gisDir, manifest, calibrationDir });

  const candidates = [
    {
      candidate_id: 'lots_concessions_to_parcels_proxy',
      layer: 'lots-and-concessions-grey.geojson',
      readiness: bridgeLots.readiness,
      bridged_rows: bridgeLots.bridged,
      notes: bridgeLots.notes
    }
  ];

  if (opts.apply && bridgeLots.readiness === 'ready_to_bridge' && !bridgeLots.hasManualRows) {
    writeCsv(bridgeLots.outputPath, bridgeLots.existingHeaders, bridgeLots.records);
  }

  const invJsonPath = path.join(qaDir, 'gis-source-inventory.json');
  const invMdPath = path.join(qaDir, 'gis-source-inventory.md');
  const candJsonPath = path.join(qaDir, 'gis-bridge-candidates.json');
  const candMdPath = path.join(qaDir, 'gis-bridge-candidates.md');

  fs.writeFileSync(invJsonPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    source_manifest_entries_added: manifestUpdate.added,
    items: inventory
  }, null, 2));
  fs.writeFileSync(invMdPath, markdownInventory(inventory));

  fs.writeFileSync(candJsonPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    candidates,
    apply_mode: opts.apply,
    bridged_outputs: opts.apply && bridgeLots.readiness === 'ready_to_bridge' && !bridgeLots.hasManualRows
      ? [bridgeLots.outputPath]
      : []
  }, null, 2));
  fs.writeFileSync(candMdPath, markdownCandidates(candidates));

  console.log(`source manifest GIS entries added: ${manifestUpdate.added}`);
  console.log(`inventory json: ${invJsonPath}`);
  console.log(`inventory md: ${invMdPath}`);
  console.log(`bridge candidates json: ${candJsonPath}`);
  console.log(`bridge candidates md: ${candMdPath}`);
  if (opts.apply) {
    if (bridgeLots.hasManualRows) {
      console.log('apply skipped for parcels.csv: existing manual rows detected');
    } else {
      console.log(`applied parcels bridge rows: ${bridgeLots.records.length}`);
    }
  } else {
    console.log('dry-run only. use --apply to write bridgeable rows.');
  }
}

main();
