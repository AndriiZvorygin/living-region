import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { buildLocalCalibrationSummary } from '../program/reliability/local_calibration_intake.mjs';
import { buildEvidenceQualityAudit } from '../program/reliability/evidence_quality_audit.mjs';

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function writeJson(filePath, obj) {
  write(filePath, JSON.stringify(obj, null, 2));
}

function setupSchemas(base) {
  const schemaDir = path.join(base, 'schema');
  writeJson(path.join(schemaDir, 'food-charity-series.schema.json'), { ok: true });
  writeJson(path.join(schemaDir, 'food-price-series.schema.json'), { ok: true });
  writeJson(path.join(schemaDir, 'rent-income-series.schema.json'), { ok: true });
  return schemaDir;
}

describe('local calibration intake contracts', () => {
  test('missing source_ref fails validation', () => {
    const root = path.resolve('know/produce/calibration-fixture-missing-source');
    fs.rmSync(root, { recursive: true, force: true });
    const inputDir = path.join(root, 'input');
    const schemaDir = setupSchemas(root);
    const produceDir = path.join(root, 'produce');
    write(path.join(inputDir, 'food-charity-series.csv'), 'geography,organization_or_source,indicator,period_start,period_end,value,unit,source_ref,notes\nGrey,Org,visits,2026-01-01,2026-01-31,100,count,,missing source ref\n');
    write(path.join(inputDir, 'food-price-series.csv'), 'geography,basket_or_item,indicator,period_start,period_end,value,unit,source_ref,notes\n');
    write(path.join(inputDir, 'rent-income-series.csv'), 'geography,indicator,period_start,period_end,value,unit,source_ref,notes\n');
    writeJson(path.join(root, 'source-manifest.json'), { entries: [] });

    const out = buildLocalCalibrationSummary({ inputDir, schemaDir, produceDir, sourceManifestPath: path.join(root, 'source-manifest.json') });
    expect(out.status).toBe('fail');
    expect(out.failures.some((f) => f.includes('source_ref required'))).toBe(true);
  });

  test('mixed CPI/currency/percent food price families are blocked from aggregation', () => {
    const root = path.resolve('know/produce/calibration-fixture-mixed-price');
    fs.rmSync(root, { recursive: true, force: true });
    const inputDir = path.join(root, 'input');
    const schemaDir = setupSchemas(root);
    const produceDir = path.join(root, 'produce');
    write(path.join(inputDir, 'food-charity-series.csv'), 'geography,organization_or_source,indicator,period_start,period_end,value,unit,source_ref,notes\n');
    write(path.join(inputDir, 'food-price-series.csv'), [
      'geography,basket_or_item,indicator,period_start,period_end,value,unit,source_ref,notes',
      'Ontario,basket,nutritious_food_basket_monthly_cost,2026-01-01,2026-01-31,400,$,src_food_price,ok',
      'Ontario,index,food_cpi_index,2026-01-01,2026-01-31,150,index,src_food_price,ok',
      'Ontario,delta,percent_change,2026-01-01,2026-01-31,4.2,%,src_food_price,ok'
    ].join('\n'));
    write(path.join(inputDir, 'rent-income-series.csv'), 'geography,indicator,period_start,period_end,value,unit,source_ref,notes\n');
    writeJson(path.join(root, 'source-manifest.json'), { entries: [{ source_id: 'src_food_price', local_path: 'x', source_class: 'manual_curated_input' }] });

    const out = buildLocalCalibrationSummary({ inputDir, schemaDir, produceDir, sourceManifestPath: path.join(root, 'source-manifest.json') });
    expect(out.status).toBe('fail');
    expect(out.failures.some((w) => w.includes('multiple unit families'))).toBe(true);
  });

  test('summary emits limitations and claim inventory marks uncalibrated claims', () => {
    const root = path.resolve('know/produce/calibration-fixture-claims');
    fs.rmSync(root, { recursive: true, force: true });
    const inputDir = path.join(root, 'input');
    const schemaDir = setupSchemas(root);
    const produceDir = path.join(root, 'produce');
    const qaDir = path.join(root, 'qa');

    write(path.join(inputDir, 'food-charity-series.csv'), 'geography,organization_or_source,indicator,period_start,period_end,value,unit,source_ref,notes\n');
    write(path.join(inputDir, 'food-price-series.csv'), 'geography,basket_or_item,indicator,period_start,period_end,value,unit,source_ref,notes\n');
    write(path.join(inputDir, 'rent-income-series.csv'), 'geography,indicator,period_start,period_end,value,unit,source_ref,notes\n');
    writeJson(path.join(root, 'source-manifest.json'), { entries: [] });

    const calibration = buildLocalCalibrationSummary({ inputDir, schemaDir, produceDir, sourceManifestPath: path.join(root, 'source-manifest.json') });
    expect(calibration.status).toBe('pass');
    expect(calibration.summary.categories.food_charity.limitations.length).toBeGreaterThan(0);

    writeJson(path.join(root, 'metric-registry.json'), {
      metrics: [
        { metric_id: 'grey_food_insecurity_2027_baseline_people', allowed_statuses: ['scenario_output'], requires_method: true, requires_range: true, requires_confidence: true, requires_not_forecast_flag: true, requires_scenario_refs: true }
      ]
    });
    writeJson(path.join(produceDir, 'grey-hormuz-food-security-article-data.json'), {
      headlineMetrics: [
        {
          metric_id: 'grey_food_insecurity_2027_baseline_people',
          label: 'x',
          value: 123,
          unit: 'people',
          status: 'scenario_output',
          method: 'x',
          range: { low: 100, high: 150, unit: 'people' },
          confidence: 'low',
          source_refs: ['know/produce/synthetic.json'],
          scenario_refs: ['baseline'],
          not_forecast: true
        }
      ],
      articleHeadlineFacts: [],
      sourceFiles: {}
    });
    write(path.join(produceDir, 'grey-hormuz-food-security-article-data.md'), '# x\n');
    write(path.join(produceDir, 'grey-food-insecurity-trend-projection.md'), '# x\n');
    write(path.join(produceDir, 'grey-current-system-shock-threshold.md'), '# x\n');
    write(path.join(produceDir, 'grey-plain-english-briefing.md'), '# x\n');

    const audit = buildEvidenceQualityAudit({
      produceDir,
      qaDir,
      metricRegistryPath: path.join(root, 'metric-registry.json'),
      sourceManifestPath: path.join(root, 'source-manifest.json')
    });
    expect(audit.status).toBe('pass');
    const inventory = JSON.parse(fs.readFileSync(path.join(qaDir, 'claim-inventory.json'), 'utf8'));
    const claim = inventory.claims.find((c) => c.claim_id === 'metric:grey_food_insecurity_2027_baseline_people');
    expect(claim.calibration_status).toBe('uncalibrated');
    expect(claim.missing_calibration_refs).toContain('food_charity_series');
    expect(claim.public_use).not.toBe('article_grade');
  });
});
