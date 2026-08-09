import fs from 'node:fs';
import path from 'node:path';
import {parseOds, tableToMatrix, displayCell, cellAddress} from './ods-utils.mjs';

const root = '/home/htaf/arc-carrying-capacity-model';
const sourceRoot = '/home/htaf/lyis';
const paths = {
  paradise: `${sourceRoot}/pcan/paradise-garden.ods`,
  farmSize: `${sourceRoot}/sren/Farm_size_to_yield.ods`,
  foodForest: `${sourceRoot}/tcas/WiartonWomensInstitute/Food_forest_plan.ods`
};

function ensure(dir) { fs.mkdirSync(path.join(root, dir), {recursive: true}); }
function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
function writeCsv(relative, rows) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, rows.map(row => row.map(csvEscape).join(',')).join('\n') + '\n');
}
function sheetRows(file) {
  return parseOds(file).map(table => ({name: table.name, matrix: tableToMatrix(table), table}));
}
function rowValues(row) { return row.map(displayCell); }
function findRows(sheet, predicate) { return sheet.matrix.filter(row => predicate(rowValues(row))); }
function numberFrom(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, '').replace('%', '').trim());
  return Number.isFinite(n) ? n : null;
}
function normalizePercent(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = numberFrom(value);
  if (n === null) return null;
  return String(value).includes('%') ? n / 100 : n > 1 ? n / 100 : n;
}

