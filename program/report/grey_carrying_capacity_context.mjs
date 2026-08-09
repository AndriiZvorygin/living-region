import fs from 'node:fs';
import path from 'node:path';
import {loadCanonicalCarryingCapacity} from '../../packages/carrying-capacity/src/index.mjs';
import {calculateGreyCarryingCapacityAdoption} from '../../packages/carrying-capacity/src/regional.mjs';

function readJson(produceDir, name) {
  const filePath = path.join(produceDir, name);
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};
}

/** Attach the canonical household/site transition to a system-level Grey report. */
export function buildGreyCanonicalCarryingCapacityContext({produceDir = path.resolve('know/produce'), canonical = loadCanonicalCarryingCapacity()} = {}) {
  const dwelling = readJson(produceDir, 'grey-dwelling-land-access.json');
  const food = readJson(produceDir, 'grey-food-calibration.json');
  const adoption = calculateGreyCarryingCapacityAdoption({
    eligibleHouseholds: Number(dwelling.estimatedDwellingsWithGardenScaleAccess ?? 0),
    eligiblePopulation: Number(dwelling.estimatedPopulationWithGardenScaleAccess ?? 0),
    regionalFoodDemandGJ: Number(food.foodDemandBaseline?.totalFoodDemandGJ ?? 0),
    canonical,
    eligibilityBasis: 'estimatedDwellingsWithGardenScaleAccess and corresponding population from current Grey dwelling-land proxy; not legal parcel access or biological site classification'
  });
  return {model: '@living-region/carrying-capacity', contract_version: '1.0.0', eligibility_basis: adoption.eligibility_basis, adoption_scenarios: adoption, canonical_summary_path: 'packages/carrying-capacity/outputs/summary.json'};
}
