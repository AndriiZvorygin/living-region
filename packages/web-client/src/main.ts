import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type Candidate = {
  id: string;
  lotcon_id: string;
  name: string;
  municipality: string;
  area_ha: number;
  distance_to_owen_sound_km: number;
  score_total: number;
  source_quality: string;
  data_caveat: string;
  explanation: string;
};

type Site = {
  id: string;
  name: string;
  selected_candidate_id: string;
  terrain_source: string;
  data_caveat: string;
};

type TerrainCell = {
  id: string;
  x_m: number;
  z_m: number;
  size_m: number;
  elevation_m: number;
  slope_degrees: number;
  aspect_degrees: number;
  solar_score: number;
  wetness_index: number;
  land_use: string;
  yurt_suitability: number;
  garden_suitability: number;
  pond_suitability: number;
  best_uses: string[];
  warnings: string[];
};

type TerrainGrid = {
  metadata: {
    grid_width: number;
    grid_height: number;
    cell_size_m: number;
    min_elevation_m: number;
    max_elevation_m: number;
    terrain_source?: string;
    terrain_source_detail?: string;
  };
  cells: TerrainCell[];
};

type LayoutElement = {
  id: string;
  type: string;
  label: string;
  x_m: number;
  z_m: number;
  radius_m?: number;
  width_m?: number;
  length_m?: number;
  points?: Array<[number, number]>;
};

type HamletLayout = {
  metadata: { warnings?: string[] };
  elements: LayoutElement[];
};

type Overlay = { id: string; label: string; hotkey: string; source_field?: keyof TerrainCell; mode: string };

type ChoreTask = {
  id: string;
  task_id: string;
  label: string;
  title: string;
  assigned_agent_type: string;
  recurrence: { frequency_per_week: number };
  priority: number;
  stops: ItineraryStop[];
  legs: ChoreLeg[];
  from: string;
  to: string;
  load: "unloaded" | "loaded";
  frequency_per_week: number;
  distance_m: number;
  travel_time_minutes: number;
  action_time_minutes: number;
  estimated_time_minutes: number;
  effort_multiplier: number;
  winter_time_minutes: number;
  winter_effort_multiplier: number;
  path: Array<[number, number]>;
};

type ItineraryStop = {
  location_id: string;
  point_id: string;
  action: string;
  expected_duration_minutes: number;
  load?: "unloaded" | "loaded";
  carried_item?: string;
  produces?: string[];
  consumes?: string[];
};

type ChoreLeg = {
  from: string;
  to: string;
  label: string;
  load: "unloaded" | "loaded";
  carried_item?: string;
  distance_m: number;
  estimated_time_minutes: number;
  effort_multiplier: number;
  winter_time_minutes: number;
  winter_effort_multiplier: number;
  path: Array<[number, number]>;
};

type ChoreRouteSet = {
  points: Array<{ id: string; label: string; x_m: number; z_m: number }>;
  tasks?: ChoreTask[];
  chores?: ChoreTask[];
  summary: {
    daily_walking_time_minutes: number;
    daily_task_time_minutes?: number;
    weekly_chore_distance_m: number;
    winter_burden_minutes_per_day: number;
    hardest_chore_id: string;
  };
};

const basePath = "/scenarios/pilot_yurt_hamlet";
const addonLabels = {
  envelope: "1 ha envelope",
  yurts: "Yurts",
  buildings: "Shared buildings",
  water: "Water systems",
  food: "Food production",
  paths: "Paths and access"
} as const;

type AddonId = keyof typeof addonLabels;

function ramp(value: number, low: number, high: number, a: THREE.ColorRepresentation, b: THREE.ColorRepresentation): THREE.Color {
  const t = THREE.MathUtils.clamp((value - low) / (high - low || 1), 0, 1);
  return new THREE.Color(a).lerp(new THREE.Color(b), t);
}

async function fetchJson<T>(path: string, timeoutMs = 30000): Promise<T> {
  const url = `${path}${path.includes("?") ? "&" : "?"}v=${Date.now()}`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(url, { cache: "no-store", signal: controller.signal }).finally(() => {
    window.clearTimeout(timeout);
  });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json() as Promise<T>;
}

