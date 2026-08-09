import fs from 'node:fs';
import path from 'node:path';
import {buildCarryingCapacityPresentationContract} from '../packages/carrying-capacity/src/presentation.mjs';

const outputPath = path.resolve('packages/education-web/public/generated/carrying-capacity/presentation.json');
fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(outputPath, `${JSON.stringify(buildCarryingCapacityPresentationContract(), null, 2)}\n`);
console.log(`written: ${outputPath}`);
