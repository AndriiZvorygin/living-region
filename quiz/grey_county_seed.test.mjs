import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { greyCountySeedNodes } from '../program/data/grey_county_seed_nodes.mjs';
import { greyCountyExpectedTotals, summarizeGreyCountySeedNodes, validateGreyCountySeedTotals } from '../program/data/grey_county_census_summary.mjs';
import { generateGreyCountyWorld } from '../program/data/generate_grey_county_world.mjs';
import { createWorld } from '../program/model/world.mjs';

function municipalitySummary(world) {
  return new Map((world.seedMeta?.municipalities ?? []).map((row) => [row.municipalityId, row]));
}

describe('grey county seed world census scaling', () => {
  test('grey seed node population totals sum to 100905', () => {
    const summary = summarizeGreyCountySeedNodes(greyCountySeedNodes);
    expect(summary.population2021).toBe(greyCountyExpectedTotals.population2021);
  });

  test('grey seed node land area totals approximately 4497.93 km2', () => {
    const summary = summarizeGreyCountySeedNodes(greyCountySeedNodes);
    expect(Math.abs(summary.landAreaKm2 - greyCountyExpectedTotals.landAreaKm2)).toBeLessThan(0.05);
  });

  test('each density value roughly equals population/land area', () => {
    for (const node of greyCountySeedNodes) {
      const derived = node.population2021 / node.landAreaKm2;
      expect(Math.abs(derived - node.densityPerKm2)).toBeLessThan(1);
    }
  });

  test('seed nodes pass census consistency validator', () => {
    const check = validateGreyCountySeedTotals(greyCountySeedNodes);
    expect(check.valid).toBe(true);
    expect(check.errors.length).toBe(0);
  });

  test('generator creates deterministic world', () => {
    const worldA = generateGreyCountyWorld({ scale: 'small', includeRail: true, includeWaterFreight: true });
    const worldB = generateGreyCountyWorld({ scale: 'small', includeRail: true, includeWaterFreight: true });
    expect(JSON.stringify(worldA)).toBe(JSON.stringify(worldB));
  });

  test('generated world validates', () => {
    const world = generateGreyCountyWorld({ scale: 'tiny' });
    expect(() => createWorld(world)).not.toThrow();
  });

  test('road network lengthKm is positive', () => {
    const world = generateGreyCountyWorld({ scale: 'small' });
    const roadNetwork = world.networks.find((network) => network.id === 'network-grey-roads');
    expect(roadNetwork).toBeTruthy();
    for (const segment of roadNetwork.segments) {
      expect(segment.lengthKm).toBeGreaterThan(0);
    }
  });

  test('full-county seed population equals expected total within tolerance', () => {
    const world = generateGreyCountyWorld({ scale: 'full-county' });
    const summary = world.seedMeta.summary;
    expect(Math.abs(summary.syntheticPopulation - 100905)).toBeLessThanOrEqual(5);
  });

  test('full-county seed area equals expected area within tolerance', () => {
    const world = generateGreyCountyWorld({ scale: 'full-county' });
    const summary = world.seedMeta.summary;
    expect(Math.abs(summary.totalSyntheticPatchAreaHa - 449793)).toBeLessThan(1);
  });

  test('small medium county-lite full scales monotonically increase population and area', () => {
    const small = generateGreyCountyWorld({ scale: 'small' }).seedMeta.summary;
    const medium = generateGreyCountyWorld({ scale: 'medium' }).seedMeta.summary;
    const countyLite = generateGreyCountyWorld({ scale: 'county-lite' }).seedMeta.summary;
    const full = generateGreyCountyWorld({ scale: 'full-county' }).seedMeta.summary;

    expect(small.syntheticPopulation).toBeLessThan(medium.syntheticPopulation);
    expect(medium.syntheticPopulation).toBeLessThan(countyLite.syntheticPopulation);
    expect(countyLite.syntheticPopulation).toBeLessThan(full.syntheticPopulation);

    expect(small.totalSyntheticPatchAreaHa).toBeLessThan(medium.totalSyntheticPatchAreaHa);
    expect(medium.totalSyntheticPatchAreaHa).toBeLessThan(countyLite.totalSyntheticPatchAreaHa);
    expect(countyLite.totalSyntheticPatchAreaHa).toBeLessThan(full.totalSyntheticPatchAreaHa);
  });

  test('dwelling units exceed households for each municipality', () => {
    const world = generateGreyCountyWorld({ scale: 'medium' });
    for (const row of world.seedMeta.municipalities) {
      expect(row.generatedDwellingUnits).toBeGreaterThanOrEqual(row.generatedHouseholds);
    }
  });

  test('high-density municipalities allocate more settlement/residential share than low-density ones', () => {
    const world = generateGreyCountyWorld({ scale: 'full-county' });
    const summary = municipalitySummary(world);

    const owen = summary.get('owen-sound');
    const hanover = summary.get('hanover');
    const chatsworth = summary.get('chatsworth');
    const greyHighlands = summary.get('grey-highlands');

    const owenShare = owen.settlementPatchAreaHa / owen.scaledAreaHa;
    const hanoverShare = hanover.settlementPatchAreaHa / hanover.scaledAreaHa;
    const chatsworthShare = chatsworth.settlementPatchAreaHa / chatsworth.scaledAreaHa;
    const greyShare = greyHighlands.settlementPatchAreaHa / greyHighlands.scaledAreaHa;

    expect(owenShare).toBeGreaterThan(chatsworthShare);
    expect(hanoverShare).toBeGreaterThan(greyShare);
  });

  test('full rail seed derives station catchment from scaled municipality population', () => {
    const world = generateGreyCountyWorld({ scale: 'full-county', includeRail: true });
    const station = world.infrastructures.find((item) => item.id === 'infra-owen-sound-rail-station');
    const muni = world.seedMeta.municipalities.find((row) => row.municipalityId === 'owen-sound');

    expect(station).toBeTruthy();
    expect(muni).toBeTruthy();
    const catchment = (station.walkCatchmentPeople ?? 0) + (station.bicycleCatchmentPeople ?? 0) + (station.parkAndRideCatchmentPeople ?? 0);
    expect(catchment).toBeGreaterThan(0);
    expect(catchment).toBeLessThanOrEqual(muni.scaledPopulation * 1.1);
  });

  test('municipal summary CSV writes expected columns', () => {
    const result = spawnSync('node', ['command/generate_grey_county_seed.mjs', '--scale=small'], { encoding: 'utf8' });
    expect(result.status).toBe(0);

    const csvPath = path.resolve('know/produce/grey-county-seed-municipal-summary.csv');
    expect(fs.existsSync(csvPath)).toBe(true);
    const header = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/)[0];

    expect(header).toContain('municipalityId');
    expect(header).toContain('population2021');
    expect(header).toContain('scaledPopulation');
    expect(header).toContain('roadKm');
    expect(header).toContain('railKm');
  });

  test('full-county commands run successfully', () => {
    const seed = spawnSync('node', ['command/generate_grey_county_seed.mjs', '--scale=full-county', '--rail=true', '--water=true'], { encoding: 'utf8' });
    const demo = spawnSync('node', ['command/run_grey_county_seed.mjs', '--scale=full-county'], { encoding: 'utf8' });
    const demoRail = spawnSync('node', ['command/run_grey_county_seed.mjs', '--scale=full-county', '--rail=true'], { encoding: 'utf8' });

    expect(seed.status).toBe(0);
    expect(demo.status).toBe(0);
    expect(demoRail.status).toBe(0);
  });
});
