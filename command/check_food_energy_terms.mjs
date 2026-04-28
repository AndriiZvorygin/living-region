// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const filesToCheck = [
  path.join(ROOT, 'README.md'),
  path.join(ROOT, 'docs', 'grey-county-seed.md'),
  path.join(ROOT, 'docs', 'import-schema.md'),
  path.join(ROOT, 'docs', 'open-data.md')
];

const banned = [/\bcalorie(s)?\b/i, /\bkcal\b/i];

function isAllowedCompatibilityLine(line) {
  return /compatibility alias|deprecated compatibility/i.test(line);
}

const violations = [];
for (const file of filesToCheck) {
  if (!fs.existsSync(file)) {
    continue;
  }
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isAllowedCompatibilityLine(line)) {
      continue;
    }
    if (banned.some((re) => re.test(line))) {
      violations.push({ file: path.relative(ROOT, file), line: i + 1, text: line.trim() });
    }
  }
}

if (violations.length > 0) {
  console.error('Food-energy terminology check failed:');
  for (const v of violations) {
    console.error(`- ${v.file}:${v.line}: ${v.text}`);
  }
  process.exit(1);
}

console.log('Food-energy terminology check passed.');
