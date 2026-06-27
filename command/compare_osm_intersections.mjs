#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

function parseArgs(argv) {
  const args = {
    greyArtifact: '',
    osmPbf: '',
    osmGeojson: '',
    boundary: '',
    out: 'artifacts/osm-intersection-comparison.pya',
    debugOut: 'artifacts/osm-intersection-debug.pya',
    debugGeojson: ''
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--grey-artifact') args.greyArtifact = argv[++i] ?? '';
    else if (token === '--osm-pbf') args.osmPbf = argv[++i] ?? '';
    else if (token === '--osm-geojson') args.osmGeojson = argv[++i] ?? '';
    else if (token === '--boundary') args.boundary = argv[++i] ?? '';
    else if (token === '--out') args.out = argv[++i] ?? args.out;
    else if (token === '--debug-out') args.debugOut = argv[++i] ?? args.debugOut;
    else if (token === '--debug-geojson') args.debugGeojson = argv[++i] ?? '';
  }
  return args;
}

function run(cmd) {
  return execSync(cmd, { stdio: 'pipe' }).toString('utf8');
}

function shell(v) {
  return `'${String(v).replace(/'/g, `'\\''`)}'`;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function featureLines(geo) {
  const lines = [];
  for (let idx = 0; idx < (geo.features ?? []).length; idx += 1) {
    const feature = geo.features[idx];
    const g = feature.geometry;
    if (!g) continue;
    const props = feature.properties ?? {};
    const base = { properties: props, featureIndex: idx };
    if (g.type === 'LineString') lines.push({ ...base, coords: g.coordinates });
    else if (g.type === 'MultiLineString') {
      for (let part = 0; part < g.coordinates.length; part += 1) {
        lines.push({ ...base, partIndex: part, coords: g.coordinates[part] });
      }
    }
  }
  return lines;
}

function nodeKey(pt, precision = 1e-6) {
  return `${Math.round(pt[0] / precision)}:${Math.round(pt[1] / precision)}`;
}

const ROAD_INCLUDE_CONSERVATIVE = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'road']);
const ROAD_INCLUDE_INCLUSIVE = new Set([...ROAD_INCLUDE_CONSERVATIVE, 'service']);
const ROAD_INCLUDE_MUNICIPAL = new Set(['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'road']);
const ROAD_EXCLUDE_ALWAYS = new Set(['footway', 'path', 'cycleway', 'steps', 'pedestrian', 'corridor', 'construction', 'proposed', 'track']);

function normName(name) {
  return String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function wayClass(properties) {
  const highway = String(properties.highway ?? '').toLowerCase();
  const access = String(properties.access ?? '').toLowerCase();
  const service = String(properties.service ?? '').toLowerCase();
  const junction = String(properties.junction ?? '').toLowerCase();
  const name = String(properties.name ?? '').trim();

  const isExcludedAlways = ROAD_EXCLUDE_ALWAYS.has(highway) || highway === '';
  const excludedPrivate = access === 'private' || access === 'no';
  const excludedServiceSubtype = ['driveway', 'parking_aisle', 'alley', 'emergency_access'].includes(service);

  const conservative = !isExcludedAlways && ROAD_INCLUDE_CONSERVATIVE.has(highway) && !excludedPrivate && !(highway === 'service') && !excludedServiceSubtype;
  const inclusive = !isExcludedAlways && ROAD_INCLUDE_INCLUSIVE.has(highway) && !excludedPrivate && !excludedServiceSubtype;
  const municipal = !isExcludedAlways && ROAD_INCLUDE_MUNICIPAL.has(highway) && !excludedPrivate && !excludedServiceSubtype;

  const cycleTagged = (
    highway === 'cycleway' ||
    ['designated', 'yes', 'permissive'].includes(String(properties.bicycle ?? '').toLowerCase()) ||
    properties.cycleway != null ||
    properties['cycleway:left'] != null ||
    properties['cycleway:right'] != null ||
    properties['cycleway:both'] != null
  );

  return { highway, access, service, junction, name, conservative, inclusive, municipal, cycleTagged, isExcludedAlways, excludedPrivate, excludedServiceSubtype };
}

function buildModeStats(lines, mode = 'inclusive') {
  const nodeWays = new Map();
  const nodeCycle = new Set();
  const nodeCoord = new Map();
  const highwayTagCounts = new Map();
  const excludedTagCounts = new Map();
  const duplicateSegments = new Map();

  let waysIncluded = 0;
  let nodesExamined = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const cls = wayClass(line.properties);
    if (cls.highway) highwayTagCounts.set(cls.highway, (highwayTagCounts.get(cls.highway) ?? 0) + 1);

    const includeWay = mode === 'conservative' ? cls.conservative : cls.inclusive;
    if (!includeWay) {
      const reason = cls.isExcludedAlways ? `excluded:${cls.highway || 'missing'}`
        : cls.excludedPrivate ? 'excluded:access_private_or_no'
          : cls.excludedServiceSubtype ? `excluded:service_${cls.service}`
            : `excluded:${cls.highway || 'other'}`;
      excludedTagCounts.set(reason, (excludedTagCounts.get(reason) ?? 0) + 1);
      continue;
    }

    waysIncluded += 1;
    const wayId = line.properties['@id'] ?? line.properties.id ?? `${line.featureIndex}:${line.partIndex ?? 0}`;

    for (let p = 0; p < line.coords.length; p += 1) {
      const pt = line.coords[p];
      const key = nodeKey(pt);
      nodesExamined += 1;
      if (!nodeWays.has(key)) nodeWays.set(key, []);
      nodeWays.get(key).push({
        wayId,
        name: cls.name,
        highway: cls.highway,
        junction: cls.junction,
        access: cls.access,
        service: cls.service
      });
      nodeCoord.set(key, pt);
      if (cls.cycleTagged) nodeCycle.add(key);

      if (p < line.coords.length - 1) {
        const a = nodeKey(line.coords[p]);
        const b = nodeKey(line.coords[p + 1]);
        const segKey = a < b ? `${a}|${b}` : `${b}|${a}`;
        duplicateSegments.set(segKey, (duplicateSegments.get(segKey) ?? 0) + 1);
      }
    }
  }

  const shared = [];
  for (const [key, entries] of nodeWays.entries()) {
    const wayIds = new Set(entries.map((e) => e.wayId));
    if (wayIds.size >= 2) {
      const names = [...new Set(entries.map((e) => e.name).filter(Boolean))];
      const highways = [...new Set(entries.map((e) => e.highway).filter(Boolean))];
      shared.push({
        key,
        degreeRaw: wayIds.size,
        coord: nodeCoord.get(key),
        entries,
        names,
        highways
      });
    }
  }
  shared.sort((a, b) => b.degreeRaw - a.degreeRaw);

  let cycleIntersections = 0;
  for (const n of shared) if (nodeCycle.has(n.key)) cycleIntersections += 1;

  const duplicatedSegmentsCount = [...duplicateSegments.values()].filter((v) => v > 1).length;

  return {
    waysIncluded,
    nodesExamined,
    shared,
    uniqueSharedRoadNodes: shared.length,
    cycleIntersections,
    highwayTagCounts: Object.fromEntries([...highwayTagCounts.entries()].sort((a, b) => b[1] - a[1])),
    excludedTagCounts: Object.fromEntries([...excludedTagCounts.entries()].sort((a, b) => b[1] - a[1])),
    duplicatedWaySegmentsCount: duplicatedSegmentsCount,
    includesServiceRoads: mode === 'inclusive'
  };
}

function buildMunicipalThroughStreet(sharedNodes) {
  const retained = [];
  const dropped = [];

  const dropCounts = {
    same_name_continuation: 0,
    dead_end_terminal: 0,
    roundabout_internal: 0,
    service_private_internal: 0,
    other: 0
  };

  for (const node of sharedNodes) {
    const namesNorm = [...new Set(node.entries.map((e) => normName(e.name)).filter(Boolean))];
    const highways = [...new Set(node.entries.map((e) => e.highway).filter(Boolean))];

    const groups = new Set();
    for (const e of node.entries) {
      const n = normName(e.name);
      groups.add(n || `way:${e.wayId}`);
    }
    const degreeMerged = groups.size;
    const hasRoundabout = node.entries.some((e) => e.junction === 'roundabout');
    const hasExcludedInternal = node.entries.some((e) =>
      e.highway === 'service' ||
      e.access === 'private' ||
      e.access === 'no' ||
      ['driveway', 'parking_aisle', 'alley', 'emergency_access'].includes(e.service)
    );

    const hasTwoDifferentNames = namesNorm.length >= 2;
    const looksDeadEnd = degreeMerged < 2;
    const sameNameContinuation = namesNorm.length <= 1 && degreeMerged <= 2;

    let keep = false;
    let dropReason = 'other';

    if (hasExcludedInternal) {
      keep = false;
      dropReason = 'service_private_internal';
    } else if (hasRoundabout) {
      if (hasTwoDifferentNames && degreeMerged >= 3) {
        keep = true;
      } else {
        keep = false;
        dropReason = 'roundabout_internal';
      }
    } else if (looksDeadEnd) {
      keep = false;
      dropReason = 'dead_end_terminal';
    } else if (sameNameContinuation) {
      keep = false;
      dropReason = 'same_name_continuation';
    } else if (degreeMerged >= 3 || (degreeMerged >= 2 && hasTwoDifferentNames)) {
      keep = true;
    } else {
      keep = false;
      dropReason = 'other';
    }

    const record = {
      osm_node_id: node.key,
      lon: node.coord?.[0] ?? null,
      lat: node.coord?.[1] ?? null,
      connected_way_names: node.names,
      connected_highway_tags: highways,
      degree_raw: node.degreeRaw,
      degree_merged: degreeMerged,
      has_roundabout: hasRoundabout,
      has_excluded_internal: hasExcludedInternal,
      drop_reason: keep ? null : dropReason
    };

    if (keep) retained.push(record);
    else {
      dropped.push(record);
      if (dropCounts[dropReason] == null) dropCounts.other += 1;
      else dropCounts[dropReason] += 1;
    }
  }

  retained.sort((a, b) => b.degree_raw - a.degree_raw);
  dropped.sort((a, b) => b.degree_raw - a.degree_raw);

  return {
    count: retained.length,
    retained,
    dropped,
    dropCounts
  };
}

function segmentIntersections(lines, mode = 'inclusive') {
  const segs = [];
  for (const line of lines) {
    const cls = wayClass(line.properties);
    const includeWay = mode === 'conservative' ? cls.conservative : cls.inclusive;
    if (!includeWay) continue;
    for (let i = 0; i < line.coords.length - 1; i += 1) segs.push([line.coords[i], line.coords[i + 1]]);
  }

  const intersect = (a, b, c, d) => {
    const [ax, ay] = a; const [bx, by] = b; const [cx, cy] = c; const [dx, dy] = d;
    const den = (ax - bx) * (cy - dy) - (ay - by) * (cx - dx);
    if (Math.abs(den) < 1e-14) return null;
    const t = ((ax - cx) * (cy - dy) - (ay - cy) * (cx - dx)) / den;
    const u = ((ax - cx) * (ay - by) - (ay - cy) * (ax - bx)) / den;
    if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) return null;
    return [ax + t * (bx - ax), ay + t * (by - ay)];
  };

  const uniq = new Set();
  for (let i = 0; i < segs.length; i += 1) {
    for (let j = i + 1; j < segs.length; j += 1) {
      const pt = intersect(segs[i][0], segs[i][1], segs[j][0], segs[j][1]);
      if (!pt) continue;
      uniq.add(nodeKey(pt));
    }
  }
  return uniq.size;
}

function extractGeoJsonFromPbf(pbfPath, boundaryPath) {
  run('osmium --version');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-osm-compare-'));
  const clippedPbf = path.join(tmpDir, 'clipped.osm.pbf');
  const highwaysPbf = path.join(tmpDir, 'highways.osm.pbf');
  const outGeoJson = path.join(tmpDir, 'highways.geojson');

  if (boundaryPath) run(`osmium extract -p ${shell(path.resolve(boundaryPath))} ${shell(path.resolve(pbfPath))} -o ${shell(clippedPbf)} --overwrite`);
  else fs.copyFileSync(path.resolve(pbfPath), clippedPbf);

  run(`osmium tags-filter ${shell(clippedPbf)} w/highway -o ${shell(highwaysPbf)} --overwrite`);
  run(`osmium export ${shell(highwaysPbf)} -o ${shell(outGeoJson)} --overwrite`);
  return { geo: readJson(outGeoJson), tempDir: tmpDir };
}

function extractGreyCount(greyArtifactPath) {
  if (!greyArtifactPath) return { value: null, note: 'not provided' };
  try {
    const j = readJson(path.resolve(greyArtifactPath));
    const candidates = [
      j.intersectionsEstimated,
      j.owenSoundRoadIntersectionProxy,
      j.grey_source_count,
      j.summary?.intersections,
      j.metrics?.intersections
    ];
    const value = candidates.find((v) => Number.isFinite(v));
    return value != null ? { value } : { value: null, note: 'no recognized intersection metric field in grey artifact' };
  } catch {
    return { value: null, note: 'unable to parse grey artifact json' };
  }
}

function toFeature(point, props) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
    properties: props
  };
}

const args = parseArgs(process.argv);
if (!args.osmPbf && !args.osmGeojson) {
  console.error('Missing OSM input. Use --osm-pbf <file> or --osm-geojson <file>.');
  process.exit(1);
}

let geo;
const warnings = [];
const metadata = {};
if (args.osmGeojson) {
  const geoPath = path.resolve(args.osmGeojson);
  if (!fs.existsSync(geoPath)) {
    console.error(`OSM geojson not found: ${geoPath}`);
    process.exit(1);
  }
  geo = readJson(geoPath);
  warnings.push('geojson input may not include OSM relation metadata');
  metadata.inputMode = 'geojson';
  metadata.inputFile = geoPath;
} else {
  const pbfPath = path.resolve(args.osmPbf);
  if (!fs.existsSync(pbfPath)) {
    console.error(`OSM pbf not found: ${pbfPath}`);
    process.exit(1);
  }
  const extracted = extractGeoJsonFromPbf(pbfPath, args.boundary || '');
  geo = extracted.geo;
  metadata.inputMode = 'pbf';
  metadata.inputFile = pbfPath;
  metadata.tempDir = extracted.tempDir;
}

const lines = featureLines(geo);
if (lines.length === 0) {
  console.error('No line features found in OSM extract.');
  process.exit(1);
}

const conservativeStats = buildModeStats(lines, 'conservative');
const inclusiveStats = buildModeStats(lines, 'inclusive');
const municipalStats = buildMunicipalThroughStreet(conservativeStats.shared);
const geomCons = segmentIntersections(lines, 'conservative');
const geomIncl = segmentIntersections(lines, 'inclusive');

const greyCount = extractGreyCount(args.greyArtifact);
const diffAbsCons = Number.isFinite(greyCount.value) ? conservativeStats.uniqueSharedRoadNodes - greyCount.value : null;
const diffPctCons = Number.isFinite(greyCount.value) && greyCount.value !== 0 ? (diffAbsCons / greyCount.value) * 100 : null;
const diffAbsIncl = Number.isFinite(greyCount.value) ? inclusiveStats.uniqueSharedRoadNodes - greyCount.value : null;
const diffPctIncl = Number.isFinite(greyCount.value) && greyCount.value !== 0 ? (diffAbsIncl / greyCount.value) * 100 : null;
const diffAbsMun = Number.isFinite(greyCount.value) ? municipalStats.count - greyCount.value : null;
const diffPctMun = Number.isFinite(greyCount.value) && greyCount.value !== 0 ? (diffAbsMun / greyCount.value) * 100 : null;

const comparison = {
  generated_at: new Date().toISOString(),
  input_files: {
    grey_artifact: args.greyArtifact ? path.resolve(args.greyArtifact) : null,
    osm_pbf: args.osmPbf ? path.resolve(args.osmPbf) : null,
    osm_geojson: args.osmGeojson ? path.resolve(args.osmGeojson) : null,
    boundary: args.boundary ? path.resolve(args.boundary) : null
  },
  grey_source_count: greyCount.value,
  grey_source_note: greyCount.note ?? null,
  osm_road_node_intersections_municipal_through_street: municipalStats.count,
  osm_road_node_intersections_conservative: conservativeStats.uniqueSharedRoadNodes,
  osm_road_node_intersections_inclusive: inclusiveStats.uniqueSharedRoadNodes,
  osm_road_geometry_crossings_conservative: geomCons,
  osm_road_geometry_crossings_inclusive: geomIncl,
  osm_cycleway_intersections: conservativeStats.cycleIntersections,
  osm_bicycle_tagged_intersections: conservativeStats.cycleIntersections,
  osm_bicycle_route_relation_intersections: null,
  difference_absolute_municipal_through_street: diffAbsMun,
  difference_percent_municipal_through_street: diffPctMun,
  difference_absolute_conservative: diffAbsCons,
  difference_percent_conservative: diffPctCons,
  difference_absolute_inclusive: diffAbsIncl,
  difference_percent_inclusive: diffPctIncl,
  caveats: [
    'Municipal-through-street excludes service roads and private/internal access classes with additional node-level filtering.',
    'Conservative excludes service roads, private/no access, and driveway/parking_aisle/alley/emergency_access service types.',
    'Inclusive includes service roads but still excludes private/no access and driveway/parking_aisle/alley/emergency_access.',
    'Cycling relation parsing is not yet implemented in this pass.',
    ...warnings
  ],
  osm_extract_metadata: metadata
};

const debug = {
  generated_at: comparison.generated_at,
  input_files: comparison.input_files,
  conservative: {
    number_of_highway_ways_included: conservativeStats.waysIncluded,
    number_of_osm_nodes_examined: conservativeStats.nodesExamined,
    number_of_unique_shared_road_nodes: conservativeStats.uniqueSharedRoadNodes,
    top_25_intersection_nodes_by_degree: conservativeStats.shared.slice(0, 25).map((n) => ({
      osm_node_id: n.key,
      lon: n.coord?.[0] ?? null,
      lat: n.coord?.[1] ?? null,
      connected_way_names: n.names,
      connected_highway_tags: n.highways,
      degree_raw: n.degreeRaw
    })),
    counts_by_highway_tag: conservativeStats.highwayTagCounts,
    excluded_highway_tag_counts: conservativeStats.excludedTagCounts,
    includes_service_roads: false,
    includes_private_or_access_restricted_roads: false,
    duplicated_way_segments_count: conservativeStats.duplicatedWaySegmentsCount
  },
  inclusive: {
    number_of_highway_ways_included: inclusiveStats.waysIncluded,
    number_of_osm_nodes_examined: inclusiveStats.nodesExamined,
    number_of_unique_shared_road_nodes: inclusiveStats.uniqueSharedRoadNodes,
    counts_by_highway_tag: inclusiveStats.highwayTagCounts,
    excluded_highway_tag_counts: inclusiveStats.excludedTagCounts,
    includes_service_roads: true,
    includes_private_or_access_restricted_roads: false,
    duplicated_way_segments_count: inclusiveStats.duplicatedWaySegmentsCount
  },
  municipal_through_street: {
    number_of_nodes_retained: municipalStats.count,
    candidate_nodes_dropped_because_same_name_continuation: municipalStats.dropCounts.same_name_continuation,
    candidate_nodes_dropped_because_dead_end_terminal: municipalStats.dropCounts.dead_end_terminal,
    candidate_nodes_dropped_because_roundabout_internal: municipalStats.dropCounts.roundabout_internal,
    candidate_nodes_dropped_because_service_private_internal: municipalStats.dropCounts.service_private_internal,
    candidate_nodes_dropped_other: municipalStats.dropCounts.other,
    top_50_retained_nodes: municipalStats.retained.slice(0, 50),
    top_50_dropped_nodes: municipalStats.dropped.slice(0, 50)
  },
  boundary_clip_rural_fringe_check: path.basename(args.boundary || '').toLowerCase().includes('owen-sound')
    ? 'boundary filename suggests Owen Sound municipal boundary'
    : 'boundary filename does not clearly indicate Owen Sound; review extent'
};

const outPath = path.resolve(args.out);
const debugPath = path.resolve(args.debugOut);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.mkdirSync(path.dirname(debugPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(comparison, null, 2)}\n`);
fs.writeFileSync(debugPath, `${JSON.stringify(debug, null, 2)}\n`);

