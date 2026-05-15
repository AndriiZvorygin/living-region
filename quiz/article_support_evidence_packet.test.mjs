import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { buildArticleSupportEvidencePacket } from '../program/reliability/article_support_evidence_packet.mjs';

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('article support evidence packet', () => {
  test('includes headline metrics, caveats, land-access warning, and matching values', () => {
    const root = path.resolve('know/produce/article-support-fixture');
    const produceDir = path.join(root, 'produce');
    const qaDir = path.join(root, 'qa');
    const outDir = path.join(root, 'article-support');
    const calDir = path.join(root, 'calibration');
    fs.rmSync(root, { recursive: true, force: true });

    writeJson(path.join(produceDir, 'grey-hormuz-food-security-article-data.json'), {
      headlineMetrics: [
        {
          metric_id: 'grey_food_insecurity_2027_baseline_people',
          label: 'Trend people',
          value: 12345,
          unit: 'people',
          status: 'scenario_output',
          confidence: 'moderate',
          source_refs: ['a.json'],
          scenario_refs: ['baseline'],
          not_forecast: true
        },
        {
          metric_id: 'grey_no_meaningful_food_growing_land_access_population',
          label: 'Land access strict',
          value: 678,
          unit: 'people',
          status: 'proxy',
          confidence: 'low',
          source_refs: ['b.json'],
          scenario_refs: []
        },
        {
          metric_id: 'food_for_10k_low_input_workers_year1',
          label: '10k workers',
          value: 111,
          unit: 'workers',
          status: 'scenario_output',
          confidence: 'moderate',
          source_refs: ['c.json'],
          scenario_refs: ['foodGap10'],
          not_forecast: true
        },
        {
          metric_id: 'food_for_33k_low_input_workers_year1',
          label: '33k workers',
          value: 333,
          unit: 'workers',
          status: 'scenario_output',
          confidence: 'moderate',
          source_refs: ['d.json'],
          scenario_refs: ['foodGap33'],
          not_forecast: true
        }
      ],
      sourceFiles: {}
    });

    writeJson(path.join(qaDir, 'claim-inventory.json'), {
      claims: [
        { claim_id: 'metric:grey_food_insecurity_2027_baseline_people', public_use: 'article_with_caveat', caveat: 'not a forecast' },
        {
          claim_id: 'metric:grey_no_meaningful_food_growing_land_access_population',
          public_use: 'exploratory_only',
          caveat: 'proxy',
          evidence_basis: ['lot_fabric_proxy'],
          land_access_groundtruth_status: 'partial_groundtruth'
        },
        { claim_id: 'metric:food_for_10k_low_input_workers_year1', public_use: 'article_with_caveat', caveat: 'not a forecast' },
        { claim_id: 'metric:food_for_33k_low_input_workers_year1', public_use: 'article_with_caveat', caveat: 'not a forecast' }
      ]
    });

    writeJson(path.join(produceDir, 'land-access-groundtruth-summary.json'), {
      landAccessGroundtruthStatus: 'partial_groundtruth',
      limitations: ['No address/building linkage.']
    });
    writeJson(path.join(produceDir, 'grey-land-access-gis-overlay-summary.json'), {
      lotFabricFeatureCount: 10,
      lotsInsideSettlementCount: 2,
      lotsOutsideSettlementCount: 8
    });
    writeJson(path.join(produceDir, 'local-calibration-summary.json'), { categories: {} });
    fs.mkdirSync(calDir, { recursive: true });
    fs.writeFileSync(path.join(calDir, 'food-charity-series.csv'), 'geography,organization_or_source,indicator,period_start,period_end,value,unit,source_ref,quality_tier,notes\nOntario,Org,visits,2025-01-01,2025-12-31,1,count,src,provincial_proxy,x\n');
    fs.writeFileSync(path.join(calDir, 'food-price-series.csv'), 'geography,basket_or_item,indicator,period_start,period_end,value,unit,source_ref,quality_tier,notes\nOntario,basket,percent_change,2025-01-01,2025-03-31,1.2,percent,src,provincial_proxy,x\n');
    fs.writeFileSync(path.join(calDir, 'rent-income-series.csv'), 'geography,indicator,period_start,period_end,value,unit,source_ref,quality_tier,notes\nOntario,minimum_wage_hourly,2025-10-01,2026-09-30,17.2,CAD/hour,src,provincial_proxy,x\n');
    fs.writeFileSync(path.join(qaDir, 'article-readiness-summary.md'), '# readiness\n');

    const out = buildArticleSupportEvidencePacket({
      produceDir,
      qaDir,
      outputDir: outDir,
      calibrationDir: calDir
    });

    expect(out.status).toBe('pass');
    const packet = JSON.parse(fs.readFileSync(path.join(outDir, 'grey-food-security-evidence-packet.json'), 'utf8'));

    // headline metrics included
    const metricIds = packet.numbersTable.map((r) => r.metric_id);
    expect(metricIds).toContain('grey_food_insecurity_2027_baseline_people');
    expect(metricIds).toContain('grey_no_meaningful_food_growing_land_access_population');

    // caveat included for scenario outputs
    const trend = packet.numbersTable.find((r) => r.metric_id === 'grey_food_insecurity_2027_baseline_people');
    expect(trend.caveat.toLowerCase()).toContain('forecast');

    // land-access partial-groundtruth warning present
    expect(packet.sourceAssumptionMap.landAccessGroundtruthStatus).toBe('partial_groundtruth');
    const land = packet.numbersTable.find((r) => r.metric_id === 'grey_no_meaningful_food_growing_land_access_population');
    expect(String(land.caveat).toLowerCase()).toContain('proxy');

    // include explicit avoid-phrasing section
    const md = fs.readFileSync(path.join(outDir, 'grey-food-security-evidence-packet.md'), 'utf8').toLowerCase();
    expect(md.includes('unsafe phrasing to avoid')).toBe(true);
    expect(md.includes('the gis proves household land access')).toBe(true);

    // values match source json
    expect(trend.value).toBe(12345);
  });
});
