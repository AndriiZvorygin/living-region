# Carrying-capacity education web architecture

The public educational interface lives in `packages/education-web`, alongside but separate from the specialised Three.js planner in `packages/web-client`.

## Decision

The planner and the education interface have different interaction models. The planner is a true-scale Three.js/GIS scene; the education interface is a responsive document with forms, evidence disclosures, time-series views and regional controls. Keeping them as separate Vite workspaces avoids turning the field/planning client into a monolithic application and allows each surface to keep its own performance and accessibility priorities.

The education workspace deliberately uses browser-native TypeScript, HTML, CSS and SVG/CSS bars rather than adding a second UI framework. It imports only the browser-safe carrying-capacity core. It does not import Node filesystem/data-loader code and it does not contain land, food, heating or Health Canada formulas.

## Data flow

1. `command/build_carrying_capacity_presentation.mjs` loads the canonical ARC summary and Grey report inputs.
2. `packages/carrying-capacity/src/presentation.mjs` calls the canonical regional API and writes `packages/education-web/public/generated/carrying-capacity/presentation.json`.
3. The Vite browser loads that versioned contract offline after preparation.
4. Editable person inputs call `packages/carrying-capacity/src/browser.mjs`, which re-exports the pure EER and balanced-food functions shared by Node reports.
5. Preset transition rows and Grey adoption outputs are read directly from the generated contract.

## Reference audit

`/home/htaf/oil-model/website` was reviewed for its useful patterns: routed public research pages, generated JSON data contracts, source-note components, methodology disclosures, responsive controls and charts. Its React/Tailwind dependency stack was not copied. Living Region’s existing `packages/web-client` remains the Three.js site planner; `packages/education-web` is the smaller educational/research surface.

## Commands

- `npm run build:carrying-capacity-contract`
- `npm run dev:education`
- `npm run build:education`
- `npm run validate:education`

The generated contract is metric-first: public energy displays use MJ/day and GJ/year. Health Canada’s source equation is preserved in the canonical model; the public presentation intentionally does not expose non-SI daily energy units.
