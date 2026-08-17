import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPlantDatabase} from '../src/plant-database.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(packageRoot, 'data/source/agroecosystem-plants.json');
const derivedPath = path.join(packageRoot, 'data/derived/plant-database.json');
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const database = buildPlantDatabase(source);
const output = {
  ...database,
  generated_from: 'data/source/agroecosystem-plants.json',
  generated_at: process.env.SOURCE_DATE ?? new Date().toISOString()
};
await mkdir(path.dirname(derivedPath), {recursive: true});
await writeFile(derivedPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Validated ${database.records.length} plant records and wrote ${derivedPath}`);
