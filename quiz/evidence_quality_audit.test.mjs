import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { buildEvidenceQualityAudit } from '../program/reliability/evidence_quality_audit.mjs';
import { buildLocalCalibrationSummary } from '../program/reliability/local_calibration_intake.mjs';

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('evidence quality audit', () => {
  test('generated-only source chain cannot become article_grade and scenario claims carry caveat', () => {
    const root = path.resolve('know/produce/evidence-audit-fixture');
    const produceDir = path.join(root, 'produce');
    const qaDir = path.join(root, 'qa');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(produceDir, { recursive: true });

    writeJson(path.join(root, 'source-manifest.json'), {
      entries: [{ source_id: 's1', source_class: 'manual_curated_input', local_path: 'know/input-example/calibration/population.csv', content_hash: 'sha256:x', schema_version: '1.0', title: 'x' }]
    });
    writeJson(path.join(root, 'metric-registry.json'), {
      metrics: [{ metric_id: 'm1', allowed_statuses: ['scenario_output'], requires_method: true, requires_range: false, requires_confidence: true, requires_not_forecast_flag: true, requires_scenario_refs: true }]
    });

    writeJson(path.join(produceDir, 'grey-hormuz-food-security-article-data.json'), {
      sourceFiles: {},
      articleHeadlineFacts: ['This indicates trend-extension estimate under this assumption.'],
      headlineMetrics: [{
        metric_id: 'm1', label: 'm1', value: 1, unit: 'people', status: 'scenario_output', method: 'x', confidence: 'low', source_refs: [path.join(produceDir, 'generated.json')], scenario_refs: ['hormuz_shock_low'], not_forecast: true
      }]
    });
    writeJson(path.join(produceDir, 'grey-hormuz-food-security-article-data.md'), '# A\n- trend-extension estimate\n');
    writeJson(path.join(produceDir, 'grey-food-insecurity-trend-projection.md'), '# B\n');
    writeJson(path.join(produceDir, 'grey-current-system-shock-threshold.md'), '# C\n');
    writeJson(path.join(produceDir, 'grey-plain-english-briefing.md'), '# D\n');

    const out = buildEvidenceQualityAudit({
      produceDir,
      qaDir,
      metricRegistryPath: path.join(root, 'metric-registry.json'),
      sourceManifestPath: path.join(root, 'source-manifest.json')
    });

    expect(out.status).toBe('pass');
    const inv = JSON.parse(fs.readFileSync(path.join(qaDir, 'claim-inventory.json'), 'utf8'));
    const metricClaim = inv.claims.find((c) => c.claim_id === 'metric:m1');
    expect(metricClaim.public_use).not.toBe('article_grade');
    expect(metricClaim.caveat.toLowerCase()).toContain('not a forecast');
    expect(metricClaim).toHaveProperty('calibration_status');
    expect(Array.isArray(metricClaim.missing_calibration_refs)).toBe(true);

    fs.rmSync(root, { recursive: true, force: true });
  });

  test('risky wording is detected and headline metric inventory coverage exists', () => {
    const root = path.resolve('know/produce/evidence-audit-wording-fixture');
    const produceDir = path.join(root, 'produce');
    const qaDir = path.join(root, 'qa');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(produceDir, { recursive: true });

    writeJson(path.join(root, 'source-manifest.json'), { entries: [] });
    writeJson(path.join(root, 'metric-registry.json'), {
      metrics: [{ metric_id: 'm2', allowed_statuses: ['proxy'], requires_method: true, requires_range: false, requires_confidence: true, requires_not_forecast_flag: false, requires_scenario_refs: false }]
    });

    writeJson(path.join(produceDir, 'grey-hormuz-food-security-article-data.json'), {
      sourceFiles: {},
      articleHeadlineFacts: ['This demonstrates that something will rise.'],
      headlineMetrics: [{ metric_id: 'm2', label: 'm2', value: 2, unit: 'people', status: 'proxy', method: 'x', confidence: 'low', source_refs: ['know/input-example/calibration/population.csv'], scenario_refs: [] }]
    });
    fs.writeFileSync(path.join(produceDir, 'grey-hormuz-food-security-article-data.md'), '# X\n- will rise\n');
    fs.writeFileSync(path.join(produceDir, 'grey-food-insecurity-trend-projection.md'), '# Y\n');
    fs.writeFileSync(path.join(produceDir, 'grey-current-system-shock-threshold.md'), '# Z\n');
    fs.writeFileSync(path.join(produceDir, 'grey-plain-english-briefing.md'), '# Q\n');

    const out = buildEvidenceQualityAudit({
      produceDir,
      qaDir,
      metricRegistryPath: path.join(root, 'metric-registry.json'),
      sourceManifestPath: path.join(root, 'source-manifest.json')
    });

    expect(out.warnings.length).toBeGreaterThan(0);
    const inventory = JSON.parse(fs.readFileSync(path.join(qaDir, 'claim-inventory.json'), 'utf8'));
    expect(inventory.claims.some((c) => c.claim_id === 'metric:m2')).toBe(true);

    fs.rmSync(root, { recursive: true, force: true });
  });

  test('scenario_only calibration never upgrades and direct_local can improve readiness with strong provenance', () => {
    const root = path.resolve('know/produce/evidence-audit-calibration-quality');
    const produceDir = path.join(root, 'produce');
    const qaDir = path.join(root, 'qa');
    const inputDir = path.join(root, 'input');
    const schemaDir = path.join(root, 'schema');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(produceDir, { recursive: true });

    writeJson(path.join(root, 'source-manifest.json'), {
      entries: [
        { source_id: 'src_local', source_class: 'manual_curated_input', local_path: 'know/input-example/calibration/population.csv', content_hash: 'sha256:x', schema_version: '1.0', title: 'x' }
      ]
    });
    writeJson(path.join(root, 'metric-registry.json'), {
      metrics: [
        { metric_id: 'grey_population_baseline', allowed_statuses: ['measured'], requires_method: true, requires_range: false, requires_confidence: true, requires_not_forecast_flag: false, requires_scenario_refs: false },
        { metric_id: 'grey_food_insecurity_2027_baseline_people', allowed_statuses: ['scenario_output'], requires_method: true, requires_range: false, requires_confidence: true, requires_not_forecast_flag: true, requires_scenario_refs: true }
      ]
    });

    fs.mkdirSync(schemaDir, { recursive: true });
    writeJson(path.join(schemaDir, 'food-charity-series.schema.json'), { ok: true });
    writeJson(path.join(schemaDir, 'food-price-series.schema.json'), { ok: true });
    writeJson(path.join(schemaDir, 'rent-income-series.schema.json'), { ok: true });
    fs.mkdirSync(inputDir, { recursive: true });
    fs.writeFileSync(path.join(inputDir, 'food-charity-series.csv'), 'geography,organization_or_source,indicator,period_start,period_end,value,unit,source_ref,quality_tier,notes\nGrey,Org,visits,2026-01-01,2026-01-31,100,count,src_local,direct_local,ok\n');
    fs.writeFileSync(path.join(inputDir, 'food-price-series.csv'), 'geography,basket_or_item,indicator,period_start,period_end,value,unit,source_ref,quality_tier,notes\n');
    fs.writeFileSync(path.join(inputDir, 'rent-income-series.csv'), 'geography,indicator,period_start,period_end,value,unit,source_ref,quality_tier,notes\n');
    buildLocalCalibrationSummary({ inputDir, schemaDir, produceDir, sourceManifestPath: path.join(root, 'source-manifest.json') });

    writeJson(path.join(produceDir, 'grey-hormuz-food-security-article-data.json'), {
      sourceFiles: {},
      articleHeadlineFacts: [],
      headlineMetrics: [
        { metric_id: 'grey_population_baseline', label: 'pop', value: 100, unit: 'people', status: 'measured', method: 'x', confidence: 'high', source_refs: ['know/input-example/calibration/population.csv'], scenario_refs: [], not_forecast: false },
        { metric_id: 'grey_food_insecurity_2027_baseline_people', label: 'fi', value: 10, unit: 'people', status: 'scenario_output', method: 'x', confidence: 'low', source_refs: ['know/input-example/calibration/population.csv'], scenario_refs: ['baseline'], not_forecast: true }
      ]
    });
    writeJson(path.join(produceDir, 'grey-hormuz-food-security-article-data.md'), {});
    fs.writeFileSync(path.join(produceDir, 'grey-food-insecurity-trend-projection.md'), '# Y\n');
    fs.writeFileSync(path.join(produceDir, 'grey-current-system-shock-threshold.md'), '# Z\n');
    fs.writeFileSync(path.join(produceDir, 'grey-plain-english-briefing.md'), '# Q\n');

    const out = buildEvidenceQualityAudit({
      produceDir,
      qaDir,
      metricRegistryPath: path.join(root, 'metric-registry.json'),
      sourceManifestPath: path.join(root, 'source-manifest.json')
    });
    expect(out.status).toBe('pass');
    const inv = JSON.parse(fs.readFileSync(path.join(qaDir, 'claim-inventory.json'), 'utf8'));
    const pop = inv.claims.find((c) => c.claim_id === 'metric:grey_population_baseline');
    expect(pop.public_use).toBe('article_grade');
    const fi = inv.claims.find((c) => c.claim_id === 'metric:grey_food_insecurity_2027_baseline_people');
    expect(fi.public_use).not.toBe('article_grade');
  });

  test('provincial_proxy calibration does not upgrade scenario claim to article_grade', () => {
    const root = path.resolve('know/produce/evidence-audit-provincial-proxy');
    const produceDir = path.join(root, 'produce');
    const qaDir = path.join(root, 'qa');
    const inputDir = path.join(root, 'input');
    const schemaDir = path.join(root, 'schema');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(produceDir, { recursive: true });

    writeJson(path.join(root, 'source-manifest.json'), {
      entries: [{ source_id: 'src_prov', source_class: 'external_snapshot', local_path: 'know/input-example/calibration/population.csv', content_hash: 'sha256:x', schema_version: '1.0', title: 'x' }]
    });
    writeJson(path.join(root, 'metric-registry.json'), {
      metrics: [{ metric_id: 'grey_food_insecurity_2027_baseline_people', allowed_statuses: ['scenario_output'], requires_method: true, requires_range: false, requires_confidence: true, requires_not_forecast_flag: true, requires_scenario_refs: true }]
    });
    fs.mkdirSync(schemaDir, { recursive: true });
    writeJson(path.join(schemaDir, 'food-charity-series.schema.json'), { ok: true });
    writeJson(path.join(schemaDir, 'food-price-series.schema.json'), { ok: true });
    writeJson(path.join(schemaDir, 'rent-income-series.schema.json'), { ok: true });
    fs.mkdirSync(inputDir, { recursive: true });
    fs.writeFileSync(path.join(inputDir, 'food-charity-series.csv'), 'geography,organization_or_source,indicator,period_start,period_end,value,unit,source_ref,quality_tier,notes\nOntario,Feed,visits,2026-01-01,2026-01-31,100,count,src_prov,provincial_proxy,ok\n');
    fs.writeFileSync(path.join(inputDir, 'food-price-series.csv'), 'geography,basket_or_item,indicator,period_start,period_end,value,unit,source_ref,quality_tier,notes\nOntario,basket,percent_change,2026-01-01,2026-01-31,1.0,percent,src_prov,provincial_proxy,ok\n');
    fs.writeFileSync(path.join(inputDir, 'rent-income-series.csv'), 'geography,indicator,period_start,period_end,value,unit,source_ref,quality_tier,notes\nOntario,minimum_wage_hourly,2026-01-01,2026-01-31,17.6,CAD/hour,src_prov,provincial_proxy,ok\n');
    buildLocalCalibrationSummary({ inputDir, schemaDir, produceDir, sourceManifestPath: path.join(root, 'source-manifest.json') });

    writeJson(path.join(produceDir, 'grey-hormuz-food-security-article-data.json'), {
      sourceFiles: {},
      articleHeadlineFacts: [],
      headlineMetrics: [{
        metric_id: 'grey_food_insecurity_2027_baseline_people',
        label: 'fi',
        value: 200,
        unit: 'people',
        status: 'scenario_output',
        method: 'x',
        confidence: 'moderate',
        source_refs: ['know/input-example/calibration/population.csv'],
        scenario_refs: ['baseline'],
        not_forecast: true
      }]
    });
    fs.writeFileSync(path.join(produceDir, 'grey-hormuz-food-security-article-data.md'), '# X\n');
    fs.writeFileSync(path.join(produceDir, 'grey-food-insecurity-trend-projection.md'), '# Y\n');
    fs.writeFileSync(path.join(produceDir, 'grey-current-system-shock-threshold.md'), '# Z\n');
    fs.writeFileSync(path.join(produceDir, 'grey-plain-english-briefing.md'), '# Q\n');

    const out = buildEvidenceQualityAudit({
      produceDir,
      qaDir,
      metricRegistryPath: path.join(root, 'metric-registry.json'),
      sourceManifestPath: path.join(root, 'source-manifest.json')
    });
    expect(out.status).toBe('pass');
    const inv = JSON.parse(fs.readFileSync(path.join(qaDir, 'claim-inventory.json'), 'utf8'));
    const claim = inv.claims.find((c) => c.claim_id === 'metric:grey_food_insecurity_2027_baseline_people');
    expect(claim.calibration_quality).toBe('provincial_proxy');
    expect(claim.public_use).not.toBe('article_grade');
  });

  test('generated-only or no-groundtruth land data cannot upgrade land-access claim', () => {
    const root = path.resolve('know/produce/evidence-audit-land-groundtruth-none');
    const produceDir = path.join(root, 'produce');
    const qaDir = path.join(root, 'qa');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(produceDir, { recursive: true });

    writeJson(path.join(root, 'source-manifest.json'), { entries: [] });
    writeJson(path.join(root, 'metric-registry.json'), {
      metrics: [{ metric_id: 'grey_no_meaningful_food_growing_land_access_population', allowed_statuses: ['proxy'], requires_method: true, requires_range: false, requires_confidence: true, requires_not_forecast_flag: false, requires_scenario_refs: false }]
    });
    writeJson(path.join(produceDir, 'land-access-groundtruth-summary.json'), {
      landAccessGroundtruthStatus: 'no_groundtruth',
      inferred_only_linkage: true,
      all_linkage_rows_source_backed: false,
      limitations: ['No source-backed linkage loaded.']
    });
    writeJson(path.join(produceDir, 'grey-hormuz-food-security-article-data.json'), {
      sourceFiles: {},
      articleHeadlineFacts: [],
      headlineMetrics: [{
        metric_id: 'grey_no_meaningful_food_growing_land_access_population',
        label: 'land',
        value: 1000,
        unit: 'people',
        status: 'proxy',
        method: 'x',
        confidence: 'low',
        source_refs: ['know/produce/derived.json'],
        scenario_refs: []
      }]
    });
    fs.writeFileSync(path.join(produceDir, 'grey-hormuz-food-security-article-data.md'), '# X\n');
    fs.writeFileSync(path.join(produceDir, 'grey-food-insecurity-trend-projection.md'), '# Y\n');
    fs.writeFileSync(path.join(produceDir, 'grey-current-system-shock-threshold.md'), '# Z\n');
    fs.writeFileSync(path.join(produceDir, 'grey-plain-english-briefing.md'), '# Q\n');

    const out = buildEvidenceQualityAudit({
      produceDir,
      qaDir,
      metricRegistryPath: path.join(root, 'metric-registry.json'),
      sourceManifestPath: path.join(root, 'source-manifest.json')
    });
    expect(out.status).toBe('pass');
    const inv = JSON.parse(fs.readFileSync(path.join(qaDir, 'claim-inventory.json'), 'utf8'));
    const claim = inv.claims.find((c) => c.claim_id === 'metric:grey_no_meaningful_food_growing_land_access_population');
    expect(claim.land_access_groundtruth_status).toBe('no_groundtruth');
    expect(claim.evidence_basis).toContain('lot_fabric_proxy');
    expect(claim.public_use).toBe('exploratory_only');
  });

  test('direct_local source-backed linked parcels can set direct_groundtruth status in fixture', () => {
    const root = path.resolve('know/produce/evidence-audit-land-groundtruth-direct');
    const produceDir = path.join(root, 'produce');
    const qaDir = path.join(root, 'qa');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(produceDir, { recursive: true });

    writeJson(path.join(root, 'source-manifest.json'), {
      entries: [{ source_id: 'src_land', source_class: 'manual_curated_input', local_path: 'know/source/local-calibration/land.csv', content_hash: 'sha256:x', schema_version: '1.0', title: 'land source' }]
    });
    writeJson(path.join(root, 'metric-registry.json'), {
      metrics: [{ metric_id: 'grey_no_meaningful_food_growing_land_access_population', allowed_statuses: ['proxy'], requires_method: true, requires_range: false, requires_confidence: true, requires_not_forecast_flag: false, requires_scenario_refs: false }]
    });
    writeJson(path.join(produceDir, 'land-access-groundtruth-summary.json'), {
      landAccessGroundtruthStatus: 'direct_groundtruth',
      inferred_only_linkage: false,
      all_linkage_rows_source_backed: true,
      limitations: []
    });
    writeJson(path.join(produceDir, 'grey-hormuz-food-security-article-data.json'), {
      sourceFiles: {},
      articleHeadlineFacts: [],
      headlineMetrics: [{
        metric_id: 'grey_no_meaningful_food_growing_land_access_population',
        label: 'land',
        value: 1000,
        unit: 'people',
        status: 'proxy',
        method: 'x',
        confidence: 'moderate',
        source_refs: ['know/source/local-calibration/land.csv'],
        scenario_refs: []
      }]
    });
    fs.writeFileSync(path.join(produceDir, 'grey-hormuz-food-security-article-data.md'), '# X\n');
    fs.writeFileSync(path.join(produceDir, 'grey-food-insecurity-trend-projection.md'), '# Y\n');
    fs.writeFileSync(path.join(produceDir, 'grey-current-system-shock-threshold.md'), '# Z\n');
    fs.writeFileSync(path.join(produceDir, 'grey-plain-english-briefing.md'), '# Q\n');

    const out = buildEvidenceQualityAudit({
      produceDir,
      qaDir,
      metricRegistryPath: path.join(root, 'metric-registry.json'),
      sourceManifestPath: path.join(root, 'source-manifest.json')
    });
    expect(out.status).toBe('pass');
    const inv = JSON.parse(fs.readFileSync(path.join(qaDir, 'claim-inventory.json'), 'utf8'));
    const claim = inv.claims.find((c) => c.claim_id === 'metric:grey_no_meaningful_food_growing_land_access_population');
    expect(claim.land_access_groundtruth_status).toBe('direct_groundtruth');
    expect(['article_with_caveat', 'exploratory_only']).toContain(claim.public_use);
  });

  test('partial_groundtruth land-access remains caveated/exploratory without address-building linkage', () => {
    const root = path.resolve('know/produce/evidence-audit-land-groundtruth-partial');
    const produceDir = path.join(root, 'produce');
    const qaDir = path.join(root, 'qa');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(produceDir, { recursive: true });

    writeJson(path.join(root, 'source-manifest.json'), {
      entries: [{ source_id: 'src_land', source_class: 'external_snapshot', local_path: 'know/input/gis/lots-and-concessions-grey.geojson', content_hash: 'sha256:x', schema_version: '1.0', title: 'land source' }]
    });
    writeJson(path.join(root, 'metric-registry.json'), {
      metrics: [{ metric_id: 'grey_no_meaningful_food_growing_land_access_population', allowed_statuses: ['proxy'], requires_method: true, requires_range: false, requires_confidence: true, requires_not_forecast_flag: false, requires_scenario_refs: false }]
    });
    writeJson(path.join(produceDir, 'land-access-groundtruth-summary.json'), {
      landAccessGroundtruthStatus: 'partial_groundtruth',
      inferred_only_linkage: false,
      all_linkage_rows_source_backed: true,
      limitations: ['No address/building linkage']
    });
    writeJson(path.join(produceDir, 'grey-hormuz-food-security-article-data.json'), {
      sourceFiles: {},
      articleHeadlineFacts: [],
      headlineMetrics: [{
        metric_id: 'grey_no_meaningful_food_growing_land_access_population',
        label: 'land',
        value: 1000,
        unit: 'people',
        status: 'proxy',
        method: 'x',
        confidence: 'low',
        source_refs: ['know/input/gis/lots-and-concessions-grey.geojson'],
        scenario_refs: []
      }]
    });
    fs.writeFileSync(path.join(produceDir, 'grey-hormuz-food-security-article-data.md'), '# X\n');
    fs.writeFileSync(path.join(produceDir, 'grey-food-insecurity-trend-projection.md'), '# Y\n');
    fs.writeFileSync(path.join(produceDir, 'grey-current-system-shock-threshold.md'), '# Z\n');
    fs.writeFileSync(path.join(produceDir, 'grey-plain-english-briefing.md'), '# Q\n');

    const out = buildEvidenceQualityAudit({
      produceDir,
      qaDir,
      metricRegistryPath: path.join(root, 'metric-registry.json'),
      sourceManifestPath: path.join(root, 'source-manifest.json')
    });
    expect(out.status).toBe('pass');
    const inv = JSON.parse(fs.readFileSync(path.join(qaDir, 'claim-inventory.json'), 'utf8'));
    const claim = inv.claims.find((c) => c.claim_id === 'metric:grey_no_meaningful_food_growing_land_access_population');
    expect(claim.land_access_groundtruth_status).toBe('partial_groundtruth');
    expect(claim.public_use).toBe('exploratory_only');
  });
});
