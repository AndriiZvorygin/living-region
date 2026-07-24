import maplibregl, {
  type GeoJSONSource,
  type MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./canvassing.css";
import { WalkingRoadGraph, metresBetween } from "./canvassing-routing";

type Household = {
  household_id: string;
  address_id: string;
  structure_id: string | null;
  label: string;
  civic_number: string;
  street: string;
  unit: string;
  lon: number;
  lat: number;
  association_status: string;
  status: string;
  flyer_delivered: number;
  door_knocked: number;
  visit_count: number;
};
type RouteStop = {
  id: string;
  route_id: string;
  household_id: string;
  sequence: number;
  completed_at: string | null;
  skipped: number;
  label: string;
  civic_number: string;
  street: string;
  lon: number;
  lat: number;
};
type FollowupSample = {
  id: string;
  source_route_id: string;
  source_route_name: string;
  followup_route_id: string | null;
  followup_route_name: string | null;
  sampling_mode: "percentage" | "target_count";
  percentage: number | null;
  target_count: number | null;
  seed: string;
  status: "draft" | "accepted" | "cancelled";
  flyer_date: string;
  scheduled_for: string;
  schedule_state: "upcoming" | "due" | "overdue";
  household_ids: string[];
};
type RecruitmentArea = { id: string; name: string; status: string };
type RecruitmentProspect = {
  id: string;
  area_id: string;
  area_name: string;
  display_name: string | null;
  household_id: string | null;
  role_interest: string;
  status: string;
};
type SessionSummary = {
  session_id: string;
  route_id: string;
  started_at: string;
  ended_at: string | null;
  paused: boolean;
  elapsed_active_minutes: number;
  pause_minutes: number;
  flyers_used: number;
  stops_attempted: number;
  doors_knocked: number;
  answers: number;
  conversations: number;
  revisits: number;
  skipped_stops: number;
  completed_stops_per_hour: number;
};
type State = {
  households: Household[];
  routes: Array<{
    id: string;
    name: string;
    status: string;
    stop_count: number;
    completed_count: number;
    route_kind: "flyer_delivery" | "followup_canvass";
    source_route_id: string | null;
    scheduled_for: string | null;
  }>;
  route_stops: RouteStop[];
  route_sessions: SessionSummary[];
  followup_samples: FollowupSample[];
  neighbourhood_conversations: Array<Record<string, unknown>>;
  recruitment_areas: RecruitmentArea[];
  recruitment_prospects: RecruitmentProspect[];
  address_review_counts: Record<string, number>;
  schema_version: number;
  summary: Record<string, number>;
};
type FieldPrefs = {
  route_id: string;
  household_id: string;
  center: [number, number];
  zoom: number;
  status_filter: string;
  volunteer: boolean;
  session_id: string;
  route_index: number;
};
const statusColors: Record<string, string> = {
  untouched: "#8b9297",
  flyer_delivered: "#edc949",
  knocked_no_answer: "#4e79a7",
  conversation: "#45a36d",
  revisit: "#e88935",
  supportive: "#45a36d",
  undecided: "#edc949",
  opposed: "#b34d4d",
  volunteer_interest: "#8f63b8",
  lawn_sign_interest: "#8f63b8",
  inaccessible: "#b34d4d",
  vacant: "#727b80",
  no_campaign_material_requested: "#8e2f3d",
};
const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const role = document.querySelector<HTMLInputElement>("#volunteer-mode")
    ?.checked
    ? "volunteer"
    : "candidate";
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-canvass-role": role,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};
const geo = async (url: string) => fetchJson<any>(url);

export async function canvassingMain() {
  const saved = JSON.parse(
    localStorage.getItem("living-region.canvassing.field-state") ?? "{}",
  ) as Partial<FieldPrefs>;
  const persist = (patch: Partial<FieldPrefs> = {}) => {
    const current = JSON.parse(
      localStorage.getItem("living-region.canvassing.field-state") ?? "{}",
    ) as Partial<FieldPrefs>;
    localStorage.setItem(
      "living-region.canvassing.field-state",
      JSON.stringify({ ...current, ...patch }),
    );
  };
  document.title = "Owen Sound Canvassing | Living Region";
  document.body.innerHTML = `<div class="canvass-shell">
    <header><div><strong>Owen Sound Canvassing</strong><span>Private campaign workspace</span></div><nav><button id="coverage-toggle">Coverage</button><button id="followup-open">Follow-ups</button><button id="conversation-open">Conversation</button><button id="recruitment-open">Recruitment</button><button id="quality-open">Address quality</button><button id="print-route">Print</button><a class="button" href="/api/canvassing/export/routes.csv">Export CSV</a><button id="import-open">Import</button></nav><span class="backup-warning" id="backup-warning"></span></header>
    <aside class="summary" id="summary"></aside><main id="canvass-map"></main>
    <section class="drawer" id="drawer"><div class="empty"><strong>Select a roof or address</strong><span>Click households to inspect them or add them to a route.</span></div></section>
    <footer><div class="route-builder"><input id="route-name" placeholder="New route name"><select id="street-side"><option value="">Both sides</option><option value="left">Left side</option><option value="right">Right side</option></select><button id="create-route">Create <span id="selection-count">0</span></button><button id="bulk-flyer">Flyer selected</button></div><div class="route-run"><select id="active-route"><option value="">Choose route</option></select><button id="session-toggle">Start</button><button id="undo-stop">Undo</button><button id="field-conversation">Conversation</button><button id="previous-stop">Previous</button><button id="next-stop">Next</button><button id="locate">Locate</button><button id="recenter" disabled>Recenter</button><span id="route-progress"></span></div><label><input id="volunteer-mode" type="checkbox"> Volunteer delivery mode</label><label>Status <select id="status-filter"><option value="all">All</option>${Object.keys(
      statusColors,
    )
      .map((s) => `<option value="${s}">${s.replaceAll("_", " ")}</option>`)
      .join("")}</select></label></footer>
    <section class="session-strip" id="session-strip"></section>
    <dialog id="import-dialog"><form method="dialog"><h2>Import existing records</h2><p>CSV fields: address, date_met, person_name, outcome, issues, notes, follow_up, support_level.</p><input id="csv-file" type="file" accept=".csv,text/csv"><menu><button value="cancel">Cancel</button><button id="import-submit" value="default">Import</button></menu></form></dialog>
    <dialog id="followup-dialog" class="workflow-dialog"><h2>Weekly follow-ups</h2><div id="followup-workspace"></div><menu><button type="button" data-close="followup-dialog">Close</button></menu></dialog>
    <dialog id="conversation-dialog" class="workflow-dialog"><h2>Neighbourhood conversation</h2><form id="conversation-form" class="workflow-form"><label>Issue discussed<input id="conversation-issue" required></label><label>Political outcome<select id="conversation-outcome"><option value="">Not recorded</option><option value="supportive">Supportive</option><option value="undecided">Undecided</option><option value="opposed">Opposed</option></select></label><label><input id="conversation-volunteer" type="checkbox"> Possible volunteer</label><label><input id="conversation-representative" type="checkbox"> Possible Local Representative</label><label><input id="conversation-councillor" type="checkbox"> Possible councillor candidate</label><label><input id="conversation-followup" type="checkbox"> Follow-up requested</label><label><input id="conversation-household" type="checkbox"> Associate selected household</label><label><input id="conversation-complete" type="checkbox"> Complete selected household attempt</label><button>Record conversation</button></form><menu><button type="button" data-close="conversation-dialog">Close</button></menu></dialog>
    <dialog id="recruitment-dialog" class="workflow-dialog"><h2>Candidate recruitment</h2><div id="recruitment-workspace"></div><menu><button type="button" data-close="recruitment-dialog">Close</button></menu></dialog>
    <dialog id="quality-dialog" class="workflow-dialog"><h2>Address quality</h2><div id="quality-metrics"></div><div id="quality-queue"></div><menu><button type="button" data-close="quality-dialog">Close</button></menu></dialog>
    <div class="toast" id="toast"></div></div>`;
  document.querySelector<HTMLInputElement>("#volunteer-mode")!.checked =
    saved.volunteer ?? false;
  let state = await fetchJson<State>("/api/canvassing/state");
  const [structures, addresses, roads, boundary, addressQuality] =
    await Promise.all([
      geo("/canvassing/structures.geojson"),
      geo("/canvassing/addresses.geojson"),
      geo("/canvassing/roads.geojson"),
      geo("/canvassing/boundary.geojson"),
      geo("/canvassing/address-quality.json"),
    ]);
  const walkingGraph = new WalkingRoadGraph(roads);
  const byStructure = new Map<string, Household[]>();
  for (const h of state.households) {
    if (h.structure_id)
      byStructure.set(h.structure_id, [
        ...(byStructure.get(h.structure_id) ?? []),
        h,
      ]);
  }
  const selected = new Set<string>();
  let active: Household | undefined;
  let coverage = false;
  let routeIndex = saved.route_index ?? 0;
  let activeSessionId = saved.session_id ?? "";
  let sessionPaused = false;
  let submitting = false;
  let currentPosition: GeolocationPosition | undefined;
  let locationWatch: number | undefined;
  const statusRank = (s: string) =>
    [
      "untouched",
      "flyer_delivered",
      "knocked_no_answer",
      "conversation",
      "undecided",
      "supportive",
      "opposed",
      "revisit",
      "volunteer_interest",
      "lawn_sign_interest",
      "vacant",
      "inaccessible",
      "no_campaign_material_requested",
    ].indexOf(s);
  for (const f of structures.features) {
    const homes = byStructure.get(f.properties.structure_id) ?? [];
    f.properties.household_count = homes.length;
    f.properties.status =
      homes.sort((a, b) => statusRank(b.status) - statusRank(a.status))[0]
        ?.status ?? "untouched";
  }
  for (const f of addresses.features) {
    const home = state.households.find(
      (h) => h.address_id === f.properties.address_id,
    );
    f.properties.household_id = home?.household_id;
    f.properties.status = home?.status ?? "untouched";
  }
  const map = new maplibregl.Map({
    container: "canvass-map",
    center: saved.center ?? [-80.943, 44.567],
    zoom: saved.zoom ?? 13.3,
    minZoom: 11,
    maxZoom: 20,
    style: {
      version: 8,
      sources: {},
      layers: [
        {
          id: "background",
          type: "background",
          paint: { "background-color": "#eef0eb" },
        },
      ],
    },
  });
  map.addControl(
    new maplibregl.NavigationControl({ showCompass: false }),
    "bottom-right",
  );
  let labelMarkers: maplibregl.Marker[] = [];
  const updateLabels = () => {
    labelMarkers.forEach((marker) => marker.remove());
    labelMarkers = [];
    if (map.getZoom() < 14) return;
    const bounds = map.getBounds(),
      seen = new Set<string>();
    for (const feature of roads.features) {
      const name = String(feature.properties.name ?? "");
      if (!name || seen.has(name)) continue;
      const line =
        feature.geometry.type === "MultiLineString"
          ? feature.geometry.coordinates[0]
          : feature.geometry.coordinates;
      const point = line[Math.floor(line.length / 2)];
      if (!bounds.contains(point)) continue;
      seen.add(name);
      const element = document.createElement("span");
      element.className = "road-name";
      element.textContent = name;
      labelMarkers.push(
        new maplibregl.Marker({ element }).setLngLat(point).addTo(map),
      );
      if (labelMarkers.length >= 70) break;
    }
    if (map.getZoom() >= 17) {
      for (const feature of addresses.features) {
        const point = feature.geometry.coordinates;
        if (!bounds.contains(point)) continue;
        const element = document.createElement("span");
        element.className = "address-number";
        element.textContent = String(feature.properties.civic_number ?? "");
        labelMarkers.push(
          new maplibregl.Marker({ element }).setLngLat(point).addTo(map),
        );
        if (labelMarkers.length >= 180) break;
      }
    }
  };
  map.on("moveend", updateLabels);
  map.on("zoomend", updateLabels);
  map.on("load", () => {
    map.addSource("boundary", { type: "geojson", data: boundary });
    map.addLayer({
      id: "boundary",
      type: "line",
      source: "boundary",
      paint: {
        "line-color": "#1e5b4a",
        "line-width": 2,
        "line-dasharray": [3, 2],
      },
    });
    map.addSource("roads", { type: "geojson", data: roads });
    map.addLayer({
      id: "road-casing",
      type: "line",
      source: "roads",
      paint: {
        "line-color": "#c8ccc8",
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.5, 17, 8],
      },
    });
    map.addLayer({
      id: "roads",
      type: "line",
      source: "roads",
      paint: {
        "line-color": "#fff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.7, 17, 5],
      },
    });
    const statusExpression = [
      "match",
      ["get", "status"],
      ...Object.entries(statusColors).flat(),
      "#8b9297",
    ] as any;
    map.addSource("structures", {
      type: "geojson",
      data: structures,
      promoteId: "structure_id",
    });
    map.addLayer({
      id: "structures",
      type: "fill",
      source: "structures",
      minzoom: 13,
      paint: {
        "fill-color": statusExpression,
        "fill-opacity": [
          "case",
          [">", ["get", "household_count"], 0],
          0.82,
          0.32,
        ],
        "fill-outline-color": "#4f5754",
      },
    });
    map.addSource("addresses", {
      type: "geojson",
      data: addresses,
      cluster: true,
      clusterRadius: 42,
      clusterMaxZoom: 14,
      promoteId: "address_id",
    });
    map.addLayer({
      id: "address-clusters",
      type: "circle",
      source: "addresses",
      filter: ["has", "point_count"],
      maxzoom: 15,
      paint: {
        "circle-color": "#275d50",
        "circle-radius": ["step", ["get", "point_count"], 14, 50, 20, 200, 28],
        "circle-opacity": 0.86,
      },
    });
    map.addLayer({
      id: "address-points",
      type: "circle",
      source: "addresses",
      filter: ["!", ["has", "point_count"]],
      minzoom: 14,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 2.5, 18, 5],
        "circle-color": statusExpression,
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 1,
      },
    });
    map.addSource("active-route", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "active-route-line",
      type: "line",
      source: "active-route",
      filter: ["==", ["geometry-type"], "LineString"],
      paint: {
        "line-color": "#182b68",
        "line-width": 4,
        "line-dasharray": [2, 1],
      },
    });
    map.addLayer({
      id: "active-route-stops",
      type: "circle",
      source: "active-route",
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-color": "#fff",
        "circle-stroke-color": "#182b68",
        "circle-stroke-width": 3,
        "circle-radius": 6,
      },
    });
    map.addSource("current-location", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "location-accuracy",
      type: "fill",
      source: "current-location",
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "fill-color": "#2474c6",
        "fill-opacity": 0.12,
        "fill-outline-color": "#2474c6",
      },
    });
    map.addLayer({
      id: "location-point",
      type: "circle",
      source: "current-location",
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-color": "#2474c6",
        "circle-radius": 7,
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 3,
      },
    });
    const restoredFilter = saved.status_filter ?? "all";
    map.setFilter(
      "structures",
      restoredFilter === "all"
        ? null
        : ["==", ["get", "status"], restoredFilter],
    );
    map.setFilter(
      "address-points",
      restoredFilter === "all"
        ? ["!", ["has", "point_count"]]
        : [
            "all",
            ["!", ["has", "point_count"]],
            ["==", ["get", "status"], restoredFilter],
          ],
    );
    map.on("click", "structures", pickStructure);
    map.on("click", "address-points", pickAddress);
    map.on("click", "address-clusters", async (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const zoom = await (
        map.getSource("addresses") as GeoJSONSource
      ).getClusterExpansionZoom(Number(feature.properties?.cluster_id));
      map.easeTo({ center: (feature.geometry as any).coordinates, zoom });
    });
    for (const layer of ["structures", "address-points"]) {
      map.on(
        "mouseenter",
        layer,
        () => (map.getCanvas().style.cursor = "pointer"),
      );
      map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
    }
    updateLabels();
    renderRoutes();
  });
  map.on("moveend", () => {
    const center = map.getCenter();
    persist({ center: [center.lng, center.lat], zoom: map.getZoom() });
  });
  const toast = (message: string) => {
    const el = document.querySelector<HTMLDivElement>("#toast")!;
    el.textContent = message;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2200);
  };
  function renderSummary() {
    const s = state.summary,
      total = Number(s.total_households);
    document.querySelector("#summary")!.innerHTML =
      `<dl><div><dt>Households</dt><dd>${total.toLocaleString()}</dd></div><div><dt>Flyers</dt><dd>${s.flyers_delivered}</dd></div><div><dt>Knocked</dt><dd>${s.doors_knocked}</dd></div><div><dt>Answers</dt><dd>${s.answers}</dd></div><div><dt>Talked</dt><dd>${s.conversations}</dd></div><div><dt>Revisit</dt><dd>${s.revisits}</dd></div><div><dt>Untouched</dt><dd>${s.untouched_households}</dd></div><div><dt>Per hour</dt><dd>${s.households_completed_per_hour}</dd></div><div><dt>Answer rate</dt><dd>${s.answer_rate}%</dd></div></dl><div class="legend">${Object.entries(
        statusColors,
      )
        .map(
          ([s, c]) =>
            `<span><i style="background:${c}"></i>${s.replaceAll("_", " ")}</span>`,
        )
        .join("")}</div>`;
    renderRoutes();
    renderSession();
  }
  function pickStructure(
    e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
  ) {
    const id = String(e.features?.[0]?.properties?.structure_id ?? "");
    const homes = byStructure.get(id) ?? [];
    if (!homes.length)
      return toast("No civic address is linked to this structure");
    persist({ household_id: homes[0].household_id });
    showHouseholds(homes);
  }
  function pickAddress(
    e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
  ) {
    const id = String(e.features?.[0]?.properties?.household_id ?? "");
    const home = state.households.find((h) => h.household_id === id);
    if (home) {
      persist({ household_id: home.household_id });
      showHouseholds([home]);
    }
  }
  const skipCurrent = async () => {
    if (!active) return;
    const route =
        document.querySelector<HTMLSelectElement>("#active-route")!.value,
      stop = state.route_stops.find(
        (item) =>
          item.route_id === route && item.household_id === active!.household_id,
      );
    if (!stop) return toast("This address is not on the active route");
    await fetchJson(`/api/canvassing/route-stops/${stop.id}/skip`, {
      method: "POST",
      body: JSON.stringify({ session_id: activeSessionId || null }),
    });
    await refresh();
    navigateRoute(1);
    toast("Stop skipped");
  };
  function showHouseholds(homes: Household[]) {
    active = homes[0];
    const volunteer =
      document.querySelector<HTMLInputElement>("#volunteer-mode")!.checked;
    document.querySelector("#drawer")!.innerHTML =
      `<div class="drawer-head"><div><small>${homes.length > 1 ? `${homes.length} units at structure` : "Household"}</small><h2>${active.label || "Address needs review"}</h2><span>${active.association_status.replaceAll("_", " ")} · ${active.visit_count} visits</span></div><button id="add-selection">${selected.has(active.household_id) ? "Remove" : "Add to route"}</button></div>${homes.length > 1 ? `<div class="unit-tabs">${homes.map((h) => `<button data-household="${h.household_id}">${h.unit || h.label}</button>`).join("")}</div>` : ""}<div class="quick-actions"><button data-outcome="flyer_delivered">Flyer</button><button data-outcome="knocked_no_answer">No answer</button><button data-outcome="conversation">Talked</button><button data-outcome="revisit">Revisit</button><button data-outcome="inaccessible">Skip</button></div>${
        volunteer
          ? ""
          : `<div class="private-fields"><label>Outcome<select id="outcome">${Object.keys(
              statusColors,
            )
              .map(
                (s) =>
                  `<option ${s === active!.status ? "selected" : ""} value="${s}">${s.replaceAll("_", " ")}</option>`,
              )
              .join(
                "",
              )}</select></label><label>Issues<input id="issues" placeholder="housing; transit; affordability"></label><label>Private notes<textarea id="notes" rows="3"></textarea></label><label>Follow-up<input id="follow-up"></label><label>Date<input id="follow-date" type="date"></label><button id="save-detail">Save visit</button></div>`
      }`;
    const addressFeature = addresses.features.find(
        (feature: any) => feature.properties.address_id === active!.address_id,
      ),
      structureFeature = structures.features.find(
        (feature: any) =>
          feature.properties.structure_id === active!.structure_id,
      );
    const provenance = document.createElement("section");
    provenance.className = "association-review";
    provenance.innerHTML = `<h3>Building association</h3><p>${active.association_status.replaceAll("_", " ")}${structureFeature ? ` · ${structureFeature.properties.external_source} ${structureFeature.properties.external_id} · ${structureFeature.properties.confidence}` : " · point stop"}</p>`;
    if (
      !volunteer &&
      addressFeature?.properties.association_candidates?.length
    ) {
      for (const candidate of addressFeature.properties
        .association_candidates) {
        const building = structures.features.find(
          (feature: any) =>
            feature.properties.structure_id === candidate.structure_id,
        );
        const button = document.createElement("button");
        button.textContent = `Link ${building?.properties.building_type ?? "building"} · ${candidate.distance_m} m`;
        button.addEventListener("click", async () => {
          await fetchJson(
            `/api/canvassing/addresses/${active!.address_id}/association`,
            {
              method: "POST",
              body: JSON.stringify({
                structure_id: candidate.structure_id,
                reason: "manual map review",
              }),
            },
          );
          await refresh();
          toast("Association correction appended");
        });
        provenance.append(button);
      }
      const clear = document.createElement("button");
      clear.textContent = "Clear manual association";
      clear.addEventListener("click", async () => {
        await fetchJson(
          `/api/canvassing/addresses/${active!.address_id}/association`,
          {
            method: "POST",
            body: JSON.stringify({
              structure_id: null,
              reason: "manual review cleared association",
            }),
          },
        );
        await refresh();
      });
      provenance.append(clear);
      if (active.association_status === "manual_verified") {
        const undo = document.createElement("button");
        undo.textContent = "Undo latest association";
        undo.addEventListener("click", async () => {
          await fetchJson(
            `/api/canvassing/addresses/${active!.address_id}/association/undo`,
            { method: "POST", body: "{}" },
          );
          await refresh();
          toast("Association correction reversed");
        });
        provenance.append(undo);
      }
    }
    document.querySelector("#drawer")!.append(provenance);
    document.querySelector("#add-selection")!.addEventListener("click", () => {
      if (!active) return;
      selected.has(active.household_id)
        ? selected.delete(active.household_id)
        : selected.add(active.household_id);
      updateSelection();
      showHouseholds(homes);
    });
    document.querySelectorAll<HTMLElement>("[data-household]").forEach((el) =>
      el.addEventListener("click", () => {
        active = homes.find((h) => h.household_id === el.dataset.household);
        showHouseholds(homes);
      }),
    );
    document
      .querySelectorAll<HTMLElement>("[data-outcome]")
      .forEach((el) =>
        el.addEventListener("click", () =>
          el.dataset.outcome === "inaccessible"
            ? skipCurrent()
            : saveVisit(el.dataset.outcome!),
        ),
      );
    document
      .querySelector("#save-detail")
      ?.addEventListener("click", () =>
        saveVisit(
          document.querySelector<HTMLSelectElement>("#outcome")!.value,
          true,
        ),
      );
  }
  async function saveVisit(outcome: string, detailed = false) {
    if (!active || submitting) return;
    submitting = true;
    document
      .querySelectorAll<HTMLButtonElement>(".quick-actions button,#save-detail")
      .forEach((button) => (button.disabled = true));
    try {
      await fetchJson("/api/canvassing/visits", {
        method: "POST",
        body: JSON.stringify({
          submission_key: crypto.randomUUID(),
          session_id: activeSessionId || null,
          household_id: active.household_id,
          route_id:
            document.querySelector<HTMLSelectElement>("#active-route")!.value ||
            null,
          outcome,
          flyer_delivered: outcome === "flyer_delivered",
          door_knocked: [
            "knocked_no_answer",
            "conversation",
            "revisit",
            "supportive",
            "undecided",
            "opposed",
            "volunteer_interest",
            "lawn_sign_interest",
          ].includes(outcome),
          conversation_occurred: [
            "conversation",
            "supportive",
            "undecided",
            "opposed",
            "volunteer_interest",
            "lawn_sign_interest",
          ].includes(outcome),
          issue_categories: detailed
            ? (document.querySelector<HTMLInputElement>("#issues")?.value ?? "")
                .split(";")
                .filter(Boolean)
            : [],
          notes: detailed
            ? document.querySelector<HTMLTextAreaElement>("#notes")?.value
            : "",
          follow_up_action: detailed
            ? document.querySelector<HTMLInputElement>("#follow-up")?.value
            : null,
          follow_up_date: detailed
            ? document.querySelector<HTMLInputElement>("#follow-date")?.value
            : null,
          source: document.querySelector<HTMLInputElement>("#volunteer-mode")!
            .checked
            ? "volunteer"
            : "candidate",
        }),
      });
      await refresh();
      toast("Visit appended");
    } finally {
      submitting = false;
      document
        .querySelectorAll<HTMLButtonElement>(
          ".quick-actions button,#save-detail",
        )
        .forEach((button) => (button.disabled = false));
    }
  }
  async function refresh() {
    state = await fetchJson<State>("/api/canvassing/state");
    byStructure.clear();
    for (const h of state.households) {
      if (h.structure_id)
        byStructure.set(h.structure_id, [
          ...(byStructure.get(h.structure_id) ?? []),
          h,
        ]);
      if (active?.household_id === h.household_id) active = h;
    }
    for (const feature of structures.features) {
      const homes = byStructure.get(feature.properties.structure_id) ?? [];
      feature.properties.status =
        homes.sort((a, b) => statusRank(b.status) - statusRank(a.status))[0]
          ?.status ?? "untouched";
    }
    for (const feature of addresses.features) {
      feature.properties.status =
        state.households.find(
          (h) => h.address_id === feature.properties.address_id,
        )?.status ?? "untouched";
    }
    (map.getSource("structures") as GeoJSONSource | undefined)?.setData(
      structures,
    );
    (map.getSource("addresses") as GeoJSONSource | undefined)?.setData(
      addresses,
    );
    renderSummary();
    if (active) showHouseholds([active]);
  }
  const postJson = <T>(url: string, value: unknown) =>
    fetchJson<T>(url, { method: "POST", body: JSON.stringify(value) });

  function renderFollowups() {
    const workspace = document.querySelector("#followup-workspace")!;
    const sourceRoutes = state.routes.filter(
      (route) =>
        route.route_kind === "flyer_delivery" &&
        Number(route.stop_count) > 0 &&
        Number(route.completed_count) === Number(route.stop_count),
    );
    const samples = [...state.followup_samples].sort((left, right) =>
      left.scheduled_for.localeCompare(right.scheduled_for),
    );
    workspace.innerHTML = `<section class="workflow-create"><h3>Create from completed flyer route</h3><div class="workflow-row"><select id="followup-source">${sourceRoutes.length ? sourceRoutes.map((route) => `<option value="${route.id}">${route.name}</option>`).join("") : '<option value="">No completed flyer route</option>'}</select><input id="followup-flyer-date" type="date" value="${new Date().toISOString().slice(0, 10)}"><select id="followup-mode"><option value="percentage">20 percent</option><option value="target_count">Target count</option></select><input id="followup-value" type="number" min="1" value="20"><button id="followup-generate" type="button" ${sourceRoutes.length ? "" : "disabled"}>Generate stable sample</button></div></section><section class="workflow-list">${
      samples.length
        ? samples
            .map((sample) => {
              const homes = sample.household_ids
                .map((id) =>
                  state.households.find((home) => home.household_id === id),
                )
                .filter(Boolean) as Household[];
              const available = state.route_stops.filter(
                (stop) =>
                  stop.route_id === sample.source_route_id &&
                  !sample.household_ids.includes(stop.household_id),
              );
              return `<article class="workflow-item ${sample.schedule_state} ${sample.status}"><header><div><strong>${sample.source_route_name}</strong><span>${sample.status} · ${sample.schedule_state}</span></div><time>${sample.scheduled_for}</time></header><p>${homes.length} households · ${sample.sampling_mode === "percentage" ? `${sample.percentage}%` : `target ${sample.target_count}`} · seed ${sample.seed}</p><div class="workflow-row"><input data-schedule="${sample.id}" type="date" value="${sample.scheduled_for}"><button type="button" data-reschedule="${sample.id}">Update date</button>${sample.status === "draft" ? `<select data-include-select="${sample.id}">${available.map((stop) => `<option value="${stop.household_id}">${stop.label}</option>`).join("")}</select><button type="button" data-include="${sample.id}" ${available.length ? "" : "disabled"}>Include</button><button type="button" data-accept="${sample.id}">Accept route</button>` : `<span>Linked route: ${sample.followup_route_name}</span>`}</div><ol>${homes.map((home, index) => `<li><span>${home.label}</span>${sample.status === "draft" ? `<button type="button" data-move="${sample.id}" data-index="${index}" data-direction="-1" aria-label="Move earlier">↑</button><button type="button" data-move="${sample.id}" data-index="${index}" data-direction="1" aria-label="Move later">↓</button><button type="button" data-exclude="${sample.id}" data-household="${home.household_id}">Exclude</button>` : ""}</li>`).join("")}</ol></article>`;
            })
            .join("")
        : "<p>No follow-up routes yet.</p>"
    }</section>`;
    document
      .querySelector("#followup-mode")
      ?.addEventListener("change", (event) => {
        const count =
          (event.target as HTMLSelectElement).value === "target_count";
        const value =
          document.querySelector<HTMLInputElement>("#followup-value")!;
        value.value = count ? "40" : "20";
      });
    document
      .querySelector("#followup-generate")
      ?.addEventListener("click", async () => {
        const routeId =
          document.querySelector<HTMLSelectElement>("#followup-source")!.value;
        if (!routeId) return toast("No completed flyer route is available");
        const mode =
          document.querySelector<HTMLSelectElement>("#followup-mode")!.value;
        const value = Number(
          document.querySelector<HTMLInputElement>("#followup-value")!.value,
        );
        try {
          await postJson(`/api/canvassing/routes/${routeId}/followup-sample`, {
            flyer_date: document.querySelector<HTMLInputElement>(
              "#followup-flyer-date",
            )!.value,
            ...(mode === "target_count"
              ? { target_count: value }
              : { percentage: value }),
          });
          await refresh();
          renderFollowups();
          toast("Stable draft created");
        } catch (error) {
          toast(
            error instanceof Error ? error.message : "Could not create sample",
          );
        }
      });
    workspace
      .querySelectorAll<HTMLButtonElement>("[data-reschedule]")
      .forEach((button) =>
        button.addEventListener("click", async () => {
          const id = button.dataset.reschedule!,
            scheduled_for = workspace.querySelector<HTMLInputElement>(
              `[data-schedule="${id}"]`,
            )!.value;
          await postJson(`/api/canvassing/followup-samples/${id}/schedule`, {
            scheduled_for,
          });
          await refresh();
          renderFollowups();
        }),
      );
    workspace
      .querySelectorAll<HTMLButtonElement>("[data-exclude]")
      .forEach((button) =>
        button.addEventListener("click", async () => {
          await postJson(
            `/api/canvassing/followup-samples/${button.dataset.exclude}/override`,
            { type: "exclude", household_id: button.dataset.household },
          );
          await refresh();
          renderFollowups();
        }),
      );
    workspace
      .querySelectorAll<HTMLButtonElement>("[data-include]")
      .forEach((button) =>
        button.addEventListener("click", async () => {
          const select = workspace.querySelector<HTMLSelectElement>(
            `[data-include-select="${button.dataset.include}"]`,
          )!;
          await postJson(
            `/api/canvassing/followup-samples/${button.dataset.include}/override`,
            { type: "include", household_id: select.value },
          );
          await refresh();
          renderFollowups();
        }),
      );
    workspace
      .querySelectorAll<HTMLButtonElement>("[data-move]")
      .forEach((button) =>
        button.addEventListener("click", async () => {
          const sample = state.followup_samples.find(
            (item) => item.id === button.dataset.move,
          )!;
          const ids = [...sample.household_ids],
            index = Number(button.dataset.index),
            target = index + Number(button.dataset.direction);
          if (target < 0 || target >= ids.length) return;
          [ids[index], ids[target]] = [ids[target], ids[index]];
          await postJson(
            `/api/canvassing/followup-samples/${sample.id}/override`,
            { type: "reorder", household_ids: ids },
          );
          await refresh();
          renderFollowups();
        }),
      );
    workspace
      .querySelectorAll<HTMLButtonElement>("[data-accept]")
      .forEach((button) =>
        button.addEventListener("click", async () => {
          const sample = await postJson<FollowupSample>(
            `/api/canvassing/followup-samples/${button.dataset.accept}/accept`,
            {},
          );
          await refresh();
          renderFollowups();
          if (sample.followup_route_id)
            toast("Accepted route is locked and ready");
        }),
      );
  }

  function renderRecruitment() {
    const workspace = document.querySelector("#recruitment-workspace")!;
    const statuses = [
      "candidate_confirmed",
      "candidate_needed",
      "potential_candidate_identified",
      "contacted",
      "considering",
      "declined",
      "registered",
    ];
    workspace.innerHTML = `<section><h3>Ward and area status</h3><div class="workflow-row"><input id="recruitment-area-name" placeholder="Ward or area name"><button id="recruitment-area-add" type="button">Add area</button></div><ul class="recruitment-list">${state.recruitment_areas.map((area) => `<li class="${area.status === "candidate_needed" ? "needed" : ""}"><strong>${area.name}</strong><select data-area-status="${area.id}">${statuses.map((status) => `<option value="${status}" ${status === area.status ? "selected" : ""}>${status.replaceAll("_", " ")}</option>`).join("")}</select></li>`).join("")}</ul></section><section><h3>Prospects</h3><div class="workflow-row"><select id="prospect-area">${state.recruitment_areas.map((area) => `<option value="${area.id}">${area.name}</option>`).join("")}</select><select id="prospect-role"><option value="candidate">Candidate</option><option value="local_representative">Local Representative</option><option value="councillor_candidate">Councillor candidate</option></select><button id="prospect-from-household" type="button" ${active ? "" : "disabled"}>Add selected household</button></div><ul class="recruitment-list">${state.recruitment_prospects.map((prospect) => `<li><span><strong>${prospect.display_name || "Private prospect"}</strong><small>${prospect.area_name} · ${prospect.role_interest.replaceAll("_", " ")}</small></span><select data-prospect-status="${prospect.id}">${statuses.map((status) => `<option value="${status}" ${status === prospect.status ? "selected" : ""}>${status.replaceAll("_", " ")}</option>`).join("")}</select></li>`).join("")}</ul></section>`;
    workspace
      .querySelector("#recruitment-area-add")
      ?.addEventListener("click", async () => {
        const input = workspace.querySelector<HTMLInputElement>(
          "#recruitment-area-name",
        )!;
        if (!input.value.trim()) return;
        await postJson("/api/canvassing/recruitment/areas", {
          name: input.value.trim(),
        });
        await refresh();
        renderRecruitment();
      });
    workspace
      .querySelectorAll<HTMLSelectElement>("[data-area-status]")
      .forEach((select) =>
        select.addEventListener("change", async () => {
          await postJson(
            `/api/canvassing/recruitment/areas/${select.dataset.areaStatus}/status`,
            { status: select.value },
          );
          await refresh();
          renderRecruitment();
        }),
      );
    workspace
      .querySelector("#prospect-from-household")
      ?.addEventListener("click", async () => {
        if (!active) return;
        await postJson("/api/canvassing/recruitment/prospects", {
          area_id:
            workspace.querySelector<HTMLSelectElement>("#prospect-area")!.value,
          household_id: active.household_id,
          role_interest:
            workspace.querySelector<HTMLSelectElement>("#prospect-role")!.value,
        });
        await refresh();
        renderRecruitment();
      });
    workspace
      .querySelectorAll<HTMLSelectElement>("[data-prospect-status]")
      .forEach((select) =>
        select.addEventListener("change", async () => {
          await postJson(
            `/api/canvassing/recruitment/prospects/${select.dataset.prospectStatus}/status`,
            { status: select.value },
          );
          await refresh();
          renderRecruitment();
        }),
      );
  }

  function renderRoutes() {
    const select = document.querySelector<HTMLSelectElement>("#active-route")!,
      current = select.value;
    select.innerHTML =
      '<option value="">Choose route</option>' +
      state.routes
        .map(
          (r) =>
            `<option value="${r.id}">${r.route_kind === "followup_canvass" ? `${r.scheduled_for} · ` : ""}${r.name}</option>`,
        )
        .join("");
    select.value = current;
    const stops = state.route_stops.filter((s) => s.route_id === current),
      done = stops.filter((s) => s.completed_at).length,
      points = stops.map((stop) => [stop.lon, stop.lat] as [number, number]);
    let straight = 0;
    for (let index = 1; index < points.length; index++)
      straight += metresBetween(points[index - 1], points[index]);
    const network = walkingGraph.routeDistance(points);
    document.querySelector("#route-progress")!.textContent = current
      ? `${done}/${stops.length} · ${stops.length - done} flyers · straight ${(straight / 1000).toFixed(1)} km · roads ${network == null ? "n/a" : `${(network / 1000).toFixed(1)} km`}`
      : "";
    const features: any[] = [];
    if (stops.length > 1)
      features.push({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: points },
      });
    features.push(
      ...stops.map((s) => ({
        type: "Feature",
        properties: {
          completed: Boolean(s.completed_at),
          sequence: s.sequence,
        },
        geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      })),
    );
    (map.getSource("active-route") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features,
    });
  }
  function renderSession() {
    const session = state.route_sessions.find(
      (item) => item.session_id === activeSessionId,
    );
    const strip = document.querySelector("#session-strip")!,
      toggle = document.querySelector<HTMLButtonElement>("#session-toggle")!;
    if (!session) {
      strip.innerHTML = "";
      toggle.textContent = "Start";
      return;
    }
    sessionPaused = session.paused;
    toggle.textContent = session.ended_at
      ? "Start"
      : sessionPaused
        ? "Resume"
        : "Pause";
    const time = (value: string) =>
      new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    strip.innerHTML = `<span>Started ${time(session.started_at)}</span>${session.ended_at ? `<span>Ended ${time(session.ended_at)}</span>` : ""}<span>Active ${session.elapsed_active_minutes} min</span><span>Paused ${session.pause_minutes} min</span><span>Flyers ${session.flyers_used}</span><span>Attempted ${session.stops_attempted}</span><span>Knocked ${session.doors_knocked}</span><span>Answers ${session.answers}</span><span>Talked ${session.conversations}</span><span>Revisit ${session.revisits}</span><span>Skipped ${session.skipped_stops}</span><strong>${session.completed_stops_per_hour}/hour</strong>`;
  }
  async function toggleSession() {
    const route =
      document.querySelector<HTMLSelectElement>("#active-route")!.value;
    if (!route) return toast("Choose a route first");
    const existing = state.route_sessions.find(
      (item) => item.session_id === activeSessionId,
    );
    if (!existing || existing.ended_at) {
      const session = await fetchJson<SessionSummary>(
        "/api/canvassing/sessions",
        { method: "POST", body: JSON.stringify({ route_id: route }) },
      );
      activeSessionId = session.session_id;
      sessionPaused = false;
    } else {
      const action = sessionPaused ? "resume" : "pause";
      await fetchJson(`/api/canvassing/sessions/${activeSessionId}/${action}`, {
        method: "POST",
        body: "{}",
      });
      sessionPaused = !sessionPaused;
    }
    persist({ session_id: activeSessionId });
    await refresh();
    renderSession();
  }
  async function endSession() {
    if (!activeSessionId) return;
    await fetchJson(`/api/canvassing/sessions/${activeSessionId}/end`, {
      method: "POST",
      body: "{}",
    });
    sessionPaused = false;
    await refresh();
    renderSession();
    toast("Route session ended");
  }
  function navigateRoute(delta: number) {
    const route =
        document.querySelector<HTMLSelectElement>("#active-route")!.value,
      stops = state.route_stops.filter(
        (s) => s.route_id === route && !s.skipped,
      );
    if (!stops.length) return;
    routeIndex = Math.max(0, Math.min(stops.length - 1, routeIndex + delta));
    if (delta === 1) {
      const next = stops.findIndex(
        (s, index) => index >= routeIndex && !s.completed_at,
      );
      if (next >= 0) routeIndex = next;
    }
    const stop = stops[routeIndex],
      home = state.households.find((h) => h.household_id === stop.household_id);
    persist({
      route_id: route,
      route_index: routeIndex,
      household_id: home?.household_id ?? "",
    });
    if (home) {
      showHouseholds([home]);
      map.easeTo({ center: [home.lon, home.lat], zoom: 18 });
      updateLocation();
    }
  }
  function updateLocation() {
    if (!currentPosition) return;
    const lon = currentPosition.coords.longitude,
      lat = currentPosition.coords.latitude,
      accuracy = currentPosition.coords.accuracy,
      ring: Array<[number, number]> = [];
    for (let index = 0; index <= 36; index++) {
      const angle = (index / 36) * Math.PI * 2;
      ring.push([
        lon +
          (Math.cos(angle) * accuracy) /
            (111320 * Math.cos((lat * Math.PI) / 180)),
        lat + (Math.sin(angle) * accuracy) / 111320,
      ]);
    }
    const source = map.getSource("current-location") as
      GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { accuracy_m: accuracy },
          geometry: { type: "Polygon", coordinates: [ring] },
        },
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [lon, lat] },
        },
      ],
    });
    const route =
        document.querySelector<HTMLSelectElement>("#active-route")!.value,
      unfinished = state.route_stops
        .filter(
          (stop) =>
            stop.route_id === route && !stop.completed_at && !stop.skipped,
        )
        .sort(
          (a, b) =>
            metresBetween([lon, lat], [a.lon, a.lat]) -
            metresBetween([lon, lat], [b.lon, b.lat]),
        ),
      selectedDistance = active
        ? metresBetween([lon, lat], [active.lon, active.lat])
        : null,
      nearest = unfinished[0];
    const strip = document.querySelector("#session-strip")!;
    strip
      .querySelectorAll(".location-stat")
      .forEach((element) => element.remove());
    strip.insertAdjacentHTML(
      "beforeend",
      `<span class="location-stat">Accuracy ${accuracy.toFixed(0)} m</span>${selectedDistance == null ? "" : `<span class="location-stat">Selected ${selectedDistance.toFixed(0)} m</span>`}${nearest ? `<span class="location-stat">Nearest unfinished ${nearest.label} · ${metresBetween([lon, lat], [nearest.lon, nearest.lat]).toFixed(0)} m</span>` : ""}`,
    );
    document.querySelector<HTMLButtonElement>("#recenter")!.disabled = false;
  }
  function toggleLocation() {
    if (locationWatch != null) {
      navigator.geolocation.clearWatch(locationWatch);
      locationWatch = undefined;
      currentPosition = undefined;
      (map.getSource("current-location") as GeoJSONSource | undefined)?.setData(
        { type: "FeatureCollection", features: [] },
      );
      document.querySelector("#locate")!.textContent = "Locate";
      return;
    }
    if (!navigator.geolocation) return toast("Geolocation is unavailable");
    locationWatch = navigator.geolocation.watchPosition(
      (position) => {
        currentPosition = position;
        updateLocation();
      },
      (error) => toast(error.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    document.querySelector("#locate")!.textContent = "Stop location";
  }
  function updateSelection() {
    document.querySelector("#selection-count")!.textContent = String(
      selected.size,
    );
  }
  const orderGeographically = (
    homes: Household[],
    start?: [number, number],
  ) => {
    const groups = new Map<string, Household[]>();
    for (const home of homes)
      groups.set(home.street, [...(groups.get(home.street) ?? []), home]);
    const ordered: Household[] = [];
    let cursor =
      start ?? (homes[0] ? [homes[0].lon, homes[0].lat] : [-80.943, 44.567]);
    while (groups.size) {
      const entries = [...groups.entries()];
      entries.sort(
        ([, a], [, b]) =>
          metresBetween(cursor, [
            a.reduce((s, h) => s + h.lon, 0) / a.length,
            a.reduce((s, h) => s + h.lat, 0) / a.length,
          ]) -
          metresBetween(cursor, [
            b.reduce((s, h) => s + h.lon, 0) / b.length,
            b.reduce((s, h) => s + h.lat, 0) / b.length,
          ]),
      );
      const [street, streetHomes] = entries[0];
      groups.delete(street);
      const sidePreference =
          document.querySelector<HTMLSelectElement>("#street-side")?.value,
        number = (home: Household) =>
          Number.parseInt(home.civic_number, 10) || 0,
        odd = streetHomes
          .filter((home) => number(home) % 2 === 1)
          .sort((a, b) => number(a) - number(b)),
        even = streetHomes
          .filter((home) => number(home) % 2 === 0)
          .sort((a, b) => number(a) - number(b));
      let first = sidePreference === "right" ? even : odd,
        second = sidePreference === "right" ? odd : even;
      if (!first.length) [first, second] = [second, first];
      const forwardDistance = first.length
          ? metresBetween(cursor, [first[0].lon, first[0].lat])
          : 0,
        reverseDistance = first.length
          ? metresBetween(cursor, [first.at(-1)!.lon, first.at(-1)!.lat])
          : 0;
      if (reverseDistance < forwardDistance) first.reverse();
      if (first.length && second.length) {
        const from = first.at(-1)!;
        if (
          metresBetween([from.lon, from.lat], [second[0].lon, second[0].lat]) >
          metresBetween(
            [from.lon, from.lat],
            [second.at(-1)!.lon, second.at(-1)!.lat],
          )
        )
          second.reverse();
      }
      ordered.push(...first, ...second);
      const last = ordered.at(-1)!;
      cursor = [last.lon, last.lat];
    }
    return ordered;
  };
  async function saveRouteOrder(householdIds: string[], reason: string) {
    const route =
      document.querySelector<HTMLSelectElement>("#active-route")!.value;
    if (!route) return;
    await fetchJson(`/api/canvassing/routes/${route}/reorder`, {
      method: "POST",
      body: JSON.stringify({ household_ids: householdIds, reason }),
    });
    await refresh();
  }
  async function moveActiveStop(delta: number) {
    if (!active) return;
    const route =
        document.querySelector<HTMLSelectElement>("#active-route")!.value,
      ids = state.route_stops
        .filter((stop) => stop.route_id === route)
        .map((stop) => stop.household_id),
      index = ids.indexOf(active.household_id),
      target = index + delta;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await saveRouteOrder(ids, "manual stop move");
    routeIndex = target;
    persist({ route_index: target });
  }
  async function recalculateFromHere() {
    const route =
      document.querySelector<HTMLSelectElement>("#active-route")!.value;
    if (!route) return toast("Choose a route first");
    const all = state.route_stops.filter((stop) => stop.route_id === route),
      eligible = all.filter((stop) => !stop.completed_at && !stop.skipped),
      homes = eligible
        .map((stop) =>
          state.households.find(
            (home) => home.household_id === stop.household_id,
          )!,
        )
        .filter(
          (home) =>
            home &&
            ![
              "inaccessible",
              "no_campaign_material_requested",
              "vacant",
            ].includes(home.status),
        ),
      start = currentPosition
        ? ([
            currentPosition.coords.longitude,
            currentPosition.coords.latitude,
          ] as [number, number])
        : undefined,
      ordered = orderGeographically(homes, start),
      orderedSet = new Set(ordered.map((home) => home.household_id)),
      remainder = all
        .map((stop) => stop.household_id)
        .filter((id) => !orderedSet.has(id));
    await saveRouteOrder(
      [...ordered.map((home) => home.household_id), ...remainder],
      "recalculate from current position",
    );
    routeIndex = 0;
    navigateRoute(0);
  }
  document
    .querySelector("#create-route")!
    .addEventListener("click", async () => {
      if (!selected.size) return toast("Select households first");
      const homes = orderGeographically(
        [...selected].map((id) =>
          state.households.find((h) => h.household_id === id)!,
        ),
      );
      const result = await fetchJson<{ id: string }>("/api/canvassing/routes", {
        method: "POST",
        body: JSON.stringify({
          name: document.querySelector<HTMLInputElement>("#route-name")!.value,
          street_side:
            document.querySelector<HTMLSelectElement>("#street-side")!.value,
          household_ids: homes.map((h) => h.household_id),
        }),
      });
      selected.clear();
      updateSelection();
      await refresh();
      toast(`Route created: ${result.id.slice(0, 8)}`);
    });
  document.querySelector("#bulk-flyer")!.addEventListener("click", async () => {
    if (submitting) return;
    submitting = true;
    try {
      for (const household_id of selected)
        await fetchJson("/api/canvassing/visits", {
          method: "POST",
          body: JSON.stringify({
            submission_key: crypto.randomUUID(),
            session_id: activeSessionId || null,
            household_id,
            outcome: "flyer_delivered",
            flyer_delivered: true,
            door_knocked: false,
            source: "volunteer",
          }),
        });
      selected.clear();
      updateSelection();
      await refresh();
      toast("Selected addresses marked flyer delivered");
    } finally {
      submitting = false;
    }
  });
  document.querySelector("#active-route")!.addEventListener("change", () => {
    routeIndex = 0;
    const route_id =
      document.querySelector<HTMLSelectElement>("#active-route")!.value;
    persist({ route_id, route_index: 0 });
    renderRoutes();
    navigateRoute(0);
  });
  document
    .querySelector("#previous-stop")!
    .addEventListener("click", () => navigateRoute(-1));
  document
    .querySelector("#next-stop")!
    .addEventListener("click", () => navigateRoute(1));
  document
    .querySelector("#session-toggle")!
    .addEventListener("click", toggleSession);
  const endButton = document.createElement("button");
  endButton.textContent = "End";
  endButton.id = "end-session";
  document.querySelector("#session-toggle")!.after(endButton);
  endButton.addEventListener("click", endSession);
  const earlier = document.createElement("button"),
    later = document.createElement("button"),
    recalculate = document.createElement("button");
  earlier.textContent = "Earlier";
  later.textContent = "Later";
  recalculate.textContent = "Reorder here";
  earlier.className =
    later.className =
    recalculate.className =
      "route-reorder-control";
  document.querySelector("#previous-stop")!.before(earlier, later, recalculate);
  earlier.addEventListener("click", () => moveActiveStop(-1));
  later.addEventListener("click", () => moveActiveStop(1));
  recalculate.addEventListener("click", recalculateFromHere);
  document.querySelector("#undo-stop")!.addEventListener("click", async () => {
    try {
      await fetchJson("/api/canvassing/undo-latest", {
        method: "POST",
        body: JSON.stringify({
          session_id: activeSessionId,
          reason: "field undo",
        }),
      });
      await refresh();
      toast("Correction appended");
    } catch {
      toast("Nothing to undo");
    }
  });
  document.querySelector("#locate")!.addEventListener("click", toggleLocation);
  document.querySelector("#recenter")!.addEventListener("click", () => {
    if (currentPosition)
      map.easeTo({
        center: [
          currentPosition.coords.longitude,
          currentPosition.coords.latitude,
        ],
        zoom: 18,
      });
  });
  document.querySelector("#status-filter")!.addEventListener("change", (e) => {
    const value = (e.target as HTMLSelectElement).value;
    persist({ status_filter: value });
    map.setFilter(
      "structures",
      value === "all" ? null : ["==", ["get", "status"], value],
    );
    map.setFilter(
      "address-points",
      value === "all"
        ? ["!", ["has", "point_count"]]
        : [
            "all",
            ["!", ["has", "point_count"]],
            ["==", ["get", "status"], value],
          ],
    );
  });
  document
    .querySelector("#volunteer-mode")!
    .addEventListener("change", async (e) => {
      persist({ volunteer: (e.target as HTMLInputElement).checked });
      recruitmentDialog.close();
      await refresh();
      if (active) showHouseholds([active]);
    });
  document.querySelector("#coverage-toggle")!.addEventListener("click", () => {
    coverage = !coverage;
    map.easeTo({ zoom: coverage ? 12.2 : 15 });
    toast(coverage ? "Coverage aggregation enabled" : "Household view enabled");
  });
  const qualityDialog =
    document.querySelector<HTMLDialogElement>("#quality-dialog")!;
  document.querySelector("#quality-open")!.addEventListener("click", () => {
    document.querySelector("#quality-metrics")!.innerHTML =
      `<dl>${Object.entries(addressQuality.totals)
        .map(
          ([key, value]) =>
            `<div><dt>${key.replaceAll("_", " ")}</dt><dd>${Number(value).toLocaleString()}</dd></div>`,
        )
        .join("")}</dl><h3>Automatic joins</h3><dl>${Object.entries(
        addressQuality.automatic_join_counts,
      )
        .map(
          ([key, value]) =>
            `<div><dt>${key.replaceAll("_", " ")}</dt><dd>${Number(value).toLocaleString()}</dd></div>`,
        )
        .join(
          "",
        )}</dl><p>${addressQuality.methodology}</p><h3>Review queues</h3><div class="quality-queues">${Object.entries(
        state.address_review_counts,
      )
        .map(
          ([queue, count]) =>
            `<button type="button" data-review-queue="${queue}">${queue.replaceAll("_", " ")} <strong>${count}</strong></button>`,
        )
        .join("")}</div>`;
    document
      .querySelectorAll<HTMLButtonElement>("[data-review-queue]")
      .forEach((button) =>
        button.addEventListener("click", async () => {
          const queue = button.dataset.reviewQueue!;
          const records = await fetchJson<
            Array<{
              id: string;
              label: string;
              lon: number;
              lat: number;
              within_boundary: number;
              queue_flags: string[];
            }>
          >(
            `/api/canvassing/address-review?queue=${encodeURIComponent(queue)}`,
          );
          const target = document.querySelector("#quality-queue")!;
          target.innerHTML = `<h3>${queue.replaceAll("_", " ")}</h3><p>${records.length} records. Outside-boundary records are retained here but excluded from campaign routes.</p><ol>${records
            .slice(0, 250)
            .map(
              (record) =>
                `<li><button type="button" data-review-lon="${record.lon}" data-review-lat="${record.lat}">${record.label || "Address without label"}</button><span>${record.within_boundary ? "inside boundary" : "outside boundary"}</span></li>`,
            )
            .join("")}</ol>`;
          target
            .querySelectorAll<HTMLButtonElement>("[data-review-lon]")
            .forEach((recordButton) =>
              recordButton.addEventListener("click", () => {
                map.easeTo({
                  center: [
                    Number(recordButton.dataset.reviewLon),
                    Number(recordButton.dataset.reviewLat),
                  ],
                  zoom: 18,
                });
                qualityDialog.close();
              }),
            );
        }),
      );
    qualityDialog.showModal();
  });
  const followupDialog =
    document.querySelector<HTMLDialogElement>("#followup-dialog")!;
  document.querySelector("#followup-open")!.addEventListener("click", () => {
    if (document.querySelector<HTMLInputElement>("#volunteer-mode")!.checked)
      return toast("Follow-up planning is hidden in volunteer mode");
    renderFollowups();
    followupDialog.showModal();
  });
  const recruitmentDialog = document.querySelector<HTMLDialogElement>(
    "#recruitment-dialog",
  )!;
  document.querySelector("#recruitment-open")!.addEventListener("click", () => {
    if (document.querySelector<HTMLInputElement>("#volunteer-mode")!.checked)
      return toast("Recruitment details are hidden in volunteer mode");
    renderRecruitment();
    recruitmentDialog.showModal();
  });
  const conversationDialog = document.querySelector<HTMLDialogElement>(
    "#conversation-dialog",
  )!;
  const openConversation = () => {
    const volunteerMode =
      document.querySelector<HTMLInputElement>("#volunteer-mode")!.checked;
    document.querySelector<HTMLInputElement>(
      "#conversation-household",
    )!.checked = Boolean(active);
    document.querySelector<HTMLInputElement>(
      "#conversation-complete",
    )!.checked = Boolean(active);
    for (const id of [
      "conversation-outcome",
      "conversation-representative",
      "conversation-councillor",
    ])
      document.querySelector<HTMLInputElement | HTMLSelectElement>(
        `#${id}`,
      )!.disabled = volunteerMode;
    conversationDialog.showModal();
  };
  document
    .querySelector("#conversation-open")!
    .addEventListener("click", openConversation);
  document
    .querySelector("#field-conversation")!
    .addEventListener("click", openConversation);
  document
    .querySelector<HTMLFormElement>("#conversation-form")!
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submitting) return;
      submitting = true;
      try {
        const point = currentPosition
          ? [currentPosition.coords.longitude, currentPosition.coords.latitude]
          : active
            ? [active.lon, active.lat]
            : [map.getCenter().lng, map.getCenter().lat];
        const associate = Boolean(
          active &&
          document.querySelector<HTMLInputElement>("#conversation-household")!
            .checked,
        );
        const possibleRepresentative = document.querySelector<HTMLInputElement>(
          "#conversation-representative",
        )!.checked;
        const possibleCouncillor = document.querySelector<HTMLInputElement>(
          "#conversation-councillor",
        )!.checked;
        const conversation = await postJson<{ id: string }>(
          "/api/canvassing/neighbourhood-conversations",
          {
            submission_key: crypto.randomUUID(),
            lon: point[0],
            lat: point[1],
            location_accuracy_m: currentPosition?.coords.accuracy ?? null,
            issue_discussed: document.querySelector<HTMLInputElement>(
              "#conversation-issue",
            )!.value,
            political_outcome:
              document.querySelector<HTMLSelectElement>(
                "#conversation-outcome",
              )!.value || null,
            possible_volunteer: document.querySelector<HTMLInputElement>(
              "#conversation-volunteer",
            )!.checked,
            possible_local_representative: possibleRepresentative,
            possible_councillor_candidate: possibleCouncillor,
            follow_up_requested: document.querySelector<HTMLInputElement>(
              "#conversation-followup",
            )!.checked,
            household_id: associate ? active!.household_id : null,
            route_id:
              document.querySelector<HTMLSelectElement>("#active-route")!
                .value || null,
            complete_household_attempt:
              associate &&
              document.querySelector<HTMLInputElement>(
                "#conversation-complete",
              )!.checked,
          },
        );
        if (
          !document.querySelector<HTMLInputElement>("#volunteer-mode")!
            .checked &&
          (possibleRepresentative || possibleCouncillor)
        )
          await postJson("/api/canvassing/recruitment/prospects", {
            area_id: state.recruitment_areas[0]?.id ?? "owen-sound-citywide",
            household_id: associate ? active!.household_id : null,
            conversation_id: conversation.id,
            role_interest: possibleCouncillor
              ? "councillor_candidate"
              : "local_representative",
          });
        conversationDialog.close();
        document.querySelector<HTMLFormElement>("#conversation-form")!.reset();
        await refresh();
        toast("Neighbourhood conversation appended");
      } finally {
        submitting = false;
      }
    });
  document
    .querySelectorAll<HTMLButtonElement>("[data-close]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        document
          .querySelector<HTMLDialogElement>(`#${button.dataset.close}`)
          ?.close(),
      ),
    );
  document
    .querySelector("#print-route")!
    .addEventListener("click", () => window.print());
  const dialog = document.querySelector<HTMLDialogElement>("#import-dialog")!;
  document
    .querySelector("#import-open")!
    .addEventListener("click", () => dialog.showModal());
  document
    .querySelector("#import-submit")!
    .addEventListener("click", async (e) => {
      e.preventDefault();
      const file =
        document.querySelector<HTMLInputElement>("#csv-file")!.files?.[0];
      if (!file) return;
      const response = await fetch("/api/canvassing/import.csv", {
        method: "POST",
        headers: { "content-type": "text/csv" },
        body: await file.text(),
      });
      if (!response.ok) throw new Error(await response.text());
      dialog.close();
      await refresh();
      toast("CSV import complete");
    });
  const volunteer =
    document.querySelector<HTMLInputElement>("#volunteer-mode")!;
  volunteer.checked = saved.volunteer ?? false;
  const statusFilter =
    document.querySelector<HTMLSelectElement>("#status-filter")!;
  statusFilter.value = saved.status_filter ?? "all";
  renderSummary();
  const routeSelect =
    document.querySelector<HTMLSelectElement>("#active-route")!;
  routeSelect.value = saved.route_id ?? "";
  renderRoutes();
  if (saved.household_id) {
    const home = state.households.find(
      (item) => item.household_id === saved.household_id,
    );
    if (home) showHouseholds([home]);
  }
  const operations = await fetchJson<{
    backup: { recent: boolean; age_hours: number | null };
  }>("/api/canvassing/operations/status");
  if (!operations.backup.recent)
    document.querySelector("#backup-warning")!.textContent =
      `Backup is ${operations.backup.age_hours ?? "unknown"} hours old`;
}