if (args.debugGeojson) {
  const features = [];
  const add = (arr, mode, status, dropReason = null) => {
    for (const row of arr) {
      if (row.lon == null || row.lat == null) continue;
      features.push(toFeature(row, {
        mode,
        status,
        drop_reason: dropReason,
        connected_way_names: row.connected_way_names,
        connected_highway_tags: row.connected_highway_tags,
        degree_raw: row.degree_raw,
        degree_merged: row.degree_merged ?? null,
        osm_node_id: row.osm_node_id
      }));
    }
  };

  add(conservativeStats.shared.slice(0, 100000).map((n) => ({
    lon: n.coord?.[0], lat: n.coord?.[1], connected_way_names: n.names, connected_highway_tags: n.highways, degree_raw: n.degreeRaw, degree_merged: null, osm_node_id: n.key
  })), 'conservative', 'retained_conservative');

  add(inclusiveStats.shared.slice(0, 100000).map((n) => ({
    lon: n.coord?.[0], lat: n.coord?.[1], connected_way_names: n.names, connected_highway_tags: n.highways, degree_raw: n.degreeRaw, degree_merged: null, osm_node_id: n.key
  })), 'inclusive', 'retained_inclusive');

  add(municipalStats.retained, 'municipal_through_street', 'retained_municipal_through_street');

  add(municipalStats.dropped.filter((d) => d.drop_reason === 'same_name_continuation'), 'municipal_through_street', 'dropped_same_name_continuation', 'same_name_continuation');
  add(municipalStats.dropped.filter((d) => d.drop_reason === 'dead_end_terminal'), 'municipal_through_street', 'dropped_dead_end_terminal', 'dead_end_terminal');
  add(municipalStats.dropped.filter((d) => d.drop_reason === 'roundabout_internal'), 'municipal_through_street', 'dropped_roundabout_internal', 'roundabout_internal');
  add(municipalStats.dropped.filter((d) => d.drop_reason === 'service_private_internal'), 'municipal_through_street', 'dropped_service_private_internal', 'service_private_internal');

  const geojson = { type: 'FeatureCollection', features };
  const debugGeojsonPath = path.resolve(args.debugGeojson);
  fs.mkdirSync(path.dirname(debugGeojsonPath), { recursive: true });
  fs.writeFileSync(debugGeojsonPath, `${JSON.stringify(geojson, null, 2)}\n`);
}

console.log(JSON.stringify(comparison, null, 2));
