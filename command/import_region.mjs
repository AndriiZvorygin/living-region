// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { loadCalibrationBundle } from '../program/data/calibration_bundle.mjs';
import { importGeoJsonWorld } from '../program/gis/import_geojson.mjs';

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith('--')) {
      continue;
    }
    const [key, value] = item.slice(2).split('=');
    args[key] = value ?? true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const inputDir = path.resolve(args.input ?? 'know/input');
const outputPath = path.resolve(args.output ?? 'know/produce/imported-world.json');

const calibration = loadCalibrationBundle(inputDir);
const populationRows = calibration.tables.population?.rows ?? [];
const imported = importGeoJsonWorld(inputDir, { populationRows });

const payload = {
  world: imported.world,
  calibrationConstants: calibration.constants,
  calibrationLoadedFiles: calibration.loadedFiles,
  calibrationWarnings: calibration.warnings,
  importWarnings: imported.warnings,
  validation: imported.validation
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));

const stations = imported.world.infrastructures.filter((item) => ['railStation', 'railHalt', 'freightSiding', 'intermodalDepot', 'marketDepot', 'grainElevator', 'woodDepot', 'coldStorageDepot', 'repairDepot'].includes(item.type));
const anchors = imported.world.infrastructures.filter((item) => ['grainDepot', 'rootCellarDepot', 'coldStorageDepot', 'woodFuelDepot', 'timberSiding', 'farmInputDepot', 'nurseryStockDepot', 'repairMaterialsDepot', 'compostTransferDepot', 'constructionMaterialsDepot', 'emergencySupplyDepot'].includes(item.type));

const allWarnings = [
  ...calibration.warnings,
  ...imported.warnings,
  ...imported.validation.warnings,
  ...imported.validation.info
];

console.log(`Imported world written: ${outputPath}`);
console.log(`patches: ${imported.world.patches.length}`);
console.log(`buildings: ${imported.world.buildings.length}`);
console.log(`networks: ${imported.world.networks.length}`);
console.log(`stations: ${stations.length}`);
console.log(`freight anchors: ${anchors.length}`);
console.log(`calibration files loaded: ${calibration.loadedFiles.length}`);
console.log(`warnings: ${allWarnings.length}`);
if (imported.validation.errors.length > 0) {
  console.log(`errors: ${imported.validation.errors.length}`);
  for (const error of imported.validation.errors.slice(0, 5)) {
    console.log(`  - ${error.code}: ${error.message}`);
  }
  process.exitCode = 1;
} else if (allWarnings.length > 0) {
  for (const warning of allWarnings.slice(0, 8)) {
    console.log(`  - ${warning.code ?? 'warning'}: ${warning.message}`);
  }
}
