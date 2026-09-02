import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('packages/education-web/dist');
const index = fs.readFileSync(path.join(dist, 'index.html'));

for (const route of ['carrying-capacity', 'grey-county-transition', 'arc-affordability', 'owen-sound-transit']) {
  const routeDir = path.join(dist, route);
  fs.mkdirSync(routeDir, {recursive: true});
  const routeIndex = route === 'owen-sound-transit'
    ? index.toString().replace('<title>Land &amp; Carrying Capacity | Living Region</title>', '<title>Owen Sound Transit Cost Model | Living Region</title>').replace('Explore the physical land, food, labour and heating constraints in Living Region\'s carrying-capacity model.', 'Explore how Owen Sound transit service hours, ridership, fares, grants and recurring savings affect annual municipal funding requirements.')
    : index;
  fs.writeFileSync(path.join(routeDir, 'index.html'), routeIndex);
}

// Keep the app usable for other deep links while preserving clean route URLs.
fs.writeFileSync(path.join(dist, '404.html'), index);
