import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Resolve all evidence and generated outputs from this workspace package. The
// standalone ARC checkout used an absolute path, which would make the migrated
// calculations depend on a second repository at runtime.
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function readCsv(relative) {
  const text = fs.readFileSync(path.join(ROOT, relative), 'utf8');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.filter(r => r.some(v => v !== '')).map(r => Object.fromEntries(header.map((key, i) => [key, r[i] ?? ''])));
}

export function number(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

export function numbers(values) { return values.map(number).filter(v => v !== null); }

export function sum(values) { return values.reduce((a, b) => a + b, 0); }

export function mean(values) { return values.length ? sum(values) / values.length : null; }

export function quantile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export function stats(values) {
  const x = numbers(values);
  const avg = mean(x);
  const variance = avg === null ? null : mean(x.map(v => (v - avg) ** 2));
  const sd = variance === null ? null : Math.sqrt(variance);
  return {
    count: x.length,
    min: x.length ? Math.min(...x) : null,
    q1: quantile(x, 0.25),
    median: quantile(x, 0.5),
    q3: quantile(x, 0.75),
    max: x.length ? Math.max(...x) : null,
    mean: avg,
    standard_deviation: sd,
    coefficient_of_variation: avg ? sd / avg : null,
    interquartile_range: x.length ? quantile(x, 0.75) - quantile(x, 0.25) : null
  };
}

export function round(value, digits = 6) {
  if (value === null || value === undefined || !Number.isFinite(value)) return value;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function ensureDir(relative) { fs.mkdirSync(path.join(ROOT, relative), {recursive: true}); }
export function writeJson(relative, value) {
  const file = path.join(ROOT, relative);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  // Keep readers from observing a truncated generated contract while another
  // report/test process is rebuilding the same output.
  const temporary = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(temporary, file);
}
export function writeText(relative, text) {
  const file = path.join(ROOT, relative);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, text.endsWith('\n') ? text : text + '\n');
}
export function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
export function writeCsv(relative, rows) {
  writeText(relative, rows.map(row => row.map(csvEscape).join(',')).join('\n'));
}

export function svgText(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function format(value, digits = 2) {
  return value === null || value === undefined ? 'n/a' : Number(value).toFixed(digits).replace(/\.00$/, '');
}
