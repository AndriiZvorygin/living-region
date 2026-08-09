import {pathToFileURL} from 'node:url';
import {readCsv, number, round, writeJson, writeText, format} from './model-utils.mjs';

export function calculateHumanEnergy({bodyMassKg = 75, dailyKj = 13050, daysPerYear = 365.25} = {}) {
  const dailyMj = dailyKj / 1000;
  return {
    body_mass_kg: bodyMassKg,
    daily_kj: dailyKj,
    daily_mj: dailyMj,
    annual_gj: dailyKj * daysPerYear / 1_000_000,
    annual_kcal: dailyKj / 4.184,
    days_per_year: daysPerYear
  };
}

export function buildHumanEnergy() {
  const source = readCsv('data/source/human-energy.csv');
  const daily75 = number(source.find(row => row.variable === 'daily_energy_75kg')?.value) ?? 13050;
  const mass75 = number(source.find(row => row.variable === 'body_mass' && row.value === '75')?.value) ?? 75;
  const daily50 = number(source.find(row => row.variable === 'daily_energy_50kg')?.value) ?? 8700;
  const mass50 = number(source.find(row => row.variable === 'body_mass' && row.value === '50')?.value) ?? 50;
  const daysPerYear = 365.25;
  const cases = [
    {...calculateHumanEnergy({bodyMassKg: mass50, dailyKj: daily50, daysPerYear}), label: 'lower/source 50 kg'},
    {...calculateHumanEnergy({bodyMassKg: mass75, dailyKj: daily75, daysPerYear}), label: 'canonical historical active 75 kg'},
    {...calculateHumanEnergy({bodyMassKg: 100, dailyKj: daily75 / mass75 * 100, daysPerYear}), label: 'higher linear sensitivity 100 kg'}
  ].map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'number' ? round(value, 9) : value])));
  const result = {
    canonical: cases[1],
    cases,
    source_formulas: source.filter(row => row.formula).map(row => ({cell: row.source_cell, formula: row.formula, displayed_value: row.value}))
  };
  writeJson('data/derived/human-energy.json', result);
  const md = `# Human food-energy reconstruction

The canonical historical case is the ` + '`j needs`' + ` sheet in ` + '`paradise-garden.ods`' + `: a 75 kg person with 13,050 kJ/day. The workbook formula for annual energy is ` + '`[.C3]*365.25/1000/1000`' + ` for the 50 kg reference row, then the 75 kg row scales that result by body mass.

| Case | Body mass | Daily energy | Annual energy | kcal/day |
|---|---:|---:|---:|---:|
${cases.map(row => `| ${row.label} | ${format(row.body_mass_kg, 2)} kg | ${format(row.daily_mj, 3)} MJ | ${format(row.annual_gj, 6)} GJ | ${format(row.annual_kcal, 0)} |`).join('\n')}

The 100 kg row is a sensitivity extrapolation from the workbook's linear scaling, not an original source input. ` + '`365.25`' + ` days/year is retained because it is present in the original formula.
`;
  writeText('outputs/tables/human-energy.md', md);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) buildHumanEnergy();
