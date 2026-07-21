import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { distanceMetres, type GeoCollection, type Position, type StreetGraph } from "./index";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse/lib/pdf-parse.js") as (buffer: Buffer, options?: Record<string, unknown>) => Promise<{ text: string }>;

export type TrafficCount = {
  count_id: string;
  street_1: string;
  street_2: string;
  approach: "north" | "south" | "east" | "west";
  aadt_2016: number;
  aadt_2006: number | null;
  truck_percent: number | null;
  truck_percent_provisional: true;
  observed_count_year: 2016;
  measure_type: "aadt";
  source_id: "owen_sound_2016_aadt";
  source_confidence: "official_historical_measured";
  age_warning: string;
  raw_text: string;
};

const headerNoise = /^(Street 1|Col|um|n1|Street 2Location|Total|Volume|Change|%|Trucks|\s*)$/;

function number(value: string): number | null {
  if (/n\/a/i.test(value)) return null;
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseAadtText(text: string): { records: TrafficCount[]; warnings: string[] } {
  const records: TrafficCount[] = [];
  const warnings: string[] = [];
  for (const raw of text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !headerNoise.test(line))) {
    if (/^587,724/.test(raw)) continue;
    const match = raw.match(/^(.+?)\s*&\s*(.+?)(North|South|East|West) Leg(.+)$/i);
    if (!match) continue;
    const values = match[4].match(/n\/a|-?[\d,]+(?:\.\d+)?%?/gi) ?? [];
    if (values.length < 2) {
      warnings.push(`Unable to parse values: ${raw}`);
      continue;
    }
    const aadt2016 = number(values[0]!);
    if (aadt2016 == null) {
      warnings.push(`Missing 2016 AADT: ${raw}`);
      continue;
    }
    const truckToken = values.at(-1) ?? "n/a";
    const truck = truckToken.endsWith("%") ? number(truckToken.slice(0, -1)) : null;
    const street1 = match[1].trim();
    const street2 = match[2].trim();
    const approach = match[3].toLowerCase() as TrafficCount["approach"];
    records.push({
      count_id: `aadt-2016-${records.length + 1}`,
      street_1: street1,
      street_2: street2,
      approach,
      aadt_2016: aadt2016,
      aadt_2006: number(values[1]),
      truck_percent: truck,
      truck_percent_provisional: true,
      observed_count_year: 2016,
      measure_type: "aadt",
      source_id: "owen_sound_2016_aadt",
      source_confidence: "official_historical_measured",
      age_warning: "Historical 2016 count; no inflation factor applied.",
      raw_text: raw
    });
  }
  if (records.length !== 126) warnings.push(`Expected 126 station legs; parsed ${records.length}.`);
  return { records, warnings };
}

export async function parseAadtPdf(path: string) {
  const parsed = await pdf(await readFile(path), { pagerender: async (page: any) => {
    const content = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
    const rows = new Map<number, Array<{ x: number; text: string }>>();
    for (const item of content.items as Array<{ str: string; transform: number[] }>) {
      const y = Math.round(item.transform[5] * 2) / 2;
      const row = rows.get(y) ?? [];
      row.push({ x: item.transform[4], text: item.str });
      rows.set(y, row);
    }
    return [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, row]) => row.sort((a, b) => a.x - b.x).map((item) => item.text).join(" ")).join("\n");
  } });
  return parseAadtText(parsed.text);
}

function normalizeStreet(value: string): string {
  return value.toLowerCase()
    .replace(/(\d+)(st|nd|rd|th)\b/g, "$1")
    .replace(/\bavenue\b|\bave\b/g, "av")
    .replace(/\bstreet\b|\bst\b/g, "st")
    .replace(/\broad\b|\brd\b/g, "rd")
    .replace(/\s+/g, " ").trim();
}

function bearing(graph: StreetGraph, edgeId: number): number {
  const edge = graph.edges[edgeId];
  const from = graph.nodes[edge.from];
  const to = graph.nodes[edge.to];
  return (Math.atan2(to.x_m - from.x_m, to.y_m - from.y_m) * 180 / Math.PI + 360) % 360;
}

function directionDifference(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

export function matchAadtToGraph(records: TrafficCount[], graph: StreetGraph): { geojson: GeoCollection; matched_edge_counts: Map<number, TrafficCount>; warnings: string[] } {
  const desired = { north: 0, east: 90, south: 180, west: 270 };
  const warnings: string[] = [];
  const matched = new Map<number, TrafficCount>();
  const features: GeoCollection["features"] = [];
  for (const record of records) {
    const s1 = normalizeStreet(record.street_1);
    const s2 = normalizeStreet(record.street_2);
    const candidates = graph.nodes.filter((node) => {
      const names = new Set(node.edges.map((id) => normalizeStreet(graph.edges[id].road_name)));
      return names.has(s1) && names.has(s2);
    });
    if (!candidates.length) {
      warnings.push(`${record.count_id}: unmatched intersection ${record.street_1} & ${record.street_2}`);
      continue;
    }
    const node = candidates[0];
    const outgoing = node.edges
      .map((id) => ({ edge: graph.edges[id], difference: directionDifference(bearing(graph, id), desired[record.approach]) }))
      .filter((item) => item.difference <= 55)
      .sort((a, b) => a.difference - b.difference);
    const selected = outgoing[0]?.edge;
    if (!selected) {
      warnings.push(`${record.count_id}: intersection found but ${record.approach} leg unmatched`);
      continue;
    }
    const prior = matched.get(selected.id);
    if (!prior || record.observed_count_year >= prior.observed_count_year) matched.set(selected.id, record);
    const intersection: Position = [node.lon, node.lat];
    features.push({ type: "Feature", properties: { ...record, match_confidence: "measured_local", matched_edge_id: selected.id, intersection_snap_m: 0 }, geometry: { type: "LineString", coordinates: [intersection, selected.coordinates.at(-1) as Position] } });
  }
  return { geojson: { type: "FeatureCollection", features }, matched_edge_counts: matched, warnings };
}

export function newerStudyLocations(): GeoCollection {
  const studies = [
    ["tis-2024-16th-16th", "16th Avenue East & 16th Street East", -80.9129, 44.5742],
    ["tis-2024-16th-17th", "16th Avenue East & 17th Street East", -80.9119, 44.5761],
    ["tis-2024-heritage-drive", "16th Avenue East & Heritage Place driveway", -80.9112, 44.5781]
  ];
  return { type: "FeatureCollection", features: studies.map(([id, name, lon, lat]) => ({ type: "Feature", properties: { id, name, measure_type: "am_pm_turning_count", observed_count_date: "2024-09-12", observed_count_year: 2024, source_id: "owen_sound_1750_16th_avenue_e_tis_2024", source_confidence: "official_study_observed", parsing_status: "location_ingested_turn_movements_pending_structured_transcription", forecast_volume: null }, geometry: { type: "Point", coordinates: [lon, lat] } })) };
}
