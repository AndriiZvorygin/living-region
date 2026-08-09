import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('packages/education-web/dist');
const index = fs.readFileSync(path.join(dist, 'index.html'));

for (const route of ['carrying-capacity', 'grey-county-transition']) {
  const routeDir = path.join(dist, route);
  fs.mkdirSync(routeDir, {recursive: true});
  fs.writeFileSync(path.join(routeDir, 'index.html'), index);
}

// Keep the app usable for other deep links while preserving clean route URLs.
fs.writeFileSync(path.join(dist, '404.html'), index);
