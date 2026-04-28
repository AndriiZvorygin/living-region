# Contributing to Living Region

Thanks for contributing.

## Setup

```bash
npm install
npm test
```

## Common Commands

```bash
npm run demo
npm run demo:grey
npm run export:geojson
```

## Coding Conventions

- Node.js ESM (`.mjs`)
- 2-space indentation
- Deterministic formulas and outputs
- No hidden magic constants
- Put constants in `program/data/default_constants.mjs` or calibration profiles
- Add/update tests under `quiz/` for behavior changes

## Adding a Scenario

1. Add scenario shape in `program/data/demo_scenario.mjs` (or new scenario data module).
2. Wire scenario command in `command/` and `package.json` scripts if needed.
3. Ensure constants overrides remain transparent and named.
4. Add tests showing the scenario’s intended difference.

## Adding a GIS Import Layer

1. Extend `program/gis/import_geojson.mjs` mapping/validation.
2. Preserve unknown source properties under `sourceProperties`.
3. Update `docs/import-schema.md` and `docs/open-data.md`.
4. Add tests for import parsing and validation behavior.

## Formula Changes

Any new formula must include:

- Named coefficients/constants
- Clear unit semantics
- Documentation update (README/docs)
- Test coverage in `quiz/`