function extractParadise() {
  const sheets = sheetRows(paths.paradise);
  const rawRows = [];
  for (const sheet of sheets) {
    for (const row of sheet.table.rows) {
      const cells = row.cells;
      const values = cells.map(displayCell);
      if (!values.join(' ').trim()) continue;
      rawRows.push({source_sheet: sheet.name, source_row: row.index, cells: values, formulas: cells.map(cell => cell.formula || '')});
    }
  }
  fs.writeFileSync(path.join(root, 'data/source/paradise-garden-extracted.json'), JSON.stringify({source: paths.paradise, sheets: rawRows}, null, 2) + '\n');

  const bySheet = new Map(sheets.map(sheet => [sheet.name.toLowerCase(), sheet]));
  const plantNutrients = new Map();
  for (const row of bySheet.get('plant nutrient')?.table.rows || []) {
    const v = row.cells.map(displayCell);
    const name = (v[0] || '').trim();
    if (!name || /^(name|sustainable foods)/i.test(name)) continue;
    plantNutrients.set(name.toLowerCase(), {
      carbs: normalizePercent(v[1]), fats: normalizePercent(v[2]), protein: normalizePercent(v[3]),
      kj100g: numberFrom(v[4]), sourceRow: row.index
    });
  }
  // One workbook row spells the same crop as "pear cactus" while the yield
  // sheet spells it "cactus pear". Preserve both original spellings without
  // changing either source value.
  if (plantNutrients.has('pear cactus')) plantNutrients.set('cactus pear', plantNutrients.get('pear cactus'));
  const seedlingData = new Map();
  for (const row of bySheet.get('seedling cost')?.table.rows || []) {
    const v = row.cells.map(displayCell);
    const name = (v[0] || '').trim();
    if (name && !/^(name|sustainable foods)/i.test(name)) seedlingData.set(name.toLowerCase(), {cost: v[1] || '', source: v[2] || '', sourceRow: row.index});
  }

  const cropRows = [];
  const perennials = new Set(['black walnut', 'n. hazelnut', 'pine nut', 'chestnut', 'grapes', 'apples', 'apios americana', 'mulberry', 'bur oak', 'autumn olive', 'cactus pear', 'cassava']);
  const yieldSheetNames = ['tree yields', 'annual yields', 'perrenial yields'];
  for (const sheetName of yieldSheetNames) {
    const sheet = bySheet.get(sheetName);
    const group = sheetName === 'tree yields' ? 'tree yields' : sheetName === 'annual yields' ? 'annual yields' : 'perrenial yields (spelling retained from workbook)';
    for (const row of sheet?.table.rows || []) {
      const v = row.cells.map(displayCell);
      const name = (v[0] || '').trim();
      if (!name || /^(name|sustainable foods)/i.test(name)) continue;
      const tons = numberFrom(v[1]);
      const plantsOrSeed = numberFrom(v[2]);
      const gj = numberFrom(v[3]);
      const mj100 = numberFrom(v[5]);
      if (tons === null || gj === null) continue;
      const nutrient = plantNutrients.get(name.toLowerCase()) || {};
      const seed = sheetName === 'tree yields' ? null : plantsOrSeed;
      const seedling = seedlingData.get(name.toLowerCase()) || {};
      cropRows.push([
        name, group, tons, '', nutrient.carbs ?? '', nutrient.fats ?? '', nutrient.protein ?? '', nutrient.kj100g ?? '', nutrient.kj100g === undefined ? '' : nutrient.kj100g * 0.01,
        gj, mj100, perennials.has(name.toLowerCase()) ? 'perennial' : '', seed ?? '', sheetName === 'tree yields' ? '' : (numberFrom(v[4]) ?? ''),
        row.cells[3]?.formula || '', row.cells[5]?.formula || '', paths.paradise, sheet.name, row.index,
        `nutrient_source_row=${nutrient.sourceRow ?? ''}; seedling_cost=${seedling.cost ?? ''}; seedling_source=${seedling.source ?? ''}`
      ]);
    }
  }
  const header = ['crop_species','crop_group_original','yield_tonnes_per_ha','edible_fraction_original','carbs_fraction','fats_fraction','protein_fraction','energy_density_kj_per_100g','energy_density_mj_per_kg','gj_per_ha','mj_per_100m2','perennial_annual_original_or_blank','seed_kg_per_ha','hkg_per_kg_seed','source_formula_gj_per_ha','source_formula_mj_per_100m2','source_file','source_sheet','source_row','original_notes'];
  writeCsv('data/source/crops.csv', [header, ...cropRows]);

  const humanSheet = bySheet.get('j needs');
  const humanRows = (rowNumber) => humanSheet?.table.rows.find(row => row.index === rowNumber);
  const human = [['variable','value','units','source_file','source_sheet','source_row','source_cell','formula','status'],
    ['body_mass',50,'kg',paths.paradise,'j needs',3,'B3','','input in workbook'],
    ['body_mass',75,'kg',paths.paradise,'j needs',4,'B4','','input in workbook'],
    ['daily_energy_50kg',8700,'kJ/day',paths.paradise,'j needs',3,'C3','','input in workbook'],
    ['daily_energy_75kg',13050,'kJ/day',paths.paradise,'j needs',4,'C4',humanRows(4)?.cells[2]?.formula || '','derived formula in workbook'],
    ['annual_energy_50kg',3.177675,'GJ/year',paths.paradise,'j needs',3,'D3',humanRows(3)?.cells[3]?.formula || '','derived formula in workbook'],
    ['annual_energy_75kg',4.7665125,'GJ/year',paths.paradise,'j needs',4,'D4',humanRows(4)?.cells[3]?.formula || '','derived formula in workbook'],
    ['monthly_energy_75kg',397.209375,'MJ/month',paths.paradise,'j needs',4,'E4',humanRows(4)?.cells[4]?.formula || '','derived formula in workbook'],
    ['weekly_energy_75kg',91.35,'MJ/week',paths.paradise,'j needs',4,'F4',humanRows(4)?.cells[5]?.formula || '','derived formula in workbook']
  ];
  writeCsv('data/source/human-energy.csv', human);
  return {sheets, rows: rawRows};
}

