// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const REQUIRED_FIELDS = [
  'source_id',
  'title',
  'source_class',
  'local_path',
  'content_hash',
  'schema_version'
];
const ALLOWED_SOURCE_CLASSES = new Set(['external_snapshot', 'manual_curated_input', 'generated_derived_output']);

function sha256File(filePath) {
  const data = fs.readFileSync(filePath);
  return `sha256:${crypto.createHash('sha256').update(data).digest('hex')}`;
}

export function validateSourceManifest(options = {}) {
  const manifestPath = path.resolve(options.manifestPath ?? 'know/source-manifest.json');
  const baseDir = path.resolve(options.baseDir ?? '.');
  const failures = [];
  const warnings = [];
  let checked = 0;
  let changed = 0;

  if (!fs.existsSync(manifestPath)) {
    return {
      status: 'fail',
      failures: [`Missing source manifest: ${manifestPath}`],
      warnings,
      checked,
      changed,
      manifestPath
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return {
      status: 'fail',
      failures: [`Invalid JSON in source manifest: ${error.message}`],
      warnings,
      checked,
      changed,
      manifestPath
    };
  }

  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  if (!entries.length) failures.push('source-manifest has no entries');

  for (const entry of entries) {
    checked += 1;
    for (const field of REQUIRED_FIELDS) {
      if (entry[field] == null || String(entry[field]).trim() === '') {
        failures.push(`source ${entry.source_id ?? '(unknown)'} missing required field: ${field}`);
      }
    }
    if (!ALLOWED_SOURCE_CLASSES.has(entry.source_class)) {
      failures.push(`source ${entry.source_id ?? '(unknown)'} has invalid source_class: ${entry.source_class}`);
    }
    if (entry.source_class === 'generated_derived_output') {
      warnings.push(`source ${entry.source_id} is generated_derived_output; avoid circular provenance by validating upstream sources separately`);
    }

    const localPath = path.resolve(baseDir, entry.local_path ?? '');
    if (!fs.existsSync(localPath)) {
      failures.push(`source ${entry.source_id ?? '(unknown)'} missing local file: ${entry.local_path}`);
      continue;
    }

    const actualHash = sha256File(localPath);
    if (actualHash !== entry.content_hash) {
      changed += 1;
      failures.push(
        `source ${entry.source_id} hash mismatch: expected ${entry.content_hash} got ${actualHash}`
      );
    }
  }

  return {
    status: failures.length ? 'fail' : 'pass',
    failures,
    warnings,
    checked,
    changed,
    manifestPath,
    schema_version: manifest.schema_version ?? null
  };
}