async function main(): Promise<void> {
  const [initialSite, candidates, overlays] = await Promise.all([
    fetchJson<Site>(`${basePath}/site.json`),
    fetchJson<{ candidates: Candidate[] }>(`${basePath}/candidates.json`),
    fetchJson<{ overlays: Overlay[] }>(`${basePath}/overlays.json`)
  ]);

  const canvas = document.querySelector<HTMLCanvasElement>("#scene");
  if (!canvas) throw new Error("Missing scene canvas");
  const sceneCanvas = canvas;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#1b211b");
  const renderer = new THREE.WebGLRenderer({ canvas: sceneCanvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
  camera.position.set(290, 420, 690);
  camera.lookAt(290, 0, 290);
  const controls = new OrbitControls(camera, sceneCanvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.minDistance = 80;
  controls.maxDistance = 1200;
  controls.maxPolarAngle = Math.PI * 0.48;

  scene.add(new THREE.HemisphereLight("#fff7df", "#4f5d4a", 2.4));
  const sun = new THREE.DirectionalLight("#ffe1a3", 2.8);
  sun.position.set(-260, 420, 180);
  scene.add(sun);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(-10, -10);
  const basePropertyGroup = new THREE.Group();
  const layoutGroup = new THREE.Group();
  const routeGroup = new THREE.Group();
  const addonLayerGroups = new Map<AddonId, THREE.Group>();
  const addonVisibility: Record<AddonId, boolean> = {
    envelope: true,
    yurts: true,
    buildings: true,
    water: true,
    food: true,
    paths: true
  };
  scene.add(basePropertyGroup);
  scene.add(layoutGroup);
  scene.add(routeGroup);

  let activeOverlay = "land_use";
  let activeCandidateId = initialSite.selected_candidate_id;
  let site = initialSite;
  let terrain: TerrainGrid | undefined;
  let layout: HamletLayout | undefined;
  let choreRoutes: ChoreRouteSet | undefined;
  let terrainMesh: THREE.Mesh | undefined;
  let selectedRouteId = "";
  let winterMode = false;
  let forceLoadedMode = true;
  let loadSequence = 0;

  const candidatesEl = document.querySelector<HTMLOListElement>("#candidates");
  const candidateSelectEl = document.querySelector<HTMLSelectElement>("#candidate-select");
  const candidateStatusEl = document.querySelector<HTMLDivElement>("#candidate-status");
  const buttonsEl = document.querySelector<HTMLDivElement>("#overlay-buttons");
  const addonTogglesEl = document.querySelector<HTMLDivElement>("#addon-toggles");
  const routeControlsEl = document.querySelector<HTMLDivElement>("#route-controls");
  const routeSummaryEl = document.querySelector<HTMLDListElement>("#route-summary");
  const inspectorEl = document.querySelector<HTMLDListElement>("#inspector");
  const hudEl = document.querySelector<HTMLDivElement>("#hud");

  function selectedCandidate(): Candidate | undefined {
    return candidates.candidates.find((candidate) => candidate.id === activeCandidateId);
  }

  function candidateLabel(candidate: Candidate): string {
    return `${candidate.name} (${candidate.score_total.toFixed(3)})`;
  }

  function setCandidateStatus(message: string, tone: "idle" | "loading" | "error" = "idle"): void {
    if (!candidateStatusEl) return;
    candidateStatusEl.textContent = message;
    candidateStatusEl.dataset.tone = tone;
  }

  function colorForCell(cell: TerrainCell, overlayId: string): THREE.Color {
    if (!terrain) return new THREE.Color("#6c735a");
    if (overlayId === "land_use") {
      if (cell.land_use.includes("woodlot")) return new THREE.Color("#436b3e");
      if (cell.land_use.includes("hydrology")) return new THREE.Color("#3f7180");
      return new THREE.Color("#8b8a54");
    }
    if (overlayId === "elevation") return ramp(cell.elevation_m, terrain.metadata.min_elevation_m, terrain.metadata.max_elevation_m, "#315b55", "#e2c66f");
    if (overlayId === "slope") return ramp(cell.slope_degrees, 0, 18, "#5f8f53", "#b65c45");
    if (overlayId === "aspect") return new THREE.Color().setHSL(cell.aspect_degrees / 360, 0.58, 0.5);
    if (overlayId === "solar") return ramp(cell.solar_score, 0, 1, "#344d6d", "#f0c34b");
    if (overlayId === "yurt_suitability") return ramp(cell.yurt_suitability, 0, 1, "#65404a", "#75b66a");
    if (overlayId === "crop_suitability") return ramp(cell.garden_suitability, 0, 1, "#473b62", "#c2b85c");
    if (overlayId === "wetness") return ramp(cell.wetness_index, 0, 1, "#6b6540", "#3a93aa");
    return new THREE.Color("#6c735a");
  }

  function buildTerrainMesh(grid: TerrainGrid): THREE.Mesh {
    const width = grid.metadata.grid_width;
    const height = grid.metadata.grid_height;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    for (let z = 0; z < height; z += 1) {
      for (let x = 0; x < width; x += 1) {
        const cell = grid.cells[z * width + x];
        positions.push(cell.x_m, (cell.elevation_m - grid.metadata.min_elevation_m) * 1.8, cell.z_m);
        const color = colorForCell(cell, activeOverlay);
        colors.push(color.r, color.g, color.b);
      }
    }
    for (let z = 0; z < height - 1; z += 1) {
      for (let x = 0; x < width - 1; x += 1) {
        const a = z * width + x;
        indices.push(a, a + width, a + 1, a + 1, a + width, a + width + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  }

  function updateTerrainColors(): void {
    if (!terrain || !terrainMesh) return;
    const colorAttr = terrainMesh.geometry.getAttribute("color") as THREE.BufferAttribute;
    terrain.cells.forEach((cell, index) => {
      const color = colorForCell(cell, activeOverlay);
      colorAttr.setXYZ(index, color.r, color.g, color.b);
    });
    colorAttr.needsUpdate = true;
  }

  function elevationNear(xM: number, zM: number): number {
    if (!terrain) return 0;
    const width = terrain.metadata.grid_width;
    const cellSize = terrain.metadata.cell_size_m;
    const x = THREE.MathUtils.clamp(Math.round(xM / cellSize), 0, width - 1);
    const z = THREE.MathUtils.clamp(Math.round(zM / cellSize), 0, terrain.metadata.grid_height - 1);
    return (terrain.cells[z * width + x].elevation_m - terrain.metadata.min_elevation_m) * 1.8 + 2;
  }

  function clearObject(object: THREE.Object3D): void {
    object.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material?.dispose?.();
    });
  }

  function addonForType(type: string): AddonId {
    if (type === "building_envelope_1ha") return "envelope";
    if (type === "yurt") return "yurts";
    if (["common_house", "shared_kitchen_meeting", "root_cellar", "tool_shed_workshop", "chicken_coop", "woodshed"].includes(type)) return "buildings";
    if (["pond", "swale", "compost", "water_storage"].includes(type)) return "water";
    if (["gardens", "fields", "orchard", "shrub_area", "woodlot_coppice"].includes(type)) return "food";
    return "paths";
  }

  function applyAddonVisibility(): void {
    for (const [id, group] of addonLayerGroups) {
      group.visible = addonVisibility[id];
    }
  }

  function lineFromPoints(points: Array<[number, number]>, color: THREE.ColorRepresentation, yOffset = 1): THREE.Line {
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points.map(([x, z]) => new THREE.Vector3(x, elevationNear(x, z) + yOffset, z))),
      new THREE.LineBasicMaterial({ color })
    );
  }

  function densifyPoints(points: Array<[number, number]>, maxSegmentM: number): Array<[number, number]> {
    const dense: Array<[number, number]> = [];
    for (let index = 0; index < points.length - 1; index += 1) {
      const [x1, z1] = points[index];
      const [x2, z2] = points[index + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, z2 - z1) / maxSegmentM));
      for (let step = 0; step < steps; step += 1) {
        const t = step / steps;
        dense.push([x1 + (x2 - x1) * t, z1 + (z2 - z1) * t]);
      }
    }
    dense.push(points[points.length - 1]);
    return dense;
  }

  function stripFromPoints(points: Array<[number, number]>, widthM: number, color: THREE.ColorRepresentation, yOffset = 4): THREE.Mesh {
    const sampledPoints = densifyPoints(points, terrain?.metadata.cell_size_m ?? 10);
    const positions: number[] = [];
    const indices: number[] = [];
    let vertexOffset = 0;
    for (let index = 0; index < sampledPoints.length - 1; index += 1) {
      const [x1, z1] = sampledPoints[index];
      const [x2, z2] = sampledPoints[index + 1];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const length = Math.hypot(dx, dz) || 1;
      const nx = (-dz / length) * (widthM / 2);
      const nz = (dx / length) * (widthM / 2);
      positions.push(
        x1 + nx,
        elevationNear(x1, z1) + yOffset,
        z1 + nz,
        x1 - nx,
        elevationNear(x1, z1) + yOffset,
        z1 - nz,
        x2 + nx,
        elevationNear(x2, z2) + yOffset,
        z2 + nz,
        x2 - nx,
        elevationNear(x2, z2) + yOffset,
        z2 - nz
      );
      indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2, vertexOffset + 2, vertexOffset + 1, vertexOffset + 3);
      vertexOffset += 4;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4
      })
    );
    mesh.renderOrder = 5;
    return mesh;
  }

  function routeLineFromPoints(points: Array<[number, number]>): THREE.Line {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points.map(([x, z]) => new THREE.Vector3(x, elevationNear(x, z) + 9, z))),
      new THREE.LineBasicMaterial({ color: "#ffef66" })
    );
    line.renderOrder = 10;
    return line;
  }

  function choreTasks(): ChoreTask[] {
    return choreRoutes?.tasks ?? choreRoutes?.chores ?? [];
  }

  function stopPointId(stop: ItineraryStop): string {
    return stop.location_id ?? stop.point_id;
  }

  function actionDuration(task: ChoreTask): number {
    return task.stops.reduce((sum, stop) => sum + (stop.expected_duration_minutes ?? 0), 0) || task.action_time_minutes || 0;
  }

  function modeAdjustedTime(task: ChoreTask, useWinter: boolean, forceLoaded: boolean): number {
    const travelTime = task.legs.reduce((sum, leg) => sum + modeAdjustedLegTime(leg, useWinter, forceLoaded), 0);
    return travelTime + actionDuration(task);
  }

  function modeAdjustedEffort(task: ChoreTask, useWinter: boolean, forceLoaded: boolean): number {
    const travelTime = task.legs.reduce((sum, leg) => sum + modeAdjustedLegTime(leg, useWinter, forceLoaded), 0);
    const weighted = task.legs.reduce((sum, leg) => {
      const legTime = modeAdjustedLegTime(leg, useWinter, forceLoaded);
      let effort = useWinter ? leg.winter_effort_multiplier : leg.effort_multiplier;
      if (forceLoaded && leg.load === "unloaded") effort *= 1.18;
      if (!forceLoaded && leg.load === "loaded") effort /= 1.18;
      return sum + effort * legTime;
    }, 0);
    return Math.max(1, weighted / Math.max(0.1, travelTime));
  }

  function modeAdjustedLegTime(leg: ChoreLeg, useWinter: boolean, forceLoaded: boolean): number {
    const nativeTime = useWinter ? leg.winter_time_minutes : leg.estimated_time_minutes;
    if (forceLoaded && leg.load === "unloaded") return nativeTime * 1.28;
    if (!forceLoaded && leg.load === "loaded") return nativeTime / 1.28;
    return nativeTime;
  }

  function pointLabel(pointId: string): string {
    const point = choreRoutes?.points.find((item) => item.id === pointId);
    return point?.label ?? pointId.replaceAll("_", " ");
  }

  function stopMarker(pointId: string, index: number): THREE.Mesh | undefined {
    const point = choreRoutes?.points.find((item) => item.id === pointId);
    if (!point) return undefined;
    const geometry = new THREE.SphereGeometry(index === 0 ? 5 : 3.8, 14, 10);
    const material = new THREE.MeshBasicMaterial({ color: index === 0 ? "#ffffff" : "#ffef66", depthWrite: false });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(point.x_m, elevationNear(point.x_m, point.z_m) + 13, point.z_m);
    marker.renderOrder = 12;
    return marker;
  }

  function stopActionText(stop: ItineraryStop): string {
    const bits = [
      `${stop.action} (${stop.expected_duration_minutes.toFixed(0)} min)`,
      stop.carried_item ? `${stop.load ?? "unloaded"}: ${stop.carried_item}` : stop.load,
      stop.produces?.length ? `makes ${stop.produces.join(", ")}` : "",
      stop.consumes?.length ? `uses ${stop.consumes.join(", ")}` : ""
    ].filter(Boolean);
    return bits.join(" · ");
  }

  function renderSelectedRoute(): void {
    clearObject(routeGroup);
    routeGroup.clear();
    const tasks = choreTasks();
    const route = tasks.find((task) => task.id === selectedRouteId || task.task_id === selectedRouteId) ?? tasks[0];
    if (!route) return;
    selectedRouteId = route.id;
    routeGroup.add(routeLineFromPoints(route.path));
    route.stops.forEach((stop, index) => {
      const marker = stopMarker(stopPointId(stop), index);
      if (marker) routeGroup.add(marker);
    });
  }

  function renderRouteControls(): void {
    if (!routeControlsEl || !choreRoutes) return;
    const tasks = choreTasks();
    routeControlsEl.innerHTML = `
      <select id="route-select">
        ${tasks.map((task) => `<option value="${task.id}" ${task.id === selectedRouteId ? "selected" : ""}>${task.title ?? task.label}</option>`).join("")}
      </select>
      <div class="route-mode">
        <button class="${!winterMode ? "active" : ""}" data-route-mode="normal">Normal</button>
        <button class="${winterMode ? "active" : ""}" data-route-mode="winter">Winter</button>
      </div>
      <div class="route-mode">
        <button class="${!forceLoadedMode ? "active" : ""}" data-load-mode="unloaded">Unloaded</button>
        <button class="${forceLoadedMode ? "active" : ""}" data-load-mode="loaded">Loaded</button>
      </div>
    `;
  }

  function renderRouteSummary(): void {
    if (!routeSummaryEl || !choreRoutes) return;
    const tasks = choreTasks();
    const weeklyMinutes = tasks.reduce((sum, task) => sum + modeAdjustedTime(task, winterMode, forceLoadedMode) * task.frequency_per_week, 0);
    const weeklyDistance = tasks.reduce((sum, task) => sum + task.distance_m * task.frequency_per_week, 0);
    const hardest = [...tasks].sort(
      (a, b) => modeAdjustedTime(b, winterMode, forceLoadedMode) * modeAdjustedEffort(b, winterMode, forceLoadedMode) - modeAdjustedTime(a, winterMode, forceLoadedMode) * modeAdjustedEffort(a, winterMode, forceLoadedMode)
    )[0];
    const selected = tasks.find((task) => task.id === selectedRouteId || task.task_id === selectedRouteId) ?? tasks[0];
    const stopRows = selected?.stops
      .map((stop, index) => {
        const leg = selected.legs[index];
        const next = leg ? `${leg.distance_m.toFixed(0)} m, ${modeAdjustedLegTime(leg, winterMode, forceLoadedMode).toFixed(1)} min to ${pointLabel(leg.to)}` : "complete";
        return `<div class="stop-row"><span>${index + 1}. ${pointLabel(stopPointId(stop))}</span><span>${stopActionText(stop)} · next: ${next}</span></div>`;
      })
      .join("");
    const legRows = selected?.legs
      .map(
        (leg) =>
          `<div class="leg-row"><span>${pointLabel(leg.from)} -> ${pointLabel(leg.to)}</span><span>${leg.distance_m.toFixed(0)} m · ${modeAdjustedLegTime(leg, winterMode, forceLoadedMode).toFixed(1)} min · ${forceLoadedMode && leg.load === "unloaded" ? "loaded" : !forceLoadedMode && leg.load === "loaded" ? "unloaded" : leg.load}${leg.carried_item ? ` · ${leg.carried_item}` : ""}</span></div>`
      )
      .join("");
    routeSummaryEl.innerHTML = `
      <dt>Daily time</dt><dd>${(weeklyMinutes / 7).toFixed(1)} min</dd>
      <dt>Daily walking</dt><dd>${choreRoutes.summary.daily_walking_time_minutes.toFixed(1)} min</dd>
      <dt>Weekly distance</dt><dd>${(weeklyDistance / 1000).toFixed(2)} km</dd>
      <dt>Winter burden</dt><dd>${(tasks.reduce((sum, task) => sum + modeAdjustedTime(task, true, forceLoadedMode) * task.frequency_per_week, 0) / 7).toFixed(1)} min/day</dd>
      <dt>Hardest</dt><dd>${hardest?.title ?? hardest?.label ?? "none"}</dd>
      <dt>Selected</dt><dd>${selected ? `${selected.distance_m.toFixed(0)} m, ${modeAdjustedTime(selected, winterMode, forceLoadedMode).toFixed(1)} min total (${selected.travel_time_minutes.toFixed(1)} travel + ${actionDuration(selected).toFixed(1)} action), ${modeAdjustedEffort(selected, winterMode, forceLoadedMode).toFixed(2)}x` : "none"}</dd>
      <dt>Itinerary</dt><dd class="route-details">${stopRows || "none"}</dd>
      <dt>Legs</dt><dd class="route-details">${legRows || "none"}</dd>
    `;
  }

  function renderRouteUi(): void {
    if (choreRoutes && !selectedRouteId) selectedRouteId = choreTasks()[0]?.id ?? "";
    renderRouteControls();
    renderRouteSummary();
    renderSelectedRoute();
  }

  function rebuildBaseProperty(): void {
    clearObject(basePropertyGroup);
    basePropertyGroup.clear();
    if (!terrain) return;
    const maxX = (terrain.metadata.grid_width - 1) * terrain.metadata.cell_size_m;
    const maxZ = (terrain.metadata.grid_height - 1) * terrain.metadata.cell_size_m;
    basePropertyGroup.add(lineFromPoints([[0, 0], [maxX, 0], [maxX, maxZ], [0, maxZ], [0, 0]], "#d6d2bc", 2.8));
    const road = layout?.elements.find((element) => element.type === "adjacent_road" && element.points);
    if (road?.points) {
      basePropertyGroup.add(stripFromPoints(road.points, road.width_m ?? 8, "#6d716a", 5));
      basePropertyGroup.add(lineFromPoints(road.points, "#e7dec4", 6));
    }
  }

  function rebuildLayout(): void {
    clearObject(layoutGroup);
    layoutGroup.clear();
    addonLayerGroups.clear();
    for (const addonId of Object.keys(addonLabels) as AddonId[]) {
      const group = new THREE.Group();
      group.name = addonId;
      addonLayerGroups.set(addonId, group);
      layoutGroup.add(group);
    }
    if (!layout) return;
    const yurts = layout.elements.filter((element) => element.type === "yurt");
    const yurtMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.42, 18),
      new THREE.MeshStandardMaterial({ color: "#f1d99b", roughness: 0.7 }),
      yurts.length
    );
    const matrix = new THREE.Matrix4();
    yurts.forEach((yurt, index) => {
      matrix.compose(
        new THREE.Vector3(yurt.x_m, elevationNear(yurt.x_m, yurt.z_m) + 2.2, yurt.z_m),
        new THREE.Quaternion(),
        new THREE.Vector3(yurt.radius_m ?? 4.5, 10, yurt.radius_m ?? 4.5)
      );
      yurtMesh.setMatrixAt(index, matrix);
    });
    addonLayerGroups.get("yurts")?.add(yurtMesh);
    for (const element of layout.elements.filter((item) => item.type !== "yurt" && item.type !== "adjacent_road")) {
      const group = addonLayerGroups.get(addonForType(element.type));
      if (!group) continue;
      if (element.points) {
        const color = element.type === "swale" ? "#4f93a0" : element.type === "road_service_access" ? "#7f7b6e" : "#f0d992";
        group.add(stripFromPoints(element.points, element.width_m ?? (element.type === "swale" ? 4 : 1.5), color, 5));
      } else if (element.type === "building_envelope_1ha") {
        const halfWidth = (element.width_m ?? 100) / 2;
        const halfLength = (element.length_m ?? 100) / 2;
        const corners: Array<[number, number]> = [
          [element.x_m - halfWidth, element.z_m - halfLength],
          [element.x_m + halfWidth, element.z_m - halfLength],
          [element.x_m + halfWidth, element.z_m + halfLength],
          [element.x_m - halfWidth, element.z_m + halfLength],
          [element.x_m - halfWidth, element.z_m - halfLength]
        ];
        group.add(lineFromPoints(corners, "#f2c14e", 2.2));
      } else {
        const width = element.width_m ?? element.radius_m ?? 8;
        const length = element.length_m ?? element.radius_m ?? 8;
        const height = element.type === "pond" || element.type === "swale" ? 0.45 : 4;
        const material = new THREE.MeshStandardMaterial({
          color: element.type === "pond" || element.type === "swale" || element.type === "water_storage" ? "#4f93a0" : "#b68a55",
          transparent: element.type === "swale",
          opacity: element.type === "swale" ? 0.55 : 1
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), material);
        mesh.position.set(element.x_m, elevationNear(element.x_m, element.z_m) + height / 2, element.z_m);
        group.add(mesh);
      }
    }
    applyAddonVisibility();
  }

  function renderCandidates(): void {
    if (candidateSelectEl) {
      candidateSelectEl.innerHTML = candidates.candidates
        .map((candidate) => `<option value="${candidate.id}" ${candidate.id === activeCandidateId ? "selected" : ""}>${candidateLabel(candidate)}</option>`)
        .join("");
    }
    if (candidatesEl) {
      candidatesEl.innerHTML = candidates.candidates
      .map(
        (candidate) => `
          <li>
            <button type="button" class="candidate-row ${candidate.id === activeCandidateId ? "active" : ""}" data-candidate="${candidate.id}">
              <span class="candidate-name">${candidate.name}</span>
              <span class="candidate-meta">${candidate.score_total.toFixed(3)} score · ${candidate.area_ha} ha · ${candidate.distance_to_owen_sound_km} km · ${candidate.source_quality}</span>
              <span class="candidate-meta">${candidate.lotcon_id} · lot/concession proxy, not legal parcel</span>
            </button>
          </li>`
      )
      .join("");
    }
  }

  function renderOverlayButtons(): void {
    if (!buttonsEl) return;
    buttonsEl.innerHTML = overlays.overlays
      .map((overlay) => `<button class="${overlay.id === activeOverlay ? "active" : ""}" data-overlay="${overlay.id}">${overlay.hotkey} ${overlay.label}</button>`)
      .join("");
  }

  function renderAddonToggles(): void {
    if (!addonTogglesEl) return;
    addonTogglesEl.innerHTML = (Object.entries(addonLabels) as Array<[AddonId, string]>)
      .map(
        ([id, label]) => `
          <label class="addon-toggle">
            <input type="checkbox" data-addon="${id}" ${addonVisibility[id] ? "checked" : ""} />
            <span>${label}</span>
          </label>`
      )
      .join("");
  }

  function inspect(cell: TerrainCell | undefined): void {
    if (!inspectorEl || !cell) return;
    inspectorEl.innerHTML = `
      <dt>Cell</dt><dd>${cell.id}</dd>
      <dt>Elevation</dt><dd>${cell.elevation_m.toFixed(1)} m</dd>
      <dt>Slope</dt><dd>${cell.slope_degrees.toFixed(1)} deg</dd>
      <dt>Solar</dt><dd>${cell.solar_score.toFixed(2)}</dd>
      <dt>Wetness</dt><dd>${cell.wetness_index.toFixed(2)}</dd>
      <dt>Best uses</dt><dd>${cell.best_uses.join(", ")}</dd>
      <dt>Warnings</dt><dd>${cell.warnings.join(", ") || "none"}</dd>
    `;
  }

  async function loadCandidate(candidateId: string): Promise<void> {
    const candidate = candidates.candidates.find((item) => item.id === candidateId);
    if (!candidate) {
      setCandidateStatus(`Unknown candidate: ${candidateId}`, "error");
      return;
    }
    const sequence = (loadSequence += 1);
    try {
      setCandidateStatus(`Loading ${candidate.name}: site...`, "loading");
      renderCandidates();
      const nextSite = await fetchJson<Site>(`${basePath}/sites/${candidateId}/site.json`);
      setCandidateStatus(`Loading ${candidate.name}: terrain...`, "loading");
      const nextTerrain = await fetchJson<TerrainGrid>(`${basePath}/sites/${candidateId}/terrain_grid.json`, 45000);
      setCandidateStatus(`Loading ${candidate.name}: layout file...`, "loading");
      const nextLayout = await fetchJson<HamletLayout>(`${basePath}/sites/${candidateId}/hamlet_layout.json`);
      setCandidateStatus(`Loading ${candidate.name}: chore routes...`, "loading");
      const nextChoreRoutes = await fetchJson<ChoreRouteSet>(`${basePath}/sites/${candidateId}/chore_routes.json`);
      if (sequence !== loadSequence) return;
      setCandidateStatus(`Loading ${candidate.name}: drawing terrain...`, "loading");
      activeCandidateId = candidateId;
      site = nextSite;
      terrain = nextTerrain;
      layout = nextLayout;
      choreRoutes = nextChoreRoutes;
      selectedRouteId = choreTasks()[0]?.id ?? "";
      if (terrainMesh) {
        scene.remove(terrainMesh);
        clearObject(terrainMesh);
      }
      terrainMesh = buildTerrainMesh(terrain);
      scene.add(terrainMesh);
      const centerX = ((terrain.metadata.grid_width - 1) * terrain.metadata.cell_size_m) / 2;
      const centerZ = ((terrain.metadata.grid_height - 1) * terrain.metadata.cell_size_m) / 2;
      controls.target.set(centerX, 12, centerZ);
      controls.update();
      setCandidateStatus(`Loading ${candidate.name}: layout...`, "loading");
      rebuildLayout();
      rebuildBaseProperty();
      setCandidateStatus(`Loading ${candidate.name}: chores...`, "loading");
      renderRouteUi();
      inspect(terrain.cells[Math.floor(terrain.cells.length / 2)]);
      renderCandidates();
      setCandidateStatus(`Showing ${candidate.name}`, "idle");
    } catch (error: unknown) {
      if (sequence !== loadSequence) return;
      const detail = error instanceof Error ? error.message : String(error);
      setCandidateStatus(`Could not load ${candidate.name}: ${detail}`, "error");
      console.error(error);
      renderCandidates();
    }
  }

  function selectCandidateFromEvent(event: Event): void {
    const row = (event.target as HTMLElement).closest<HTMLElement>("[data-candidate]");
    if (!row?.dataset.candidate) return;
    event.preventDefault();
    void loadCandidate(row.dataset.candidate);
  }

  candidatesEl?.addEventListener("click", selectCandidateFromEvent);
  candidatesEl?.addEventListener("pointerup", (event) => {
    if ((event as PointerEvent).pointerType === "mouse") return;
    selectCandidateFromEvent(event);
  });

  candidateSelectEl?.addEventListener("change", (event) => {
    const select = event.target as HTMLSelectElement;
    if (select.value) void loadCandidate(select.value);
  });

  buttonsEl?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const overlay = target.dataset.overlay;
    if (!overlay) return;
    activeOverlay = overlay;
    updateTerrainColors();
    renderOverlayButtons();
  });

  addonTogglesEl?.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement;
    const addon = input.dataset.addon as AddonId | undefined;
    if (!addon || !(addon in addonVisibility)) return;
    addonVisibility[addon] = input.checked;
    applyAddonVisibility();
  });

  routeControlsEl?.addEventListener("change", (event) => {
    const select = event.target as HTMLSelectElement;
    if (select.id !== "route-select") return;
    selectedRouteId = select.value;
    renderRouteUi();
  });

  routeControlsEl?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.dataset.routeMode) winterMode = target.dataset.routeMode === "winter";
    if (target.dataset.loadMode) forceLoadedMode = target.dataset.loadMode === "loaded";
    if (target.dataset.routeMode || target.dataset.loadMode) renderRouteUi();
  });

  window.addEventListener("keydown", (event) => {
    const overlay = overlays.overlays.find((item) => item.hotkey === event.key);
    if (!overlay) return;
    activeOverlay = overlay.id;
    updateTerrainColors();
    renderOverlayButtons();
  });

  function resize(): void {
    const { clientWidth, clientHeight } = sceneCanvas;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  }

  sceneCanvas.addEventListener("pointermove", (event) => {
    const rect = sceneCanvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  });

  function animate(): void {
    resize();
    if (terrain && terrainMesh) {
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(terrainMesh)[0];
      if (hit) {
        const x = Math.round(hit.point.x / terrain.metadata.cell_size_m);
        const z = Math.round(hit.point.z / terrain.metadata.cell_size_m);
        inspect(terrain.cells[z * terrain.metadata.grid_width + x]);
      }
    }
    if (hudEl) {
      const selected = selectedCandidate();
      const warnings = layout?.metadata.warnings?.length ? ` · ${layout.metadata.warnings.join(" ")}` : "";
      hudEl.textContent = `${selected?.name ?? site.name} · base lot/concession proxy visible · ${terrain?.metadata.cell_size_m ?? "?"} m grid · ${terrain?.metadata.terrain_source ?? site.terrain_source} · ${activeOverlay}${warnings}`;
    }
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  renderCandidates();
  renderOverlayButtons();
  renderAddonToggles();
  await loadCandidate(activeCandidateId);
  animate();
}

if (window.location.pathname === "/canvassing" || window.location.pathname === "/canvassing/") {
  import("./canvassing").then(({ canvassingMain }) => canvassingMain()).catch(console.error);
} else {
  main().catch((error: unknown) => console.error(error));
}
