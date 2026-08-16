import fs from 'node:fs';
import path from 'node:path';
import {ARC_LAND_MARKET_CONTRACT_VERSION, loadArcLandMarketData, normalizeLandObservation, parseLandObservationCsv} from '../packages/carrying-capacity/src/index.mjs';

const input = process.argv.slice(2).find((arg) => arg.startsWith('--input='))?.split('=').slice(1).join('=') ?? process.argv[2];
if (!input) throw new Error('Usage: node command/import_arc_land_observations.mjs --input=observations.csv [--output=path.json]');
const output = process.argv.slice(2).find((arg) => arg.startsWith('--output='))?.split('=').slice(1).join('=') ?? 'packages/carrying-capacity/data/source/arc-land-market-observations.json';
const text = fs.readFileSync(path.resolve(input), 'utf8');
const imported = input.toLowerCase().endsWith('.json')
  ? JSON.parse(text).map(normalizeLandObservation)
  : parseLandObservationCsv(text);
const current = loadArcLandMarketData();
const merged = [...current.observations, ...imported].filter((row, index, rows) => row.observation_id == null || rows.findIndex((candidate) => candidate.observation_id === row.observation_id) === index);
fs.mkdirSync(path.dirname(path.resolve(output)), {recursive: true});
fs.writeFileSync(path.resolve(output), JSON.stringify({...current, contract_version: ARC_LAND_MARKET_CONTRACT_VERSION, observations: merged, imported_at: new Date().toISOString(), import_source: path.resolve(input)}, null, 2) + '\n');
console.log(`Imported ${imported.length} observation(s); wrote ${merged.length} total observation(s) to ${path.resolve(output)}`);