function extractFarmSize() {
  const sheets = sheetRows(paths.farmSize);
  const rows = [['farm_size_class','land_share_percent','crop_share_percent','food_crop_share_percent','return_on_land_food','return_on_land_food_and_crop','source_file','source_sheet','source_row','source_formulas']];
  for (const sheet of sheets) for (const sourceRow of sheet.table.rows) {
    const v = sourceRow.cells.map(displayCell);
    const label = (v[0] || '').trim();
    if (!label || !(/</.test(label) || /^all size$/i.test(label))) continue;
    rows.push([label, numberFrom(v[1]), numberFrom(v[2]), numberFrom(v[3]), numberFrom(v[4]), numberFrom(v[5]), paths.farmSize, sheet.name, sourceRow.index, sourceRow.cells.map(c => c.formula || '').join(' | ')]);
  }
  writeCsv('data/source/farm-size-yield.csv', rows);
  fs.writeFileSync(path.join(root, 'data/source/farm-size-yield-extracted.json'), JSON.stringify(sheets, null, 2) + '\n');
  return sheets;
}

function extractFoodForest() {
  const sheets = sheetRows(paths.foodForest);
  const rows = [['source_file','source_sheet','source_row','source_column','value','formula','value_type']];
  for (const sheet of sheets) for (const sourceRow of sheet.table.rows) for (const cell of sourceRow.cells) {
    const value = displayCell(cell);
    if (value === '' && !cell.formula) continue;
    rows.push([paths.foodForest, sheet.name, sourceRow.index, cellAddress(sourceRow.index, cell.column), value, cell.formula || '', cell.valueType || '']);
  }
  writeCsv('data/source/food-forest-plan.csv', rows);
  fs.writeFileSync(path.join(root, 'data/source/food-forest-plan-extracted.json'), JSON.stringify(sheets, null, 2) + '\n');
  return sheets;
}

function writeHistoricModel() {
  writeCsv('data/source/wood-energy.csv', [
    ['variable','value','units','source_file','source_reference','status','notes'],
    ['willow_coppice_area',0.50,'ha','/home/htaf/lyis/pfet/hfoc/hectare_breakdown.svg','label: Core wood: Willow SRC 0.5gHa','historical diagram label','SVG label uses gHa, while surrounding text calls it a hectare allocation'],
    ['willow_coppice_gross_energy',15,'GJ/year','/home/htaf/lyis/pfet/hfoc/hectare_breakdown.svg','label: Core wood: Willow SRC 0.5gHa; 1 cord = ~15Gj','historical diagram label','gross fuel energy; not useful delivered heat'],
    ['wood_cord_energy',15,'GJ/cord','/home/htaf/lyis/pfet/hfoc/hectare_breakdown.svg','label: 1 cord = ~15Gj','historical diagram label','energy-per-cord assumption embedded in graphic'],
    ['willow_coppice_yield',1,'cord/year','/home/htaf/lyis/sren/long_term_rural/long_term_rural.tex','note at line 328: half hectare willow short rotation coppice to yield 1 cord','historical prose assumption','not a spreadsheet formula']
  ]);
  writeCsv('data/source/historic-hectare-model.csv', [
    ['allocation','area_ha','energy_low_gj_per_year','energy_high_gj_per_year','energy_type','source_file','source_reference','status','notes'],
    ['core food',0.25,5,7,'food','/home/htaf/lyis/pfet/hfoc/hectare_breakdown.svg','label: core food 0.25gHa ~5-7Gj','historical diagram label','not formula-linked to a specific crop mix'],
    ['backup/perennial food',0.25,5,7,'food','/home/htaf/lyis/pfet/hfoc/hectare_breakdown.svg','label: backup food/food forest 0.25 ~5-7Gj','historical diagram label','not formula-linked to a specific crop mix'],
    ['willow short-rotation coppice',0.50,15,15,'gross woody biomass','/home/htaf/lyis/pfet/hfoc/hectare_breakdown.svg','label: Core wood: Willow SRC 0.5gHa; 1 cord = ~15Gj','historical diagram label','not found as a formula in the audited ODS files'],
    ['total productive land',1.00,25,29,'mixed gross biological energy','/home/htaf/lyis/pfet/hfoc/hectare_breakdown.svg','sum of displayed component ranges','derived reconstruction','food and wood streams are not directly interchangeable']
  ]);
}

ensure('data/source');
extractParadise();
extractFarmSize();
extractFoodForest();
writeHistoricModel();
console.log('Extracted ODS sources into data/source/.');
