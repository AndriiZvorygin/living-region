import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPlantDatabase, validatePlantDatabase} from '../src/plant-database.mjs';

const source = JSON.parse(await readFile(new URL('../data/source/agroecosystem-plants.json', import.meta.url)));

test('source agroecosystem database validates and preserves unresolved evidence', () => {
  const database = buildPlantDatabase(source);
  assert.equal(database.records.length, 17);
  assert.equal(new Set(database.records.map((record) => record.id)).size, database.records.length);
  assert.equal(database.records.find((record) => record.id === 'perennial_black_walnut').outputs[0].yield.central, null);
  assert.equal(database.records.find((record) => record.id === 'support_honey_locust').evidence.proxy.factor.central, 0.5);
});

test('malformed or duplicate plant records are rejected before generation', () => {
  const duplicate = {...source, records: [...source.records, source.records[0]]};
  const result = validatePlantDatabase(duplicate);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('duplicate plant id')));

  const invalid = {...source, records: source.records.map((record, index) => index === 0 ? {
    ...record,
    outputs: [{...record.outputs[0], yield: {unit: 'kg_per_ha_year', low: 4, central: 2, high: 1}}]
  } : record)};
  assert.equal(validatePlantDatabase(invalid).valid, false);
});

test('unknown output values remain unknown rather than becoming zero', () => {
  const database = buildPlantDatabase(source);
  const walnut = database.records.find((record) => record.id === 'perennial_black_walnut');
  assert.equal(walnut.outputs[0].yield.low, null);
  assert.equal(walnut.outputs[0].yield.central, null);
  assert.equal(walnut.evidence.source_class, 'reference_only');
});
