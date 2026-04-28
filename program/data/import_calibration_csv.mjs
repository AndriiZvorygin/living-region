// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current);
  return values.map((item) => item.trim());
}

export function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd());
  const rows = [];
  let headers = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const cols = parseCsvLine(rawLine);
    if (!headers) {
      headers = cols.map((item) => item.trim());
      continue;
    }
    const row = {};
    for (let i = 0; i < headers.length; i += 1) {
      const key = headers[i];
      const value = cols[i] ?? '';
      const numeric = Number(value);
      row[key] = value === '' ? null : (Number.isFinite(numeric) && value !== '' ? numeric : value);
    }
    rows.push(row);
  }

  return { headers: headers ?? [], rows };
}

function readCsvIfExists(filePath, warnings) {
  if (!fs.existsSync(filePath)) {
    warnings.push({
      severity: 'info',
      code: 'calibration.csv.missing',
      message: `Calibration CSV not found: ${path.basename(filePath)}`
    });
    return { headers: [], rows: [] };
  }
  const text = fs.readFileSync(filePath, 'utf8');
  return parseCsv(text);
}

export function importCalibrationCsvTables(calibrationDir) {
  const warnings = [];
  const tables = {};

  const files = {
    roadMaintenance: 'road-maintenance.csv',
    railMaintenance: 'rail-maintenance.csv',
    vehicleCosts: 'vehicle-costs.csv',
    fuelPrices: 'fuel-prices.csv',
    buildingEnergy: 'building-energy.csv',
    population: 'population.csv',
    commodityFreight: 'commodity-freight.csv',
    landUseTransition: 'land-use-transition.csv'
  };

  const loadedFiles = [];
  for (const [key, filename] of Object.entries(files)) {
    const filePath = path.join(calibrationDir, filename);
    const parsed = readCsvIfExists(filePath, warnings);
    tables[key] = parsed;
    if (parsed.rows.length > 0) {
      loadedFiles.push(filePath);
    }
  }

  return { tables, loadedFiles, warnings };
}
