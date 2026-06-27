import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateRealElevationTerrainGrid } from "./elevation";
import {
  discoverCandidates,
  generateChoreRoutes,
  generateHamletLayout,
  generateOverlays,
  generateTerrainGrid,
  lotConcessionCsvPath,
  scenarioDir,
  selectSite,
  siteScoringWeights
} from "./fixtures";

export async function writeJson(path: string, value: unknown, options: { pretty?: boolean } = {}): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, `${options.pretty === false ? JSON.stringify(value) : JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function readLotCsv(): Promise<string | undefined> {
  return readFile(lotConcessionCsvPath, "utf8").catch(() => undefined);
}

export async function exportScenario(options: { siteId?: string; fast?: boolean } = {}): Promise<string[]> {
  const dir = scenarioDir;
  const candidates = discoverCandidates(await readLotCsv());
  const selectedCandidate = options.siteId
    ? candidates.candidates.find((candidate) => candidate.id === options.siteId)
    : candidates.candidates[0];
  if (!selectedCandidate) {
    throw new Error(`Unknown lot/concession candidate '${options.siteId}'. Available: ${candidates.candidates.map((candidate) => candidate.id).join(", ")}`);
  }
  const overlays = generateOverlays();
  const files: Array<[string, unknown]> = [
    ["site_scoring_weights.json", siteScoringWeights],
    ["candidates.json", candidates],
    ["overlays.json", overlays]
  ];
  for (const candidate of candidates.candidates) {
    const site = selectSite(candidates, candidate.id);
    const terrainOptions = { ...(options.fast ? { width: 40, height: 40, cellSizeM: 25 } : {}), candidate };
    const terrain = await generateRealElevationTerrainGrid(terrainOptions).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      console.warn(`Real elevation fetch failed for ${candidate.id}; using neutral placeholder terrain: ${detail}`);
      return generateTerrainGrid(terrainOptions);
    });
    const layout = generateHamletLayout(terrain);
    const choreRoutes = generateChoreRoutes(terrain, layout);
    const siteDir = join("sites", candidate.id);
    files.push(
      [join(siteDir, "site.json"), site],
      [join(siteDir, "terrain_grid.json"), terrain],
      [join(siteDir, "hamlet_layout.json"), layout],
      [join(siteDir, "chore_routes.json"), choreRoutes],
      [join(siteDir, "overlays.json"), overlays]
    );
    if (candidate.id === selectedCandidate.id) {
      files.push(["site.json", site], ["terrain_grid.json", terrain], ["hamlet_layout.json", layout], ["chore_routes.json", choreRoutes]);
    }
  }
  for (const [name, value] of files) {
    await writeJson(join(dir, name), value, { pretty: !name.endsWith("terrain_grid.json") });
  }
  return files.map(([name]) => join(dir, name));
}
