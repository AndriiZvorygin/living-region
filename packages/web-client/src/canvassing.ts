import maplibregl, {
  type GeoJSONSource,
  type MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./canvassing.css";
import { WalkingRoadGraph, metresBetween } from "./canvassing-routing";
import {
  buildHouseholdAdjacencyGraph,
  calculateLocalCoverageArea,
  isCoverageCovered,
  isCoverageEligible,
  selectNextUnderflyeredAreaAsync,
  type CoverageLocation,
  type HouseholdAdjacencyGraph,
  type NextUnderflyeredArea,
} from "./canvassing-coverage";

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
  conversation_occurred: number;
  revisit_requested: number;
  no_answer: number;
  political_outcome: string | null;
  visit_count: number;
  flyer_history: FlyerDelivery[];
  flyer_ids: string[];
  number_corrected: number;
  last_updated_at: string | null;
};
type Flyer = {
  id: string;
  short_name: string;
  description: string | null;
  introduction_date: string;
  active: number;
  printable_url: string | null;
};
type FlyerDelivery = {
  event_id: string;
  occurred_at: string;
  flyer_id: string | null;
  flyer_name: string;
  user_id: string;
  source: string;
};
type Contact = {
  person_id: string;
  name: string;
  phone: string;
  email: string;
  mailing_list_consent: number | boolean;
  last_updated_at: string;
  civic_number: string;
  street: string;
  address_label: string;
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
  flyers: Flyer[];
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
  summary: Record<string, number> & {
    flyer_breakdown?: Array<{
      flyer_id: string;
      short_name: string;
      delivery_count: number;
      household_count: number;
    }>;
  };
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
  multi_select: boolean;
  selected_household_ids: string[];
  coverage_mode: boolean;
  active_flyer_id: string;
  flyer_filter: string;
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
const clusterStatusKeys = [
  "untouched_count",
  "flyer_count",
  "knocked_count",
  "conversation_count",
  "revisit_count",
  "interest_count",
  "restricted_count",
] as const;
const dominantClusterCount = [
  "max",
  ...clusterStatusKeys.map((key) => ["get", key]),
];
const dominantClusterColor = [
  "case",
  ["==", ["get", "conversation_count"], dominantClusterCount],
  statusColors.conversation,
  ["==", ["get", "interest_count"], dominantClusterCount],
  statusColors.volunteer_interest,
  ["==", ["get", "revisit_count"], dominantClusterCount],
  statusColors.revisit,
  ["==", ["get", "knocked_count"], dominantClusterCount],
  statusColors.knocked_no_answer,
  ["==", ["get", "flyer_count"], dominantClusterCount],
  statusColors.flyer_delivered,
  ["==", ["get", "restricted_count"], dominantClusterCount],
  statusColors.inaccessible,
  statusColors.untouched,
];
const coverageRatioExpression = [
  "case",
  [">", ["get", "eligible_count"], 0],
  ["/", ["get", "covered_count"], ["get", "eligible_count"]],
  0,
] as any;
const coverageClusterColor = [
  "interpolate",
  ["linear"],
  coverageRatioExpression,
  0,
  "#000004",
  0.2,
  "#420A68",
  0.4,
  "#932667",
  0.6,
  "#DD513A",
  0.8,
  "#FCA50A",
  1,
  "#FCFFA4",
];
const coverageClusterLabel = [
  "case",
  [">", ["get", "eligible_count"], 0],
  [
    "case",
    ["==", ["get", "remaining_count"], 0],
    "✓",
    ["to-string", ["get", "remaining_count"]],
  ],
  "–",
];
const coverageClusterTextColor = [
  "case",
  [">=", coverageRatioExpression, 0.7],
  "#111411",
  "#fff",
];
const coverageClusterTextHalo = [
  "case",
  [">=", coverageRatioExpression, 0.7],
  "#fff",
  "#445158",
];
const coverageClusterRadius = [
  "interpolate",
  ["linear"],
  ["sqrt", ["get", "eligible_count"]],
  0,
  13,
  2,
  14,
  5,
  17,
  10,
  22,
  20,
  28,
  40,
  34,
];
const canvassingDataVersion = "all-roofs-addressable-20260726";
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
// Prepared geography is versioned and immutable between data regenerations.
// Reuse it across reloads instead of redownloading it on every phone visit.
const fetchStaticJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};
const geo = async (url: string) => fetchStaticJson<any>(url);
const localDateValue = (value: Date | string = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};
const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );

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
    <header><div><strong>Owen Sound Canvassing</strong><span>Private campaign workspace</span></div><nav><button id="coverage-toggle">Coverage</button><button id="find-next-area">Find next area</button><button id="followup-open">Follow-ups</button><button id="conversation-open">Conversation</button><button id="recruitment-open">Recruitment</button><button id="quality-open">Address quality</button><button id="flyer-catalogue-open">Flyer catalogue</button><button id="print-route">Print</button><a class="button" href="/api/canvassing/export/routes.csv">Export CSV</a><button id="import-open">Import</button></nav><span class="backup-warning" id="backup-warning"></span><div class="mobile-topbar" aria-label="Canvassing map controls"><button id="mobile-menu" class="mobile-control" aria-label="Open map menu" title="Open map menu">Menu</button><button id="mobile-coverage" class="mobile-coverage-chip" aria-label="Open coverage legend" title="Coverage legend"><span aria-hidden="true"></span>Coverage</button><button id="mobile-next-area" class="mobile-next-area" aria-label="Open next underflyered area" title="Finding next underflyered area">Next</button><span class="mobile-active-flyer-chip" id="mobile-active-flyer-chip">Flyer: choose</span><button id="mobile-locate" class="mobile-control" aria-label="Show current location" title="Show current location">Locate</button></div></header>
    <aside class="summary" id="summary"></aside><main id="canvass-map"></main>
    <aside class="cluster-key" id="cluster-key" hidden><strong id="cluster-key-title">Grouped civic addresses</strong><span id="cluster-key-description">Number = household stops; colour = most common status. Tap to zoom in.</span><div class="coverage-legend" id="coverage-legend" hidden><div class="coverage-swatches"><i style="background:#000004"></i><i style="background:#420A68"></i><i style="background:#FCA50A"></i><i style="background:#FCFFA4"></i></div><div class="coverage-legend-labels"><span>Untouched</span><span>Partly covered</span><span>Fully covered</span></div><small>Bubble number = eligible households remaining</small><small class="next-area-status" id="next-area-status"></small></div></aside>
    <div class="mobile-scrim" id="mobile-scrim" hidden></div>
    <section class="mobile-sheet mobile-menu-sheet" id="mobile-menu-sheet" hidden aria-hidden="true"><div class="mobile-sheet-handle" aria-hidden="true"></div><div class="mobile-sheet-head"><strong>Map menu</strong><button id="mobile-menu-close" class="mobile-close" aria-label="Close map menu">Close</button></div><section class="mobile-flyer-controls"><label>Active flyer<select id="mobile-active-flyer"><option value="">Choose flyer</option></select></label><label>Inspect distribution<select id="mobile-flyer-filter"><option value="">All flyers</option></select></label><button id="mobile-flyer-catalogue-open">Edit flyer names</button></section><details open><summary>Campaign tools</summary><div class="mobile-menu-actions"><button id="mobile-bulk-open">Bulk select homes</button><button id="mobile-tools-open">Route and filters</button><button id="mobile-summary-open">Campaign totals</button><button id="mobile-find-next-area">Find next area</button></div></details><details><summary>Workflows</summary><div class="mobile-menu-actions"><button id="mobile-followup-open">Follow-ups</button><button id="mobile-conversation-open">Neighbourhood conversation</button><button id="mobile-recruitment-open">Recruitment</button><button id="mobile-quality-open">Address quality</button></div></details><details><summary>Data and print</summary><div class="mobile-menu-actions"><button id="mobile-import-open">Import records</button><button id="mobile-print-open">Print route</button><a class="button" href="/api/canvassing/export/routes.csv">Export route CSV</a></div></details></section>
    <section class="mobile-sheet mobile-coverage-sheet" id="mobile-coverage-sheet" hidden aria-hidden="true"><div class="mobile-sheet-handle" aria-hidden="true"></div><div class="mobile-sheet-head"><strong>Coverage</strong><button id="mobile-coverage-close" class="mobile-close" aria-label="Close coverage legend">Close</button></div><div id="mobile-coverage-content"></div></section>
    <section class="mobile-sheet mobile-summary-sheet" id="mobile-summary-sheet" hidden aria-hidden="true"><div class="mobile-sheet-handle" aria-hidden="true"></div><div class="mobile-sheet-head"><strong>Campaign totals</strong><button id="mobile-summary-close" class="mobile-close" aria-label="Close campaign totals">Close</button></div><div id="mobile-summary-content"></div></section>
    <section class="bulk-selection-bar" id="bulk-selection-bar" aria-label="Bulk household selection"><button id="multi-select" aria-pressed="false">Bulk flyer</button><span id="bulk-selection-status" aria-live="polite">Tap Bulk flyer, then tap roofs</span><button id="bulk-flyer" disabled>Mark selected flyered</button><button id="clear-selection" disabled>Clear</button></section>
    <section class="drawer" id="drawer"><div class="empty"><strong>Select a roof or address</strong><span>Click households to inspect them or add them to a route.</span></div></section>
    <footer><button id="mobile-tools-close" class="mobile-sheet-close" aria-label="Close route and filter tools">Close tools</button><div class="route-builder"><input id="route-name" placeholder="New route name"><select id="street-side"><option value="">Both sides</option><option value="left">Left side</option><option value="right">Right side</option></select><button id="create-route">Create <span id="selection-count">0</span></button></div><div class="route-run"><select id="active-route"><option value="">Choose route</option></select><button id="session-toggle">Start</button><button id="undo-stop">Undo</button><button id="field-conversation">Conversation</button><button id="previous-stop">Previous</button><button id="next-stop">Next</button><button id="locate">Locate</button><button id="recenter" disabled>Recenter</button><span id="route-progress"></span></div><label>Active flyer <select id="active-flyer"><option value="">Choose flyer</option></select></label><label>Inspect flyer <select id="flyer-filter"><option value="">All flyers</option></select></label><label><input id="volunteer-mode" type="checkbox"> Volunteer delivery mode</label><label>Status <select id="status-filter"><option value="all">All</option>${Object.keys(
      statusColors,
    )
      .map((s) => `<option value="${s}">${s.replaceAll("_", " ")}</option>`)
      .join("")}</select></label></footer>
    <section class="mobile-route-bar" id="mobile-route-bar" hidden aria-label="Active route controls"><span class="mobile-route-flyer-chip" id="mobile-route-flyer-chip">Flyer: choose</span><button id="mobile-previous-stop" aria-label="Previous stop">Previous</button><button id="mobile-mark-stop">Mark / update</button><button id="mobile-next-stop" aria-label="Next stop">Next</button><button id="mobile-route-more" aria-label="Open route details">Route</button></section>
    <section class="session-strip" id="session-strip"></section>
    <dialog id="import-dialog"><form method="dialog"><h2>Import existing records</h2><p>CSV fields: address, date_met, person_name, outcome, issues, notes, follow_up, support_level.</p><input id="csv-file" type="file" accept=".csv,text/csv"><menu><button value="cancel">Cancel</button><button id="import-submit" value="default">Import</button></menu></form></dialog>
    <dialog id="followup-dialog" class="workflow-dialog"><h2>Weekly follow-ups</h2><div id="followup-workspace"></div><menu><button type="button" data-close="followup-dialog">Close</button></menu></dialog>
    <dialog id="conversation-dialog" class="workflow-dialog"><h2>Neighbourhood conversation</h2><form id="conversation-form" class="workflow-form"><label>Issue discussed<input id="conversation-issue" required></label><label>Political outcome<select id="conversation-outcome"><option value="">Not recorded</option><option value="supportive">Supportive</option><option value="undecided">Undecided</option><option value="opposed">Opposed</option></select></label><label><input id="conversation-volunteer" type="checkbox"> Possible volunteer</label><label><input id="conversation-representative" type="checkbox"> Possible Local Representative</label><label><input id="conversation-councillor" type="checkbox"> Possible councillor candidate</label><label><input id="conversation-followup" type="checkbox"> Follow-up requested</label><label><input id="conversation-household" type="checkbox"> Associate selected household</label><label><input id="conversation-complete" type="checkbox"> Complete selected household attempt</label><button>Record conversation</button></form><menu><button type="button" data-close="conversation-dialog">Close</button></menu></dialog>
    <dialog id="recruitment-dialog" class="workflow-dialog"><h2>Candidate recruitment</h2><div id="recruitment-workspace"></div><menu><button type="button" data-close="recruitment-dialog">Close</button></menu></dialog>
    <dialog id="quality-dialog" class="workflow-dialog"><h2>Address quality</h2><div id="quality-metrics"></div><div id="quality-queue"></div><menu><button type="button" data-close="quality-dialog">Close</button></menu></dialog>
    <dialog id="flyer-dialog" class="workflow-dialog"><h2>Flyer catalogue</h2><p>Names and descriptions are private campaign metadata. Delivery history keeps stable flyer IDs.</p><div id="flyer-catalogue-workspace"></div><menu><button type="button" data-close="flyer-dialog">Close</button></menu></dialog>
    <div class="toast" id="toast"></div></div>`;
  // Bind the primary mobile sheets before the larger offline data payload loads.
  // A volunteer can open the menu immediately while the map is still preparing.
  const earlyMobilePanels = [
    document.querySelector<HTMLElement>("#mobile-menu-sheet")!,
    document.querySelector<HTMLElement>("#mobile-coverage-sheet")!,
    document.querySelector<HTMLElement>("#mobile-summary-sheet")!,
  ];
  const earlyMobileScrim = document.querySelector<HTMLElement>("#mobile-scrim")!;
  const earlyShell = document.querySelector<HTMLElement>(".canvass-shell")!;
  const earlyOpenMobilePanel = (panel: HTMLElement) => {
    earlyMobilePanels.forEach((other) => {
      other.hidden = other !== panel;
      other.setAttribute("aria-hidden", String(other !== panel));
    });
    panel.hidden = false;
    panel.setAttribute("aria-hidden", "false");
    earlyMobileScrim.hidden = false;
  };
  const populateEarlyCoverage = () => {
    const source = document.querySelector<HTMLElement>("#coverage-legend"),
      target = document.querySelector<HTMLElement>("#mobile-coverage-content");
    if (!source || !target) return;
    const legend = source.cloneNode(true) as HTMLElement;
    legend.hidden = false;
    legend.removeAttribute("id");
    legend.querySelector("#next-area-status")?.removeAttribute("id");
    target.replaceChildren(legend);
  };
  document.querySelector("#mobile-menu")?.addEventListener("click", () =>
    earlyOpenMobilePanel(earlyMobilePanels[0]),
  );
  document.querySelector("#mobile-coverage")?.addEventListener("click", () => {
    populateEarlyCoverage();
    earlyOpenMobilePanel(earlyMobilePanels[1]);
  });
  document.querySelector("#mobile-summary-open")?.addEventListener("click", () =>
    earlyOpenMobilePanel(earlyMobilePanels[2]),
  );
  document.querySelector("#mobile-tools-open")?.addEventListener("click", () => {
    earlyMobilePanels.forEach((panel) => {
      panel.hidden = true;
      panel.setAttribute("aria-hidden", "true");
    });
    earlyShell.classList.add("mobile-tools-open");
    earlyMobileScrim.hidden = false;
  });
  document.querySelectorAll(".mobile-close, #mobile-menu-close").forEach((button) =>
    button.addEventListener("click", () => {
      earlyMobilePanels.forEach((panel) => {
        panel.hidden = true;
        panel.setAttribute("aria-hidden", "true");
      });
      earlyMobileScrim.hidden = true;
    }),
  );
  document.querySelector("#mobile-tools-close")?.addEventListener("click", () => {
    earlyShell.classList.remove("mobile-tools-open");
    earlyMobileScrim.hidden = true;
  });
  earlyMobileScrim.addEventListener("click", () => {
    earlyMobilePanels.forEach((panel) => {
      panel.hidden = true;
      panel.setAttribute("aria-hidden", "true");
    });
    earlyMobileScrim.hidden = true;
  });
  document.querySelector<HTMLInputElement>("#volunteer-mode")!.checked =
    saved.volunteer ?? false;
  const statePromise = fetchJson<State>("/api/canvassing/state");
  const mapDataPromise = Promise.all([
    geo(`/canvassing/structures.geojson?v=${canvassingDataVersion}`),
    geo(`/canvassing/addresses.geojson?v=${canvassingDataVersion}`),
    geo(`/canvassing/roads.geojson?v=${canvassingDataVersion}`),
    geo(`/canvassing/boundary.geojson?v=${canvassingDataVersion}`),
    geo(`/canvassing/address-quality.json?v=${canvassingDataVersion}`),
    geo(`/canvassing/building-coverage-audit.json?v=${canvassingDataVersion}`),
    fetchJson<{
      hidden_parent_ids: string[];
      features: any[];
    }>("/api/canvassing/structure-splits"),
  ]);
  // These payloads are independent. Start them together so a slow API or a
  // slow map file does not block the other half of the initial screen.
  let state: State;
  let structures: any;
  let addresses: any;
  let roads: any;
  let boundary: any;
  let addressQuality: any;
  let buildingCoverage: any;
  let splitCorrections: { hidden_parent_ids: string[]; features: any[] };
  [
    state,
    [
      structures,
      addresses,
      roads,
      boundary,
      addressQuality,
      buildingCoverage,
      splitCorrections,
    ],
  ] = await Promise.all([statePromise, mapDataPromise]);
  let activeFlyerId = saved.active_flyer_id ?? "";
  let flyerFilter = saved.flyer_filter ?? "";
  const availableFlyers = state.flyers ?? [];
  if (!availableFlyers.some((flyer) => flyer.id === activeFlyerId))
    activeFlyerId = "";
  if (
    flyerFilter &&
    !availableFlyers.some((flyer) => flyer.id === flyerFilter)
  )
    flyerFilter = "";
  const hiddenSplitParents = new Set(splitCorrections.hidden_parent_ids);
  structures.features = structures.features
    .filter(
      (feature: any) =>
        !hiddenSplitParents.has(feature.properties.structure_id),
    )
    .concat(splitCorrections.features);
  const walkingGraph = new WalkingRoadGraph(roads);
  const byStructure = new Map<string, Household[]>();
  const byAddress = new Map<string, Household>();
  for (const h of state.households) {
    byAddress.set(h.address_id, h);
    if (h.structure_id)
      byStructure.set(h.structure_id, [
        ...(byStructure.get(h.structure_id) ?? []),
        h,
      ]);
  }
  const homesForStructure = (feature: any) => {
    const direct =
      byStructure.get(String(feature.properties.structure_id ?? "")) ?? [];
    if (direct.length) return direct;
    return [
      ...new Map(
        (feature.properties.address_reference_ids ?? [])
          .map((id: string) => byAddress.get(id))
          .filter(Boolean)
          .map((home: Household) => [home.household_id, home]),
      ).values(),
    ] as Household[];
  };
  const selected = new Set(
    (saved.selected_household_ids ?? []).filter((id) =>
      state.households.some((home) => home.household_id === id),
    ),
  );
  const contactCache = new Map<string, Contact[]>();
  const structureFeatureById = new Map<string, any>(
      structures.features.map((feature: any) => [
        String(feature.properties.structure_id),
        feature,
      ]),
    ),
    structureIdsByHousehold = new Map<string, Set<string>>();
  for (const feature of structures.features) {
    const structureId = String(feature.properties.structure_id);
    for (const home of homesForStructure(feature)) {
      const ids =
        structureIdsByHousehold.get(home.household_id) ?? new Set<string>();
      ids.add(structureId);
      structureIdsByHousehold.set(home.household_id, ids);
    }
  }
  let active: Household | undefined;
  // Coverage is the useful citywide starting view; the toggle restores the
  // individual household/status view when needed.
  let coverage = saved.coverage_mode ?? true;
  let multiSelectMode = saved.multi_select ?? false;
  let routeIndex = saved.route_index ?? 0;
  let activeSessionId = saved.session_id ?? "";
  let sessionPaused = false;
  let submitting = false;
  let lastMapSelection = { key: "", at: 0 };
  let selectedStructureStates = new Set<string>();
  let selectedAddressStates = new Set<string>();
  let currentPosition: GeolocationPosition | undefined;
  let locationWatch: number | undefined;
  let nextAreaPopup: maplibregl.Popup | undefined;
  let nextAreaTimer: number | undefined;
  let nextAreaRevision = 0;
  let nextAreaRecommendation: NextUnderflyeredArea | null = null;
  let nextAreaPinned = false;
  let nextAreaRecalculateRequested = false;
  let coverageAdjacencyGraph: HouseholdAdjacencyGraph;
  let splitTarget: any;
  let splitPreview: any;
  let splitDrawing = false;
  let splitCutStart: [number, number] | undefined;
  let splitCuts: Array<{
    start: [number, number];
    end: [number, number];
  }> = [];
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
    const homes = homesForStructure(f);
    f.properties.household_count = homes.length;
    f.properties.selected = homes.some((home) =>
      selected.has(home.household_id),
    );
    f.properties.status =
      homes.sort((a, b) => statusRank(b.status) - statusRank(a.status))[0]
        ?.status ?? "untouched";
    f.properties.flyer_ids = [
      ...new Set(homes.flatMap((home) => home.flyer_ids ?? [])),
    ];
  }
  const knownNonResidentialBuildingTypes = new Set([
    "commercial",
    "industrial",
    "retail",
    "office",
    "school",
    "hospital",
    "college",
    "warehouse",
    "church",
    "civic",
    "public",
    "garage",
    "shed",
    "barn",
  ]);
  const isKnownNonResidential = (home: Household) => {
    const structure = home.structure_id
      ? structureFeatureById.get(home.structure_id)
      : undefined;
    return knownNonResidentialBuildingTypes.has(
      String(structure?.properties?.building_type ?? "").toLowerCase(),
    );
  };
  const applyAddressCoverageProperties = () => {
    for (const feature of addresses.features) {
      const home = byAddress.get(String(feature.properties.address_id));
      const eligible = Boolean(
        home && !isKnownNonResidential(home) && isCoverageEligible(home),
      );
      const covered = Boolean(home && eligible && isCoverageCovered(home));
      feature.properties.household_id = home?.household_id;
      feature.properties.status = home?.status ?? "untouched";
      feature.properties.selected = Boolean(
        home && selected.has(home.household_id),
      );
      feature.properties.eligible = eligible;
      feature.properties.covered = covered;
      feature.properties.eligible_count = eligible ? 1 : 0;
      feature.properties.covered_count = covered ? 1 : 0;
      feature.properties.remaining_count = eligible && !covered ? 1 : 0;
      feature.properties.flyer_ids = home?.flyer_ids ?? [];
    }
  };
  applyAddressCoverageProperties();
  const featureCenter = (feature: any): [number, number] => {
    const points: [number, number][] = [];
    const walk = (coordinates: any) =>
      typeof coordinates?.[0] === "number"
        ? points.push(coordinates)
        : coordinates?.forEach(walk);
    walk(feature.geometry.coordinates);
    return [
      points.reduce((sum, point) => sum + point[0], 0) / points.length,
      points.reduce((sum, point) => sum + point[1], 0) / points.length,
    ];
  };
  // Polygon-centre calculation is invariant while the map is open. Populate
  // this only when address labels are requested; the default citywide view
  // does not need to pay for thousands of label centres.
  const structureLabelPoints = new Map<string, [number, number]>();
  let structureLabelsPrepared = false;
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
  if (new URLSearchParams(window.location.search).has("e2e"))
    (window as any).__livingRegionCanvassing = {
      map,
      state: () => state,
      nextArea: () => nextAreaRecommendation,
    };
  map.addControl(
    new maplibregl.NavigationControl({ showCompass: false }),
    "bottom-right",
  );
  const combinedMapFilter = (...filters: any[]) => {
    const activeFilters = filters.filter(Boolean);
    return activeFilters.length === 0
      ? null
      : activeFilters.length === 1
        ? activeFilters[0]
        : ["all", ...activeFilters];
  };
  const flyerMapFilter = () =>
    flyerFilter ? ["in", flyerFilter, ["get", "flyer_ids"]] : null;
  const applyMapFilters = () => {
    const status =
      document.querySelector<HTMLSelectElement>("#status-filter")?.value ??
      "all";
    const statusFilter =
      status === "all" ? null : ["==", ["get", "status"], status];
    if (map.getLayer("structures"))
      map.setFilter("structures", combinedMapFilter(statusFilter, flyerMapFilter()));
    if (map.getLayer("estimated-structure-outlines"))
      map.setFilter(
        "estimated-structure-outlines",
        combinedMapFilter(
          ["==", ["get", "geometry_provenance"], "estimated"],
          statusFilter,
          flyerMapFilter(),
        ),
      );
    if (map.getLayer("city-map-structure-outlines"))
      map.setFilter(
        "city-map-structure-outlines",
        combinedMapFilter(
          ["==", ["get", "external_source"], "owen_sound_city_map_pdf"],
          statusFilter,
          flyerMapFilter(),
        ),
      );
    if (map.getLayer("address-points"))
      map.setFilter(
        "address-points",
        combinedMapFilter(
          ["!", ["has", "point_count"]],
          [
            "any",
            ["!", ["has", "structure_id"]],
            ["==", ["get", "structure_id"], ""],
          ],
          statusFilter,
        ),
      );
    const source = map.getSource("addresses") as GeoJSONSource | undefined;
    if (source)
      source.setData(
        flyerFilter
          ? {
              ...addresses,
              features: addresses.features.filter((feature: any) =>
                (feature.properties.flyer_ids ?? []).includes(flyerFilter),
              ),
            }
          : addresses,
      );
  };
  const shell = document.querySelector<HTMLElement>(".canvass-shell")!;
  const mobileScrim = document.querySelector<HTMLElement>("#mobile-scrim")!;
  const mobilePanels = [
    document.querySelector<HTMLElement>("#mobile-menu-sheet")!,
    document.querySelector<HTMLElement>("#mobile-coverage-sheet")!,
    document.querySelector<HTMLElement>("#mobile-summary-sheet")!,
  ];
  const resizeMap = () => {
    requestAnimationFrame(() => {
      map.resize();
      requestAnimationFrame(() => map.resize());
    });
  };
  const syncMobileScrim = () => {
    const toolsOpen = shell.classList.contains("mobile-tools-open");
    mobileScrim.hidden = !toolsOpen && !mobilePanels.some((panel) => !panel.hidden);
  };
  const setMobilePanel = (panel: HTMLElement, open: boolean) => {
    if (open) {
      mobilePanels.forEach((other) => {
        if (other !== panel) {
          other.hidden = true;
          other.setAttribute("aria-hidden", "true");
        }
      });
      shell.classList.remove("mobile-tools-open");
      panel.hidden = false;
      panel.setAttribute("aria-hidden", "false");
    } else {
      panel.hidden = true;
      panel.setAttribute("aria-hidden", "true");
    }
    syncMobileScrim();
    resizeMap();
  };
  const closeMobileDrawer = () => {
    document.querySelector<HTMLElement>("#drawer")!.classList.remove("mobile-open");
    resizeMap();
  };
  const openMobileDrawer = () => {
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    mobilePanels.forEach((panel) => {
      panel.hidden = true;
      panel.setAttribute("aria-hidden", "true");
    });
    shell.classList.remove("mobile-tools-open");
    document.querySelector<HTMLElement>("#drawer")!.classList.add("mobile-open");
    syncMobileScrim();
    resizeMap();
  };
  const openMobileTools = () => {
    mobilePanels.forEach((panel) => {
      panel.hidden = true;
      panel.setAttribute("aria-hidden", "true");
    });
    closeMobileDrawer();
    shell.classList.add("mobile-tools-open");
    syncMobileScrim();
    resizeMap();
  };
  const closeMobileTools = () => {
    shell.classList.remove("mobile-tools-open");
    syncMobileScrim();
    resizeMap();
  };
  const closeMobileOverlays = () => {
    mobilePanels.forEach((panel) => {
      panel.hidden = true;
      panel.setAttribute("aria-hidden", "true");
    });
    shell.classList.remove("mobile-tools-open");
    closeMobileDrawer();
    syncMobileScrim();
  };
  const refreshMobileCoverageLegend = () => {
    const source = document.querySelector<HTMLElement>("#coverage-legend"),
      target = document.querySelector<HTMLElement>("#mobile-coverage-content");
    if (!source || !target) return;
    const legend = source.cloneNode(true) as HTMLElement;
    legend.hidden = false;
    legend.removeAttribute("id");
    legend.querySelector("#next-area-status")?.removeAttribute("id");
    target.replaceChildren(legend);
  };
  const syncMobileLocationControl = () => {
    const button = document.querySelector<HTMLButtonElement>("#mobile-locate");
    if (!button) return;
    button.textContent = currentPosition ? "Center" : locationWatch != null ? "Locating" : "Locate";
    button.setAttribute("aria-label", currentPosition ? "Recenter on my location" : "Show current location");
  };
  mobileScrim.addEventListener("click", () => {
    mobilePanels.forEach((panel) => {
      panel.hidden = true;
      panel.setAttribute("aria-hidden", "true");
    });
    closeMobileTools();
  });
  for (const panel of mobilePanels) {
    let touchStartY = 0;
    panel.addEventListener("touchstart", (event) => {
      touchStartY = event.changedTouches[0]?.clientY ?? 0;
    }, { passive: true });
    panel.addEventListener("touchend", (event) => {
      const touchEndY = event.changedTouches[0]?.clientY ?? touchStartY;
      if (touchEndY - touchStartY > 56) setMobilePanel(panel, false);
    }, { passive: true });
  }
  const setCoverageMode = (enabled: boolean) => {
    const button =
      document.querySelector<HTMLButtonElement>("#coverage-toggle")!;
    button.setAttribute("aria-pressed", String(enabled));
    button.textContent = enabled ? "Households" : "Coverage";
    const keyTitle = document.querySelector("#cluster-key-title");
    const keyDescription = document.querySelector("#cluster-key-description");
    const legend = document.querySelector<HTMLElement>("#coverage-legend");
    if (keyTitle)
      keyTitle.textContent = enabled
        ? "Flyer coverage"
        : "Grouped civic addresses";
    if (keyDescription)
      keyDescription.textContent = enabled
        ? "Number = eligible households remaining; tap a bubble for totals."
        : "Number = household stops; colour = most common status. Tap to zoom in.";
    if (legend) legend.hidden = !enabled;
    const mobileCoverage = document.querySelector<HTMLButtonElement>("#mobile-coverage");
    mobileCoverage?.setAttribute("aria-pressed", String(enabled));
    refreshMobileCoverageLegend();
    if (!map.getLayer("address-clusters")) return;
    map.setPaintProperty(
      "address-clusters",
      "circle-color",
      enabled ? coverageClusterColor : dominantClusterColor,
    );
    map.setPaintProperty(
      "address-clusters",
      "circle-radius",
      enabled
        ? coverageClusterRadius
        : ["step", ["get", "point_count"], 14, 50, 20, 200, 28],
    );
    map.setLayoutProperty(
      "address-cluster-counts",
      "text-field",
      enabled ? coverageClusterLabel : ["get", "point_count_abbreviated"],
    );
    map.setPaintProperty(
      "address-cluster-counts",
      "text-color",
      enabled ? coverageClusterTextColor : "#fff",
    );
    map.setPaintProperty(
      "address-cluster-counts",
      "text-halo-color",
      enabled ? coverageClusterTextHalo : "#445158",
    );
    // The recommendation is useful in both bubble view and individual-roof
    // view. Switching views should not discard the pinned work area.
    scheduleNextAreaUpdate();
  };
  const updateClusterKey = () => {
    const key = document.querySelector<HTMLElement>("#cluster-key")!;
    key.hidden = map.getZoom() >= 15;
  };
  const setNextAreaStatus = (message: string) => {
    const element = document.querySelector<HTMLElement>("#next-area-status");
    if (element) element.textContent = message;
    const mobileButton = document.querySelector<HTMLButtonElement>(
      "#mobile-next-area",
    );
    if (mobileButton) {
      mobileButton.hidden = false;
      mobileButton.disabled = message === "Citywide coverage complete";
      mobileButton.textContent = "Next";
      mobileButton.title = message || "Find next underflyered area";
    }
  };
  function clearNextAreaHighlight() {
    nextAreaRevision += 1;
    nextAreaRecommendation = null;
    nextAreaPinned = false;
    nextAreaRecalculateRequested = false;
    nextAreaPopup?.remove();
    nextAreaPopup = undefined;
    (map.getSource("next-underflyered") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: [],
    });
    setNextAreaStatus("");
  }
  function coverageLocations(): CoverageLocation[] {
    return state.households.map((home) => {
      const eligible = !isKnownNonResidential(home) && isCoverageEligible(home);
      return {
        household_id: home.household_id,
        lon: home.lon,
        lat: home.lat,
        eligible,
        covered: eligible && isCoverageCovered(home),
        street: home.street,
        civic_number: home.civic_number,
        stop_id: home.structure_id ?? home.address_id,
      };
    });
  }
  coverageAdjacencyGraph = buildHouseholdAdjacencyGraph(
    coverageLocations(),
    roads.features,
  );
  const recommendationFromLocalArea = (area: ReturnType<typeof calculateLocalCoverageArea>) =>
    area
      ? {
          ...area,
          remaining: area.localRemaining,
          totalEligible: area.sampleSize,
          coverage: area.sampleSize ? area.localCovered / area.sampleSize : 0,
          tieBreakResult: `remaining ${area.localRemaining}; average hops ${area.averageHouseholdHops.toFixed(1)}; maximum hops ${area.maxHouseholdHops}`,
          reason: "local_coverage" as const,
        }
      : null;
  function showNextAreaPopupAt(coordinates: [number, number]) {
    if (!nextAreaRecommendation) return;
    const result = nextAreaRecommendation;
    nextAreaPopup?.remove();
    nextAreaPopup = new maplibregl.Popup({ closeButton: true, offset: 16 })
      .setLngLat(coordinates)
      .setHTML(
        `<strong>Next underflyered area</strong><dl><div><dt>Local remaining</dt><dd>${result.localRemaining.toLocaleString()} of the nearest ${result.sampleSize.toLocaleString()} households</dd></div><div><dt>Local covered</dt><dd>${result.localCovered.toLocaleString()}</dd></div><div><dt>Coverage</dt><dd>${Math.round(result.coverage * 100)}%</dd></div><div><dt>Graph component</dt><dd>${result.graphComponent}</dd></div><div><dt>Household-hop radius</dt><dd>${result.householdHopRadius}</dd></div><div><dt>Average / maximum hops</dt><dd>${result.averageHouseholdHops.toFixed(1)} / ${result.maxHouseholdHops}</dd></div></dl><p>Centre household ${result.center_household_id}. The focus is pinned until you explicitly find the next area.</p><small>Tie-break: ${result.tieBreakResult}</small>`,
      )
      .addTo(map);
  }
  function showNextAreaPopup(event: any) {
    showNextAreaPopupAt([event.lngLat.lng, event.lngLat.lat]);
  }
  async function waitForMapStyle() {
    if (map.isStyleLoaded()) return;
    await new Promise<void>((resolve) => {
      const started = Date.now();
      const check = () => {
        if (map.isStyleLoaded() || Date.now() - started >= 30_000) {
          resolve();
          return;
        }
        window.setTimeout(check, 100);
      };
      check();
    });
  }
  async function openNextAreaPopup() {
    await waitForMapStyle();
    if (!nextAreaRecommendation) await findNextArea();
    if (!nextAreaRecommendation) {
      toast("No next underflyered area is available yet");
      return;
    }
    const center = coverageLocations().find(
      (location) =>
        location.household_id === nextAreaRecommendation!.center_household_id,
    );
    if (!center) return toast("The next area is not available in this view");
    map.easeTo({ center: [center.lon, center.lat], zoom: Math.max(14.5, map.getZoom()) });
    showNextAreaPopupAt([center.lon, center.lat]);
    window.setTimeout(() => {
      if (nextAreaRecommendation)
        showNextAreaPopupAt([center.lon, center.lat]);
    }, 350);
  }
  async function visibleNextAreaFeatures() {
    const source = map.getSource("addresses") as GeoJSONSource | undefined;
    if (!source) return [];
    const layers = ["address-clusters", "address-points"].filter((layer) =>
      map.getLayer(layer),
    );
    if (!layers.length) return [];
    const features: Array<{ feature: any; household_ids: string[] }> = [];
    const rendered = map.queryRenderedFeatures({ layers });
    const seen = new Set<string>();
    for (const feature of rendered) {
      const clusterId = String(feature.properties?.cluster_id ?? "");
      if (clusterId) {
        if (seen.has(`cluster:${clusterId}`)) continue;
        seen.add(`cluster:${clusterId}`);
        try {
          const leaves = await source.getClusterLeaves(Number(clusterId), 10000, 0);
          features.push({
            feature,
            household_ids: leaves
              .map((leaf: any) => String(leaf.properties?.household_id ?? ""))
              .filter(Boolean),
          });
        } catch {
          // The cluster may disappear during a zoom; the next render retries.
        }
      } else {
        const householdId = String(feature.properties?.household_id ?? "");
        if (householdId && !seen.has(`household:${householdId}`)) {
          seen.add(`household:${householdId}`);
          features.push({ feature, household_ids: [householdId] });
        }
      }
    }
    return features;
  }
  async function updateNextAreaHighlight() {
    const revision = ++nextAreaRevision;
    if (!map.isStyleLoaded()) return;
    const eligibleLocations = coverageLocations().filter((location) => location.eligible);
    if (eligibleLocations.length && eligibleLocations.every((location) => location.covered)) {
      nextAreaRecommendation = null;
      nextAreaPinned = false;
      (map.getSource("next-underflyered") as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: [],
      });
      setNextAreaStatus("Citywide coverage complete");
      return;
    }
    if (!nextAreaRecommendation || nextAreaRecalculateRequested) {
      const recommendation = await selectNextUnderflyeredAreaAsync(
        coverageLocations(),
        coverageAdjacencyGraph,
      );
      if (revision !== nextAreaRevision) return;
      nextAreaRecommendation = recommendation;
      nextAreaPinned = Boolean(recommendation);
      nextAreaRecalculateRequested = false;
    }
    if (!nextAreaRecommendation || revision !== nextAreaRevision) {
      (map.getSource("next-underflyered") as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: [],
      });
      const locations = coverageLocations().filter((location) => location.eligible);
      setNextAreaStatus(
        locations.length > 0 && locations.every((location) => location.covered)
          ? "Citywide coverage complete"
          : "No eligible households connected in the prepared graph",
      );
      return;
    }
    const center = coverageLocations().find(
      (location) =>
        location.household_id === nextAreaRecommendation!.center_household_id,
    );
    if (!center) return;
    const visible = await visibleNextAreaFeatures();
    if (revision !== nextAreaRevision) return;
    const visibleCentre = visible.find((item) =>
      item.household_ids.includes(nextAreaRecommendation!.center_household_id),
    );
    const feature = visibleCentre?.feature;
    const coordinates = feature?.geometry?.coordinates ?? [center.lon, center.lat];
    const visibleSize = Number(
      feature?.properties?.eligible_count ?? nextAreaRecommendation.sampleSize,
    );
    const radius = Math.min(40, Math.max(13, 13 + Math.sqrt(visibleSize) * 3.3));
    nextAreaRecommendation.cluster_id = String(feature?.properties?.cluster_id ?? "");
    (map.getSource("next-underflyered") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { radius_px: radius + 5, label: "Next area" },
          geometry: { type: "Point", coordinates },
        },
      ],
    });
    setNextAreaStatus(
      `Next area: ${nextAreaRecommendation.localRemaining.toLocaleString()} of the nearest ${nextAreaRecommendation.sampleSize.toLocaleString()} households remain`,
    );
  }
  async function recalculateNextArea() {
    nextAreaPinned = false;
    nextAreaRecommendation = null;
    nextAreaRecalculateRequested = true;
    await updateNextAreaHighlight();
  }
  const scheduleNextAreaUpdate = () => {
    if (nextAreaTimer != null) window.clearTimeout(nextAreaTimer);
    nextAreaTimer = window.setTimeout(() => {
      nextAreaTimer = undefined;
      void updateNextAreaHighlight();
    }, 100);
  };
  map.on("zoom", updateClusterKey);
  updateClusterKey();
  let labelMarkers: maplibregl.Marker[] = [];
  const smallScreen = window.matchMedia("(max-width: 600px)").matches;
  const updateLabels = () => {
    labelMarkers.forEach((marker) => marker.remove());
    labelMarkers = [];
    if (map.getZoom() < 14) return;
    const bounds = map.getBounds(),
      seen = new Set<string>();
    const maxRoadLabels = smallScreen ? 35 : 70;
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
      if (labelMarkers.length >= maxRoadLabels) break;
    }
    if (map.getZoom() >= 16.5) {
      if (!structureLabelsPrepared) {
        for (const feature of structures.features) {
          if (feature.properties.civic_label)
            structureLabelPoints.set(
              String(feature.properties.structure_id),
              featureCenter(feature),
            );
        }
        structureLabelsPrepared = true;
      }
      const maxAddressLabels = smallScreen ? 140 : 400;
      let addressLabelCount = 0;
      const visibleStatus =
        document.querySelector<HTMLSelectElement>("#status-filter")?.value ??
        "all";
      for (const feature of structures.features) {
        const point = structureLabelPoints.get(
          String(feature.properties.structure_id),
        );
        if (!point) continue;
        if (
          visibleStatus !== "all" &&
          feature.properties.status !== visibleStatus
        )
          continue;
        if (!bounds.contains(point)) continue;
        const element = document.createElement("span");
        element.className = "address-number";
        element.textContent = String(feature.properties.civic_label);
        labelMarkers.push(
          new maplibregl.Marker({ element }).setLngLat(point).addTo(map),
        );
        addressLabelCount += 1;
        if (addressLabelCount >= maxAddressLabels) break;
      }
    }
  };
  map.on("moveend", updateLabels);
  map.on("zoomend", updateLabels);
  map.on("moveend", scheduleNextAreaUpdate);
  map.on("zoomend", scheduleNextAreaUpdate);
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
      attribution:
        'Buildings: City of Owen Sound official city map (2022, private reference); <a href="https://open.canada.ca/data/en/dataset/3829eee9-f898-4643-9ad8-f48575b8873d">Canada Structures</a>, Open Government Licence - Canada; © OpenStreetMap contributors; estimated roofs © Living Region',
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
          0.24,
        ],
        "fill-outline-color": "#4f5754",
      },
    });
    map.addLayer({
      id: "city-map-structure-outlines",
      type: "line",
      source: "structures",
      minzoom: 14,
      filter: ["==", ["get", "external_source"], "owen_sound_city_map_pdf"],
      paint: {
        "line-color": "#344a52",
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.7, 18, 1.6],
        "line-opacity": [
          "case",
          [">", ["get", "household_count"], 0],
          0.9,
          0.32,
        ],
      },
    });
    map.addLayer({
      id: "estimated-structure-outlines",
      type: "line",
      source: "structures",
      minzoom: 14,
      filter: ["==", ["get", "geometry_provenance"], "estimated"],
      paint: {
        "line-color": "#303936",
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 1, 18, 2],
        "line-dasharray": [2, 1.5],
      },
    });
    map.addLayer({
      id: "selected-structure-outlines",
      type: "line",
      source: "structures",
      minzoom: 13,
      paint: {
        "line-color": "#0b4f43",
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 3, 18, 6],
        "line-opacity": [
          "case",
          ["==", ["feature-state", "selected"], true],
          1,
          0,
        ],
      },
    });
    map.addSource("split-preview", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "split-preview-fill",
      type: "fill",
      source: "split-preview",
      paint: {
        "fill-color": [
          "match",
          ["get", "index"],
          1,
          "#4e79a7",
          2,
          "#45a36d",
          3,
          "#e88935",
          4,
          "#8f63b8",
          "#edc949",
        ],
        "fill-opacity": 0.48,
      },
    });
    map.addLayer({
      id: "split-preview-outline",
      type: "line",
      source: "split-preview",
      paint: { "line-color": "#0b4f43", "line-width": 4 },
    });
    map.addSource("addresses", {
      type: "geojson",
      data: addresses,
      cluster: true,
      clusterRadius: 42,
      clusterMaxZoom: 14,
      clusterProperties: {
        eligible_count: ["+", ["get", "eligible_count"]],
        covered_count: ["+", ["get", "covered_count"]],
        remaining_count: ["+", ["get", "remaining_count"]],
        untouched_count: [
          "+",
          [
            "case",
            ["in", ["get", "status"], ["literal", ["untouched", "vacant"]]],
            1,
            0,
          ],
        ],
        flyer_count: [
          "+",
          [
            "case",
            [
              "in",
              ["get", "status"],
              ["literal", ["flyer_delivered", "undecided"]],
            ],
            1,
            0,
          ],
        ],
        knocked_count: [
          "+",
          [
            "case",
            ["==", ["get", "status"], "knocked_no_answer"],
            1,
            0,
          ],
        ],
        conversation_count: [
          "+",
          [
            "case",
            [
              "in",
              ["get", "status"],
              ["literal", ["conversation", "supportive"]],
            ],
            1,
            0,
          ],
        ],
        revisit_count: [
          "+",
          ["case", ["==", ["get", "status"], "revisit"], 1, 0],
        ],
        interest_count: [
          "+",
          [
            "case",
            [
              "in",
              ["get", "status"],
              ["literal", ["volunteer_interest", "lawn_sign_interest"]],
            ],
            1,
            0,
          ],
        ],
        restricted_count: [
          "+",
          [
            "case",
            [
              "in",
              ["get", "status"],
              [
                "literal",
                [
                  "opposed",
                  "inaccessible",
                  "no_campaign_material_requested",
                ],
              ],
            ],
            1,
            0,
          ],
        ],
      },
      promoteId: "address_id",
    });
    map.addLayer({
      id: "address-clusters",
      type: "circle",
      source: "addresses",
      filter: ["has", "point_count"],
      maxzoom: 15,
      paint: {
        "circle-color": dominantClusterColor as any,
        "circle-radius": ["step", ["get", "point_count"], 14, 50, 20, 200, 28],
        "circle-opacity": 0.9,
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 1.5,
      },
    });
    map.addSource("next-underflyered", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "next-underflyered-halo",
      type: "circle",
      source: "next-underflyered",
      paint: {
        "circle-color": "rgba(0,0,0,0)",
        "circle-radius": ["get", "radius_px"],
        "circle-stroke-color": "#00e5ff",
        "circle-stroke-width": 3,
        "circle-opacity": 0.98,
      },
    });
    map.addLayer({
      id: "address-cluster-counts",
      type: "symbol",
      source: "addresses",
      filter: ["has", "point_count"],
      maxzoom: 15,
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-size": 12,
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#fff",
        "text-halo-color": "#445158",
        "text-halo-width": 1,
      },
    });
    map.addLayer({
      id: "next-underflyered-label",
      type: "symbol",
      source: "next-underflyered",
      layout: {
        "text-field": ["get", "label"],
        "text-size": 11,
        "text-offset": [0, 1.8],
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#006b79",
        "text-halo-color": "#fff",
        "text-halo-width": 1.5,
      },
    });
    map.addLayer({
      id: "address-points",
      type: "circle",
      source: "addresses",
      filter: [
        "all",
        ["!", ["has", "point_count"]],
        [
          "any",
          ["!", ["has", "structure_id"]],
          ["==", ["get", "structure_id"], ""],
        ],
      ],
      minzoom: 14,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 2.5, 18, 5],
        "circle-color": statusExpression,
        "circle-stroke-color": [
          "case",
          ["==", ["feature-state", "selected"], true],
          "#0b4f43",
          "#fff",
        ],
        "circle-stroke-width": [
          "case",
          ["==", ["feature-state", "selected"], true],
          4,
          1,
        ],
      },
    });
    setCoverageMode(coverage);
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
    applyMapFilters();
    map.on("click", (event) => {
      closeMobileOverlays();
      if (splitTarget && splitDrawing) {
        const point: [number, number] = [event.lngLat.lng, event.lngLat.lat];
        if (!splitCutStart) {
          splitCutStart = point;
          toast("Tap the other side of the roof");
        } else {
          splitCuts.push({ start: splitCutStart, end: point });
          splitCutStart = undefined;
          splitDrawing = false;
          void previewSplit("cut_lines");
        }
        return;
      }
      if (
        map.queryRenderedFeatures(event.point, {
          layers: ["address-clusters", "address-cluster-counts"],
        }).length
      )
        return;
      const roofs = map.queryRenderedFeatures(event.point, {
        layers: ["structures"],
      });
      if (roofs.length) {
        pickStructure({ ...event, features: roofs } as any);
        return;
      }
      const addressPoints = map.queryRenderedFeatures(event.point, {
        layers: ["address-points"],
      });
      if (addressPoints.length)
        pickAddress({ ...event, features: addressPoints } as any);
    });
    const expandAddressCluster = async (e: any) => {
      const feature = e.features?.[0];
      if (!feature) return;
      if (coverage) {
        const properties = feature.properties ?? {};
        const covered = Number(properties.covered_count ?? 0);
        const remaining = Number(properties.remaining_count ?? 0);
        const totalEligible = Number(properties.eligible_count ?? 0);
        const percentage = totalEligible
          ? Math.round((covered / totalEligible) * 100)
          : 0;
        toast(
          `Covered ${covered} · ${remaining} remaining · ${totalEligible} eligible · ${percentage}%`,
        );
      }
      const zoom = await (
        map.getSource("addresses") as GeoJSONSource
      ).getClusterExpansionZoom(Number(feature.properties?.cluster_id));
      map.easeTo({ center: (feature.geometry as any).coordinates, zoom });
    };
    map.on("click", "address-clusters", expandAddressCluster);
    map.on("click", "address-cluster-counts", expandAddressCluster);
    for (const layer of [
      "structures",
      "city-map-structure-outlines",
      "estimated-structure-outlines",
      "address-points",
      "address-clusters",
      "address-cluster-counts",
      "next-underflyered-halo",
      "next-underflyered-label",
    ]) {
      map.on(
        "mouseenter",
        layer,
        () => (map.getCanvas().style.cursor = "pointer"),
      );
      map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
    }
    map.on("click", "next-underflyered-halo", showNextAreaPopup);
    map.on("click", "next-underflyered-label", showNextAreaPopup);
    map.once("idle", scheduleNextAreaUpdate);
    applySelectionFeatureState();
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
  function flyerLabel(flyerId: string | null | undefined) {
    return (
      state.flyers.find((flyer) => flyer.id === flyerId)?.short_name ??
      "Unknown legacy flyer"
    );
  }
  function renderFlyerControls() {
    if (
      activeFlyerId &&
      !state.flyers.some(
        (flyer) => flyer.id === activeFlyerId && Boolean(flyer.active),
      )
    ) {
      activeFlyerId = "";
      persist({ active_flyer_id: "" });
    }
    if (flyerFilter && !state.flyers.some((flyer) => flyer.id === flyerFilter)) {
      flyerFilter = "";
      persist({ flyer_filter: "" });
    }
    const activeOptions = state.flyers
      .filter((flyer) => flyer.active)
      .map(
        (flyer) =>
          `<option value="${escapeHtml(flyer.id)}">${escapeHtml(flyer.short_name)}</option>`,
      )
      .join("");
    const filterOptions = state.flyers
      .map(
        (flyer) =>
          `<option value="${escapeHtml(flyer.id)}">${escapeHtml(flyer.short_name)}</option>`,
      )
      .join("");
    for (const id of ["active-flyer", "mobile-active-flyer"]) {
      const select = document.querySelector<HTMLSelectElement>(`#${id}`);
      if (!select) continue;
      select.innerHTML = `<option value="">Choose flyer</option>${activeOptions}`;
      select.value = activeFlyerId;
    }
    for (const id of ["flyer-filter", "mobile-flyer-filter"]) {
      const select = document.querySelector<HTMLSelectElement>(`#${id}`);
      if (!select) continue;
      select.innerHTML = `<option value="">All flyers</option>${filterOptions}`;
      select.value = flyerFilter;
    }
    const label = activeFlyerId
      ? `Flyer: ${flyerLabel(activeFlyerId)}`
      : "Flyer: choose";
    for (const id of ["mobile-active-flyer-chip", "mobile-route-flyer-chip"]) {
      const chip = document.querySelector<HTMLElement>(`#${id}`);
      if (chip) chip.textContent = label;
    }
  }
  function renderFlyerCatalogue() {
    const workspace = document.querySelector("#flyer-catalogue-workspace");
    if (!workspace) return;
    workspace.innerHTML = state.flyers
      .map(
        (flyer) =>
          `<fieldset class="flyer-edit"><legend>${escapeHtml(flyer.id)}</legend><label>Short name<input data-flyer-field="short_name" data-flyer-id="${escapeHtml(flyer.id)}" value="${escapeHtml(flyer.short_name)}" required></label><label>Description<input data-flyer-field="description" data-flyer-id="${escapeHtml(flyer.id)}" value="${escapeHtml(flyer.description ?? "")}"></label><label>Introduction date<input type="date" data-flyer-field="introduction_date" data-flyer-id="${escapeHtml(flyer.id)}" value="${escapeHtml(flyer.introduction_date)}"></label><label>Printable filename or link<input data-flyer-field="printable_url" data-flyer-id="${escapeHtml(flyer.id)}" value="${escapeHtml(flyer.printable_url ?? "")}"></label><label><input type="checkbox" data-flyer-field="active" data-flyer-id="${escapeHtml(flyer.id)}" ${flyer.active ? "checked" : ""}> Active</label><button type="button" data-save-flyer="${escapeHtml(flyer.id)}">Save flyer details</button></fieldset>`,
      )
      .join("");
    workspace.querySelectorAll<HTMLButtonElement>("[data-save-flyer]").forEach((button) =>
      button.addEventListener("click", async () => {
        const flyerId = button.dataset.saveFlyer!;
        const value = (field: string) =>
          workspace.querySelector<HTMLInputElement>(
            `[data-flyer-field="${field}"][data-flyer-id="${flyerId}"]`,
          );
        button.disabled = true;
        try {
          await fetchJson(`/api/canvassing/flyers/${flyerId}`, {
            method: "PATCH",
            body: JSON.stringify({
              short_name: value("short_name")?.value,
              description: value("description")?.value || null,
              introduction_date: value("introduction_date")?.value,
              printable_url: value("printable_url")?.value || null,
              active: Boolean(value("active")?.checked),
            }),
          });
          await refresh();
          renderFlyerCatalogue();
          toast("Flyer catalogue updated");
        } catch (error) {
          toast(error instanceof Error ? error.message : "Flyer update failed");
        } finally {
          button.disabled = false;
        }
      }),
    );
  }
  function renderSummary() {
    const s = state.summary,
      total = Number(s.total_households);
    document.querySelector("#summary")!.innerHTML =
      `<dl><div><dt>Households</dt><dd>${total.toLocaleString()}</dd></div><div><dt>Flyers</dt><dd>${s.flyers_delivered}</dd></div><div><dt>Knocked</dt><dd>${s.doors_knocked}</dd></div><div><dt>Answers</dt><dd>${s.answers}</dd></div><div><dt>Talked</dt><dd>${s.conversations}</dd></div><div><dt>Revisit</dt><dd>${s.revisits}</dd></div><div><dt>Untouched</dt><dd>${s.untouched_households}</dd></div><div><dt>Per hour</dt><dd>${s.households_completed_per_hour}</dd></div><div><dt>Answer rate</dt><dd>${s.answer_rate}%</dd></div><div><dt>Both flyers</dt><dd>${s.households_receiving_both_flyers ?? 0}</dd></div><div><dt>Unknown flyer deliveries</dt><dd>${s.unknown_flyer_deliveries ?? 0}</dd></div></dl><div class="flyer-summary"><strong>Households by flyer</strong>${(s.flyer_breakdown ?? []).map((row: any) => `<span>${escapeHtml(row.short_name)}: <b>${Number(row.household_count).toLocaleString()}</b> households · ${Number(row.delivery_count).toLocaleString()} deliveries</span>`).join("")}</div><div class="legend">${Object.entries(
        statusColors,
      )
        .map(
          ([s, c]) =>
            `<span><i style="background:${c}"></i>${s.replaceAll("_", " ")}</span>`,
        )
        .join("")}</div>`;
    renderFlyerControls();
    const mobileSummary = document.querySelector<HTMLElement>("#mobile-summary-content"),
      summary = document.querySelector<HTMLElement>("#summary");
    if (mobileSummary && summary && !document.querySelector<HTMLElement>("#mobile-summary-sheet")!.hidden)
      mobileSummary.innerHTML = summary.innerHTML;
    renderRoutes();
    renderSession();
  }
  const toggleHouseholds = (homes: Household[], fromMap = false) => {
    const key = homes
        .map((home) => home.household_id)
        .sort()
        .join("|"),
      now = Date.now();
    if (
      fromMap &&
      lastMapSelection.key === key &&
      now - lastMapSelection.at < 450
    )
      return;
    if (fromMap) lastMapSelection = { key, at: now };
    const remove = homes.every((home) => selected.has(home.household_id));
    for (const home of homes)
      remove
        ? selected.delete(home.household_id)
        : selected.add(home.household_id);
    updateSelection();
    toast(
      `${selected.size} household${selected.size === 1 ? "" : "s"} selected`,
    );
  };
  function pickStructure(
    e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
  ) {
    const rendered = map.queryRenderedFeatures(e.point, {
      layers: ["structures"],
    });
    const picked = rendered
        .map((renderedFeature) =>
          structureFeatureById.get(
            String(renderedFeature.properties?.structure_id ?? ""),
          ),
        )
        .filter(Boolean)
        .map((feature) => ({ feature, homes: homesForStructure(feature) }))
        .sort((left, right) => right.homes.length - left.homes.length)[0],
      homes = picked?.homes ?? [];
    if (!homes.length) {
      const structureId = String(rendered[0]?.properties?.structure_id ?? ""),
        structure = structureFeatureById.get(structureId);
      if (structure) return showUnlinkedStructure(structure);
      return toast("No civic address is linked to this structure");
    }
    if (multiSelectMode) {
      toggleHouseholds(homes, true);
      return;
    }
    persist({ household_id: homes[0].household_id });
    showHouseholds(homes, picked?.feature);
  }
  const appendCivicEditor = (
    container: HTMLElement,
    structure: any,
    homes: Household[],
    separateReference = false,
  ) => {
    if (document.querySelector<HTMLInputElement>("#volunteer-mode")!.checked)
      return;
    const section = document.createElement("section"),
      civic = document.createElement("input"),
      street = document.createElement("input"),
      save = document.createElement("button");
    section.className = "association-review civic-number-editor";
    section.innerHTML = separateReference
      ? "<h3>Separate this roof</h3><p>This roof currently shares a nearby address. Give it its own civic address when it is a separate residence or the automatic classification is wrong.</p>"
      : "<h3>Building civic number</h3><p>Corrections are audited and reused during map regeneration.</p>";
    civic.value = homes[0]?.civic_number ?? "";
    civic.placeholder = "Civic number";
    civic.inputMode = "text";
    civic.setAttribute("aria-label", "Civic number");
    street.value = homes[0]?.street ?? "";
    street.placeholder = "Street name";
    street.setAttribute("aria-label", "Street name");
    save.textContent = separateReference
      ? "Make separate address"
      : homes.length
        ? "Update building number"
        : "Set number";
    save.addEventListener("click", async () => {
      save.disabled = true;
      try {
        await postJson(
          `/api/canvassing/structures/${structure.properties.structure_id}/civic-number`,
          {
            civic_number: civic.value,
            street: street.value,
            reason: "manual canvassing map correction",
          },
        );
        await refresh();
        const updated =
          byStructure.get(structure.properties.structure_id) ?? [];
        if (updated.length) showHouseholds(updated, structure);
        toast("Building number correction appended");
      } catch (error) {
        toast(
          error instanceof Error ? error.message : "Number correction failed",
        );
      } finally {
        save.disabled = false;
      }
    });
    section.append(civic, street, save);
    container.append(section);
  };
  const setSplitPreview = (preview?: any) => {
    splitPreview = preview;
    (
      map.getSource("split-preview") as GeoJSONSource | undefined
    )?.setData({
      type: "FeatureCollection",
      features:
        preview?.children.map((child: any, index: number) => ({
          type: "Feature",
          properties: { index: index + 1, area_m2: child.area_m2 },
          geometry: child.geometry,
        })) ?? [],
    });
    const status = document.querySelector<HTMLElement>("#split-status");
    if (status)
      status.textContent = preview
        ? `${preview.children.length} roofs · ${preview.children
            .map((child: any) => `${child.area_m2} m2`)
            .join(" · ")}`
        : "No preview yet";
    const accept =
      document.querySelector<HTMLButtonElement>("#split-accept");
    if (accept) accept.disabled = !preview;
  };
  async function previewSplit(method?: "cut_lines" | "frontage") {
    if (!splitTarget) return;
    const selectedMethod =
      method ??
      (document.querySelector<HTMLSelectElement>("#split-method")?.value as
        | "cut_lines"
        | "frontage");
    try {
      const preview = await fetchJson<any>(
        `/api/canvassing/structures/${splitTarget.properties.structure_id}/split/preview`,
        {
          method: "POST",
          body: JSON.stringify({
            method: selectedMethod,
            cuts: splitCuts,
            unit_count: Number(
              document.querySelector<HTMLInputElement>("#split-count")
                ?.value ?? 2,
            ),
            rotate:
              document.querySelector<HTMLInputElement>("#split-rotate")
                ?.checked ?? false,
          }),
        },
      );
      setSplitPreview(preview);
      toast(`${preview.children.length} split roofs previewed`);
    } catch (error) {
      setSplitPreview();
      toast(error instanceof Error ? error.message : "Split preview failed");
    }
  }
  function closeSplitEditor() {
    splitTarget = undefined;
    splitDrawing = false;
    splitCutStart = undefined;
    splitCuts = [];
    setSplitPreview();
    if (active) showHouseholds([active]);
  }
  function renderSplitEditor(structure: any) {
    splitTarget = structure;
    splitDrawing = false;
    splitCutStart = undefined;
    splitCuts = [];
    setSplitPreview();
    const drawer = document.querySelector<HTMLElement>("#drawer")!;
    drawer.innerHTML = `<div class="drawer-head"><div><small>Private geometry correction</small><h2>Split roof ${structure.properties.civic_label ?? ""}</h2><span>Preview before accepting</span></div><button id="drawer-close" class="drawer-close" aria-label="Close roof details">Close</button></div><section class="split-editor"><label>Method<select id="split-method"><option value="cut_lines">Draw cut lines</option><option value="frontage">Divide frontage</option></select></label><div id="split-frontage" hidden><label>Number of roofs<input id="split-count" type="number" min="2" max="20" value="2"></label><label><input id="split-rotate" type="checkbox"> Rotate division 90 degrees</label></div><p id="split-instructions">Draw cuts through false bridges by tapping opposite sides of the roof.</p><div class="split-actions"><button id="split-draw">Draw a cut</button><button id="split-preview">Preview</button><button id="split-clear">Clear cuts</button></div><p id="split-status">No preview yet</p><div class="split-commit"><button id="split-accept" disabled>Accept split</button><button id="split-cancel">Cancel</button></div></section>`;
    openMobileDrawer();
    const method =
      document.querySelector<HTMLSelectElement>("#split-method")!;
    method.addEventListener("change", () => {
      const frontage = method.value === "frontage";
      document.querySelector<HTMLElement>("#split-frontage")!.hidden =
        !frontage;
      document.querySelector<HTMLButtonElement>("#split-draw")!.hidden =
        frontage;
      document.querySelector("#split-instructions")!.textContent = frontage
        ? "Choose how many frontage units this roof contains."
        : "Draw cuts through false bridges by tapping opposite sides of the roof.";
      splitCuts = [];
      setSplitPreview();
    });
    document.querySelector("#split-draw")!.addEventListener("click", () => {
      splitDrawing = true;
      splitCutStart = undefined;
      toast("Tap one side of the false bridge");
    });
    document
      .querySelector("#split-preview")!
      .addEventListener("click", () => void previewSplit());
    document.querySelector("#split-clear")!.addEventListener("click", () => {
      splitCuts = [];
      splitCutStart = undefined;
      splitDrawing = false;
      setSplitPreview();
    });
    document
      .querySelector("#split-cancel")!
      .addEventListener("click", closeSplitEditor);
    document.querySelector("#split-accept")!.addEventListener("click", async () => {
      if (!splitPreview || !splitTarget || submitting) return;
      submitting = true;
      const button =
        document.querySelector<HTMLButtonElement>("#split-accept")!;
      button.disabled = true;
      try {
        await fetchJson(
          `/api/canvassing/structures/${splitTarget.properties.structure_id}/split`,
          {
            method: "POST",
            body: JSON.stringify({
              submission_key: crypto.randomUUID(),
              method: document.querySelector<HTMLSelectElement>("#split-method")!
                .value,
              cuts: splitCuts,
              unit_count: Number(
                document.querySelector<HTMLInputElement>("#split-count")!
                  .value,
              ),
              rotate:
                document.querySelector<HTMLInputElement>("#split-rotate")!
                  .checked,
              reference_address_ids:
                splitTarget.properties.address_reference_ids ?? [],
              reason: "manual canvassing roof correction",
            }),
          },
        );
        toast("Roof split accepted");
        window.setTimeout(() => window.location.reload(), 350);
      } catch (error) {
        submitting = false;
        button.disabled = false;
        toast(error instanceof Error ? error.message : "Split failed");
      }
    });
  }
  function showUnlinkedStructure(structure: any) {
    const drawer = document.querySelector<HTMLElement>("#drawer")!;
    drawer.innerHTML = `<div class="drawer-head"><div><small>Reference roof</small><h2>Address needs review</h2><span>${String(structure.properties.building_type ?? "unclassified").replaceAll("_", " ")}</span></div><button id="drawer-close" class="drawer-close" aria-label="Close roof details">Close</button></div><section class="association-review"><h3>Building source</h3><p>${structure.properties.external_source} ${structure.properties.external_id} · ${structure.properties.confidence}</p></section>`;
    openMobileDrawer();
    appendCivicEditor(drawer, structure, []);
    if (!document.querySelector<HTMLInputElement>("#volunteer-mode")!.checked) {
      const split = document.createElement("button");
      split.textContent = "Split roof";
      split.addEventListener("click", () => renderSplitEditor(structure));
      drawer.append(split);
    }
  }
  function pickAddress(
    e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
  ) {
    const id = String(e.features?.[0]?.properties?.household_id ?? "");
    const home = state.households.find((h) => h.household_id === id);
    if (home?.structure_id) return;
    if (home) {
      if (multiSelectMode) {
        toggleHouseholds([home], true);
        return;
      }
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
  async function renderContactEditor(
    householdId: string,
    selectedPersonId?: string,
  ) {
    const section =
      document.querySelector<HTMLElement>("#contact-editor");
    if (!section || active?.household_id !== householdId) return;
    try {
      let contacts = contactCache.get(householdId);
      if (!contacts) {
        contacts = await fetchJson<Contact[]>(
          `/api/canvassing/households/${householdId}/contacts`,
        );
        contactCache.set(householdId, contacts);
      }
      if (!section.isConnected || active?.household_id !== householdId) return;
      const draw = (contact?: Contact, blank = false) => {
        const current = blank ? undefined : contact ?? contacts![0],
          civicNumber = current?.civic_number ?? active?.civic_number ?? "",
          street = current?.street ?? active?.street ?? "";
        section.innerHTML = `<h3>Private contact</h3>${
          contacts!.length
            ? `<div class="contact-switcher"><select id="contact-person">${contacts!
                .map(
                  (person) =>
                    `<option value="${escapeHtml(person.person_id)}" ${
                      person.person_id === current?.person_id ? "selected" : ""
                    }>${escapeHtml(person.name || person.email || person.phone || "Unnamed contact")}</option>`,
                )
                .join("")}</select><button id="contact-new" type="button">New person</button></div>`
            : ""
        }<div class="contact-address"><label>Civic number<input readonly value="${escapeHtml(civicNumber)}"></label><label>Street<input readonly value="${escapeHtml(street)}"></label></div><div class="contact-fields"><label>Name<input id="contact-name" autocomplete="name" value="${escapeHtml(current?.name)}"></label><label>Phone<input id="contact-phone" type="tel" autocomplete="tel" value="${escapeHtml(current?.phone)}"></label><label>Email<input id="contact-email" type="email" autocomplete="email" value="${escapeHtml(current?.email)}"></label><label class="mailing-consent"><input id="contact-mailing" type="checkbox" ${current?.mailing_list_consent ? "checked" : ""}> Mailing list</label><button id="contact-save" type="button">Save contact</button></div>`;
        document
          .querySelector<HTMLSelectElement>("#contact-person")
          ?.addEventListener("change", (event) =>
            draw(
              contacts!.find(
                (person) =>
                  person.person_id ===
                  (event.target as HTMLSelectElement).value,
              ),
            ),
          );
        document
          .querySelector("#contact-new")
          ?.addEventListener("click", () => draw(undefined, true));
        document
          .querySelector<HTMLButtonElement>("#contact-save")!
          .addEventListener("click", async (event) => {
            const button = event.currentTarget as HTMLButtonElement;
            button.disabled = true;
            button.textContent = "Saving...";
            try {
              const savedContact = await fetchJson<Contact>(
                `/api/canvassing/households/${householdId}/contacts`,
                {
                  method: "POST",
                  body: JSON.stringify({
                    person_id: current?.person_id ?? null,
                    name:
                      document.querySelector<HTMLInputElement>("#contact-name")!
                        .value,
                    phone:
                      document.querySelector<HTMLInputElement>("#contact-phone")!
                        .value,
                    email:
                      document.querySelector<HTMLInputElement>("#contact-email")!
                        .value,
                    mailing_list_consent:
                      document.querySelector<HTMLInputElement>(
                        "#contact-mailing",
                      )!.checked,
                    source: "candidate",
                  }),
                },
              );
              const next = current
                ? contacts!.map((person) =>
                    person.person_id === savedContact.person_id
                      ? savedContact
                      : person,
                  )
                : [...contacts!, savedContact];
              contacts = next;
              contactCache.set(householdId, next);
              if (active?.household_id === householdId)
                active.last_updated_at = savedContact.last_updated_at;
              draw(savedContact);
              toast("Private contact saved");
            } catch (error) {
              button.disabled = false;
              button.textContent = "Save contact";
              toast(
                error instanceof Error
                  ? error.message
                  : "Contact could not be saved",
              );
            }
          });
      };
      draw(
        contacts.find((person) => person.person_id === selectedPersonId),
      );
    } catch (error) {
      if (section.isConnected)
        section.innerHTML = `<h3>Private contact</h3><span>${escapeHtml(
          error instanceof Error ? error.message : "Contact details unavailable",
        )}</span>`;
    }
  }
  function showHouseholds(homes: Household[], clickedStructure?: any) {
    active = homes[0];
    const volunteer =
        document.querySelector<HTMLInputElement>("#volunteer-mode")!.checked,
      today = localDateValue(),
      latestDate = active.last_updated_at
        ? localDateValue(active.last_updated_at)
        : today,
      flyerCurrent = Boolean(active.flyer_delivered),
      noAnswerCurrent = Boolean(active.no_answer),
      talkedCurrent = Boolean(active.conversation_occurred),
      revisitCurrent = Boolean(active.revisit_requested);
    document.querySelector("#drawer")!.innerHTML =
      `<div class="drawer-head"><div><small>${homes.length > 1 ? `${homes.length} units at structure` : "Household"}</small><h2>${active.label || "Address needs review"}</h2><span>${active.association_status.replaceAll("_", " ")} · ${active.visit_count} visits${active.last_updated_at ? ` · updated ${latestDate}` : ""}</span></div><div class="drawer-head-actions"><button id="add-selection">${selected.has(active.household_id) ? "Remove" : "Add to route"}</button><button id="drawer-close" class="drawer-close" aria-label="Close household details">Close</button></div></div>${homes.length > 1 ? `<div class="unit-tabs">${homes.map((h) => `<button data-household="${h.household_id}">${h.unit || h.label}</button>`).join("")}</div>` : ""}<label class="visit-date">Visit date<input id="visit-date" type="date" value="${latestDate}"></label><div class="visit-flags"><label><input id="visit-flyer" type="checkbox" data-initial="${flyerCurrent}" ${flyerCurrent ? "checked" : ""}><span>${flyerCurrent ? "Flyered" : activeFlyerId ? `Flyer · ${escapeHtml(flyerLabel(activeFlyerId))}` : "Flyer · choose active flyer"}</span></label><label><input id="visit-no-answer" type="checkbox" data-initial="${noAnswerCurrent}" ${noAnswerCurrent ? "checked" : ""}><span>No answer</span></label><label><input id="visit-talked" type="checkbox" data-initial="${talkedCurrent}" ${talkedCurrent ? "checked" : ""}><span>Talked</span></label><label><input id="visit-revisit" type="checkbox" data-initial="${revisitCurrent}" ${revisitCurrent ? "checked" : ""}><span>Revisit</span></label></div><div class="visit-commands"><button id="save-visit">Save changes</button><button id="skip-household">Skip</button></div>${
        volunteer
          ? ""
          : `<div class="private-fields"><label>Political outcome<select id="outcome" data-initial="${escapeHtml(active.political_outcome ?? "")}"><option value="">Not recorded</option>${[
              "supportive",
              "undecided",
              "opposed",
              "volunteer_interest",
              "lawn_sign_interest",
              "vacant",
              "no_campaign_material_requested",
            ]
              .map(
                (s) =>
                  `<option value="${s}" ${active!.political_outcome === s ? "selected" : ""}>${s.replaceAll("_", " ")}</option>`,
              )
              .join(
                "",
              )}</select></label><label>Issues<input id="issues" placeholder="housing; transit; affordability"></label><label>Private notes<textarea id="notes" rows="3"></textarea></label><label>Follow-up<input id="follow-up"></label><label>Follow-up due<input id="follow-date" type="date"></label></div><section class="contact-editor" id="contact-editor"><h3>Private contact</h3><span>Loading...</span></section>`
      }`;
    openMobileDrawer();
    const historySection = document.createElement("section");
    historySection.className = "flyer-history";
    historySection.innerHTML = `<h3>Flyer delivery history</h3>${active.flyer_history?.length ? `<ul>${active.flyer_history.map((event) => `<li><strong>${escapeHtml(event.flyer_name)}</strong> · ${escapeHtml(localDateValue(event.occurred_at))}<small>${escapeHtml(event.source)}</small></li>`).join("")}</ul>` : "<p>No flyer delivery recorded.</p>"}`;
    document.querySelector("#drawer .visit-flags")?.before(historySection);
    const addressFeature = addresses.features.find(
        (feature: any) => feature.properties.address_id === active!.address_id,
      ),
      primaryStructureFeature = structures.features.find(
        (feature: any) =>
          feature.properties.structure_id === active!.structure_id,
      ),
      structureFeature = clickedStructure ?? primaryStructureFeature,
      sharedReference =
        structureFeature &&
        structureFeature.properties.structure_id !== active.structure_id;
    const provenance = document.createElement("section");
    provenance.className = "association-review";
    provenance.innerHTML = `<h3>Building association</h3><p>${sharedReference ? `${String(structureFeature.properties.address_relation ?? "provisional reference").replaceAll("_", " ")} · shares ${active.label} · ${structureFeature.properties.address_reference_distance_m} m from addressed roof` : active.association_status.replaceAll("_", " ")}${addressFeature?.properties.address_confidence === "inferred_range" ? " · approximate civic number from official road range" : ""}${structureFeature ? ` · ${structureFeature.properties.external_source === "living_region_estimate" ? "estimated local roof" : `${structureFeature.properties.external_source} ${structureFeature.properties.external_id}`} · ${structureFeature.properties.confidence}${structureFeature.properties.source_components?.length ? ` · ${structureFeature.properties.source_components.join(" + ")}` : ""}` : " · point stop"}</p>`;
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
      clear.className = "association-detach";
      clear.textContent = "Detach address from this roof...";
      clear.addEventListener("click", async () => {
        if (
          !window.confirm(
            "Detach this address from its roof? Flyer, visit, conversation, and route history will be preserved.",
          )
        )
          return;
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
        toast("Address detached; campaign history preserved");
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
    const drawer = document.querySelector<HTMLElement>("#drawer")!;
    drawer.append(provenance);
    if (structureFeature)
      appendCivicEditor(drawer, structureFeature, homes, sharedReference);
    if (structureFeature && !volunteer) {
      const splitParent =
        structureFeature.properties.split_parent_structure_id;
      const split = document.createElement("button");
      split.className = "split-roof";
      split.textContent = splitParent ? "Split this roof again" : "Split roof";
      split.addEventListener("click", () =>
        renderSplitEditor(structureFeature),
      );
      drawer.append(split);
      if (splitParent) {
        const reverse = document.createElement("button");
        reverse.className = "split-reverse";
        reverse.textContent = "Undo parent building split";
        reverse.addEventListener("click", async () => {
          if (
            !window.confirm(
              "Restore the parent roof? Household and visit history will be preserved.",
            )
          )
            return;
          reverse.disabled = true;
          try {
            await fetchJson(
              `/api/canvassing/structures/${splitParent}/split/reverse`,
              { method: "POST", body: "{}" },
            );
            window.location.reload();
          } catch (error) {
            reverse.disabled = false;
            toast(
              error instanceof Error ? error.message : "Split reversal failed",
            );
          }
        });
        drawer.append(reverse);
      }
    }
    document.querySelector("#add-selection")!.addEventListener("click", () => {
      if (!active) return;
      toggleHouseholds([active]);
      showHouseholds(homes);
    });
    document.querySelectorAll<HTMLElement>("[data-household]").forEach((el) =>
      el.addEventListener("click", () => {
        active = homes.find((h) => h.household_id === el.dataset.household);
        showHouseholds(homes);
      }),
    );
    const flyer =
        document.querySelector<HTMLInputElement>("#visit-flyer")!,
      flyerCheckboxLabel = document.querySelector<HTMLElement>("#visit-flyer + span")!,
      saveButton =
        document.querySelector<HTMLButtonElement>("#save-visit")!,
      noAnswer =
        document.querySelector<HTMLInputElement>("#visit-no-answer")!,
      talked = document.querySelector<HTMLInputElement>("#visit-talked")!,
      visitDate =
        document.querySelector<HTMLInputElement>("#visit-date")!,
      advanceVisitDate = () => {
        if (visitDate.dataset.manual !== "true")
          visitDate.value = localDateValue();
      };
    visitDate.addEventListener(
      "input",
      () => (visitDate.dataset.manual = "true"),
    );
    flyer.addEventListener("change", () => {
      const removing =
        flyer.dataset.initial === "true" && !flyer.checked;
      flyerCheckboxLabel.textContent = removing
        ? "Remove flyer"
        : flyer.dataset.initial === "true"
          ? "Flyered"
          : "Flyer";
      saveButton.textContent = removing
        ? "Apply correction"
        : "Save changes";
    });
    document
      .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        "#drawer input:not(#visit-date):not(#follow-date), #drawer select, #drawer textarea",
      )
      .forEach((field) => field.addEventListener("change", advanceVisitDate));
    noAnswer.addEventListener("change", () => {
      if (noAnswer.checked) talked.checked = false;
    });
    talked.addEventListener("change", () => {
      if (talked.checked) noAnswer.checked = false;
    });
    document
      .querySelector("#save-visit")!
      .addEventListener("click", () => saveVisit(!volunteer));
    document
      .querySelector("#skip-household")!
      .addEventListener("click", skipCurrent);
    if (!volunteer) void renderContactEditor(active.household_id);
  }
  async function saveVisit(detailed = false) {
    if (!active || submitting) return;
    const visitDate =
        document.querySelector<HTMLInputElement>("#visit-date")!,
      dateWasManuallyEdited = visitDate.dataset.manual === "true",
      today = localDateValue();
    if (!dateWasManuallyEdited) visitDate.value = today;
    const flyerInput =
        document.querySelector<HTMLInputElement>("#visit-flyer")!,
      noAnswerInput =
        document.querySelector<HTMLInputElement>("#visit-no-answer")!,
      talkedInput =
        document.querySelector<HTMLInputElement>("#visit-talked")!,
      revisitInput =
        document.querySelector<HTMLInputElement>("#visit-revisit")!,
      flyerAdded =
        flyerInput.checked && flyerInput.dataset.initial !== "true",
      flyerRemoved =
        !flyerInput.checked && flyerInput.dataset.initial === "true",
      noAnswer =
        noAnswerInput.checked && noAnswerInput.dataset.initial !== "true",
      talked = talkedInput.checked && talkedInput.dataset.initial !== "true",
      revisit =
        revisitInput.checked && revisitInput.dataset.initial !== "true",
      outcomeSelect =
        document.querySelector<HTMLSelectElement>("#outcome"),
      politicalOutcome =
        outcomeSelect &&
        outcomeSelect.value !== (outcomeSelect.dataset.initial ?? "")
          ? outcomeSelect.value
          : "",
      outcome =
        politicalOutcome ||
        (revisit
          ? "revisit"
          : talked
            ? "conversation"
            : noAnswer
              ? "knocked_no_answer"
              : flyerAdded
                ? "flyer_delivered"
                : "");
    if (!outcome && !flyerRemoved)
      return toast("Change at least one household status");
    let allowDuplicateFlyer = false;
    if (flyerAdded) {
      if (!activeFlyerId)
        return toast("Choose an active flyer before recording delivery");
      if (active.flyer_ids?.includes(activeFlyerId)) {
        allowDuplicateFlyer = window.confirm(
          `${flyerLabel(activeFlyerId)} was already delivered here. Deliver it again intentionally?`,
        );
        if (!allowDuplicateFlyer) return;
      }
    }
    submitting = true;
    document
      .querySelectorAll<HTMLButtonElement>(".visit-commands button")
      .forEach((button) => (button.disabled = true));
    try {
      const occurredAt = dateWasManuallyEdited
          ? `${visitDate.value}T12:00:00.000Z`
          : undefined,
        source = document.querySelector<HTMLInputElement>("#volunteer-mode")!
          .checked
          ? "volunteer"
          : "candidate";
      if (outcome)
        await fetchJson("/api/canvassing/visits", {
          method: "POST",
          body: JSON.stringify({
            submission_key: crypto.randomUUID(),
            session_id: activeSessionId || null,
            household_id: active.household_id,
            route_id:
              document.querySelector<HTMLSelectElement>("#active-route")!
                .value || null,
            occurred_at: occurredAt,
            outcome,
            flyer_delivered: flyerAdded,
            flyer_id: flyerAdded ? activeFlyerId : null,
            allow_duplicate_flyer: allowDuplicateFlyer,
            door_knocked: noAnswer || talked || Boolean(politicalOutcome),
            conversation_occurred: talked || Boolean(politicalOutcome),
            revisit_requested: revisit,
            no_answer: noAnswer,
            issue_categories: detailed
              ? (
                  document.querySelector<HTMLInputElement>("#issues")?.value ??
                  ""
                )
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
            source,
          }),
        });
      if (flyerRemoved)
        await fetchJson(
          `/api/canvassing/households/${active.household_id}/flyer-status`,
          {
            method: "POST",
            body: JSON.stringify({
              flyer_delivered: false,
              occurred_at: occurredAt,
              reason: "manual correction from household drawer",
              source,
            }),
          },
        );
      await refresh();
      toast(
        flyerRemoved && !outcome
          ? "Flyer status removed; history preserved"
          : "Household status updated",
      );
    } finally {
      submitting = false;
      document
        .querySelectorAll<HTMLButtonElement>(".visit-commands button")
        .forEach((button) => (button.disabled = false));
    }
  }
  async function refresh() {
    state = await fetchJson<State>("/api/canvassing/state");
    byStructure.clear();
    byAddress.clear();
    for (const h of state.households) {
      byAddress.set(h.address_id, h);
      if (h.structure_id)
        byStructure.set(h.structure_id, [
          ...(byStructure.get(h.structure_id) ?? []),
          h,
        ]);
      if (active?.household_id === h.household_id) active = h;
    }
    for (const feature of structures.features) {
      const homes = homesForStructure(feature);
      feature.properties.status =
        homes.sort((a, b) => statusRank(b.status) - statusRank(a.status))[0]
          ?.status ?? "untouched";
      feature.properties.flyer_ids = [
        ...new Set(homes.flatMap((home) => home.flyer_ids ?? [])),
      ];
      feature.properties.household_count = homes.length;
      const civicNumbers = [
        ...new Set(homes.map((home) => home.civic_number)),
      ].sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true }),
      );
      const inferredOnly =
        homes.length > 0 &&
        homes.every(
          (home) =>
            home.association_status === "inferred_range" &&
            !home.number_corrected,
        );
      feature.properties.civic_numbers = civicNumbers;
      feature.properties.civic_label = civicNumbers.length
        ? civicNumbers.length <= 3
          ? `${inferredOnly ? "~" : ""}${civicNumbers.join(" / ")}`
          : `${inferredOnly ? "~" : ""}${civicNumbers[0]} +${civicNumbers.length - 1}`
        : "";
    }
    for (const feature of addresses.features) {
      const home = byAddress.get(String(feature.properties.address_id));
      const eligible = Boolean(
        home && !isKnownNonResidential(home) && isCoverageEligible(home),
      );
      const covered = Boolean(home && eligible && isCoverageCovered(home));
      feature.properties.household_id = home?.household_id;
      feature.properties.status = home?.status ?? "untouched";
      feature.properties.selected = Boolean(
        home && selected.has(home.household_id),
      );
      feature.properties.eligible = eligible;
      feature.properties.covered = covered;
      feature.properties.eligible_count = eligible ? 1 : 0;
      feature.properties.covered_count = covered ? 1 : 0;
      feature.properties.remaining_count = eligible && !covered ? 1 : 0;
      feature.properties.flyer_ids = home?.flyer_ids ?? [];
    }
    coverageAdjacencyGraph = buildHouseholdAdjacencyGraph(
      coverageLocations(),
      roads.features,
    );
    if (nextAreaPinned && nextAreaRecommendation) {
      const updated = recommendationFromLocalArea(
        calculateLocalCoverageArea(
          nextAreaRecommendation.center_household_id,
          coverageLocations(),
          coverageAdjacencyGraph,
        ),
      );
      nextAreaRecommendation = updated
        ? { ...updated, cluster_id: nextAreaRecommendation.cluster_id }
        : null;
    }
    (map.getSource("structures") as GeoJSONSource | undefined)?.setData(
      structures,
    );
    applyMapFilters();
    map.once("idle", scheduleNextAreaUpdate);
    updateLabels();
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
    const mobileRouteBar = document.querySelector<HTMLElement>("#mobile-route-bar");
    if (mobileRouteBar) mobileRouteBar.hidden = !current;
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
    syncMobileLocationControl();
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
      syncMobileLocationControl();
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
    syncMobileLocationControl();
  }
  function applySelectionFeatureState() {
    if (!map.getSource("structures") || !map.getSource("addresses")) return;
    const nextStructures = new Set<string>(),
      nextAddresses = new Set<string>();
    for (const householdId of selected) {
      for (const structureId of structureIdsByHousehold.get(householdId) ?? [])
        nextStructures.add(structureId);
      const home = state.households.find(
        (candidate) => candidate.household_id === householdId,
      );
      if (home) nextAddresses.add(home.address_id);
    }
    for (const structureId of selectedStructureStates)
      if (!nextStructures.has(structureId))
        map.setFeatureState(
          { source: "structures", id: structureId },
          { selected: false },
        );
    for (const structureId of nextStructures)
      if (!selectedStructureStates.has(structureId))
        map.setFeatureState(
          { source: "structures", id: structureId },
          { selected: true },
        );
    for (const addressId of selectedAddressStates)
      if (!nextAddresses.has(addressId))
        map.setFeatureState(
          { source: "addresses", id: addressId },
          { selected: false },
        );
    for (const addressId of nextAddresses)
      if (!selectedAddressStates.has(addressId))
        map.setFeatureState(
          { source: "addresses", id: addressId },
          { selected: true },
        );
    selectedStructureStates = nextStructures;
    selectedAddressStates = nextAddresses;
  }
  function updateSelection() {
    applySelectionFeatureState();
    const count = selected.size,
      multiSelect = document.querySelector<HTMLButtonElement>("#multi-select")!,
      bulkFlyer = document.querySelector<HTMLButtonElement>("#bulk-flyer")!,
      clear = document.querySelector<HTMLButtonElement>("#clear-selection")!,
      status = document.querySelector<HTMLElement>("#bulk-selection-status")!,
      bar = document.querySelector<HTMLElement>("#bulk-selection-bar")!;
    document.querySelector("#selection-count")!.textContent = String(count);
    multiSelect.textContent = multiSelectMode ? "Done selecting" : "Bulk flyer";
    multiSelect.setAttribute("aria-pressed", String(multiSelectMode));
    multiSelect.classList.toggle("active", multiSelectMode);
    status.textContent = submitting
      ? `Saving ${count} household${count === 1 ? "" : "s"}...`
      : multiSelectMode
        ? count
          ? `${count} household${count === 1 ? "" : "s"} selected`
          : "Tap each roof to select it"
        : count
          ? `${count} household${count === 1 ? "" : "s"} ready`
          : "Tap Bulk flyer, then tap roofs";
    bulkFlyer.textContent = submitting
      ? "Saving..."
      : count
        ? `Mark ${count} flyered`
        : "Mark selected flyered";
    bulkFlyer.disabled = count === 0 || submitting;
    clear.disabled = count === 0;
    bar.classList.toggle("has-selection", count > 0);
    bar.classList.toggle("active", multiSelectMode);
    document
      .querySelector(".canvass-shell")!
      .classList.toggle("multi-selecting", multiSelectMode);
    persist({
      multi_select: multiSelectMode,
      selected_household_ids: [...selected],
    });
  }
  updateSelection();
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
  document.querySelector("#multi-select")!.addEventListener("click", () => {
    if (!multiSelectMode && coverage) {
      coverage = false;
      persist({ coverage_mode: false });
      setCoverageMode(false);
      if (map.getZoom() < 15.5)
        map.easeTo({ zoom: 15.5, duration: 250 });
    }
    multiSelectMode = !multiSelectMode;
    updateSelection();
    toast(
      multiSelectMode
        ? "Tap roofs to add or remove them"
        : `${selected.size} household${selected.size === 1 ? "" : "s"} kept selected`,
    );
  });
  document.querySelector("#clear-selection")!.addEventListener("click", () => {
    selected.clear();
    updateSelection();
    toast("Selection cleared");
  });
  document.querySelector("#bulk-flyer")!.addEventListener("click", async () => {
    if (submitting || !selected.size) return;
    if (!activeFlyerId) {
      toast("Choose an active flyer before marking delivery");
      if (window.matchMedia("(max-width: 760px)").matches)
        setMobilePanel(mobilePanels[0], true);
      return;
    }
    const householdIds = [...selected];
    const duplicateCount = householdIds.filter((householdId) =>
      state.households
        .find((home) => home.household_id === householdId)
        ?.flyer_ids?.includes(activeFlyerId),
    ).length;
    const allowDuplicateFlyer = duplicateCount
      ? window.confirm(
          `${duplicateCount} selected household${duplicateCount === 1 ? " has" : "s have"} already received ${flyerLabel(activeFlyerId)}. Deliver again intentionally?`,
        )
      : false;
    if (duplicateCount && !allowDuplicateFlyer) return;
    const batchKey = crypto.randomUUID();
    submitting = true;
    updateSelection();
    try {
      const results = await Promise.allSettled(
        householdIds.map((household_id) =>
          fetchJson("/api/canvassing/visits", {
            method: "POST",
            body: JSON.stringify({
              submission_key: `${batchKey}:${household_id}`,
              session_id: activeSessionId || null,
              household_id,
              outcome: "flyer_delivered",
              flyer_delivered: true,
              flyer_id: activeFlyerId,
              allow_duplicate_flyer: allowDuplicateFlyer,
              door_knocked: false,
              source: document.querySelector<HTMLInputElement>(
                "#volunteer-mode",
              )!.checked
                ? "volunteer"
                : "candidate",
            }),
          }),
        ),
      );
      const failedIds = householdIds.filter(
        (_, index) => results[index].status === "rejected",
      );
      selected.clear();
      failedIds.forEach((id) => selected.add(id));
      multiSelectMode = failedIds.length > 0;
      updateSelection();
      const savedCount = householdIds.length - failedIds.length;
      toast(
        failedIds.length
          ? `${savedCount} marked flyered; ${failedIds.length} still selected for retry`
          : `${savedCount} household${
              savedCount === 1 ? "" : "s"
            } marked flyer delivered`,
      );
      void refresh().catch((error) =>
        toast(
          error instanceof Error
            ? `Saved, but map refresh failed: ${error.message}`
            : "Saved, but map refresh failed",
        ),
      );
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Bulk flyer update failed",
      );
    } finally {
      submitting = false;
      updateSelection();
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
  const chooseActiveFlyer = (value: string) => {
    activeFlyerId = value;
    persist({ active_flyer_id: value });
    renderFlyerControls();
  };
  for (const id of ["active-flyer", "mobile-active-flyer"])
    document.querySelector<HTMLSelectElement>(`#${id}`)?.addEventListener(
      "change",
      (event) => chooseActiveFlyer((event.target as HTMLSelectElement).value),
    );
  const chooseFlyerFilter = (value: string) => {
    flyerFilter = value;
    persist({ flyer_filter: value });
    applyMapFilters();
    updateLabels();
  };
  for (const id of ["flyer-filter", "mobile-flyer-filter"])
    document.querySelector<HTMLSelectElement>(`#${id}`)?.addEventListener(
      "change",
      (event) => chooseFlyerFilter((event.target as HTMLSelectElement).value),
    );
  document.querySelector("#status-filter")!.addEventListener("change", (e) => {
    const value = (e.target as HTMLSelectElement).value;
    persist({ status_filter: value });
    applyMapFilters();
    updateLabels();
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
    persist({ coverage_mode: coverage });
    setCoverageMode(coverage);
    map.easeTo({ zoom: coverage ? 12.2 : 15 });
    toast(
      coverage
        ? "Bubbles show eligible households remaining; tap one for coverage totals"
      : "Individual household view enabled",
    );
  });
  const findNextArea = async (openPopup = false) => {
    await recalculateNextArea();
    if (openPopup && nextAreaRecommendation) openNextAreaPopup();
    toast(
      nextAreaRecommendation
        ? "Next underflyered area recalculated"
        : "Citywide coverage is complete",
    );
  };
  document.querySelector("#find-next-area")!.addEventListener("click", () => {
    void findNextArea();
  });
  const openMobileMenu = () => setMobilePanel(mobilePanels[0], true);
  const openMobileCoverage = () => {
    refreshMobileCoverageLegend();
    setMobilePanel(mobilePanels[1], true);
  };
  const openMobileSummary = () => {
    const summary = document.querySelector("#summary"),
      target = document.querySelector("#mobile-summary-content");
    if (summary && target) target.innerHTML = summary.innerHTML;
    setMobilePanel(mobilePanels[2], true);
  };
  document.querySelector("#mobile-menu")!.addEventListener("click", openMobileMenu);
  document.querySelector("#mobile-coverage")!.addEventListener("click", openMobileCoverage);
  document.querySelector("#mobile-menu-close")!.addEventListener("click", () => setMobilePanel(mobilePanels[0], false));
  document.querySelector("#mobile-coverage-close")!.addEventListener("click", () => setMobilePanel(mobilePanels[1], false));
  document.querySelector("#mobile-summary-close")!.addEventListener("click", () => setMobilePanel(mobilePanels[2], false));
  document.querySelector("#mobile-summary-open")!.addEventListener("click", openMobileSummary);
  document.querySelector("#mobile-find-next-area")!.addEventListener("click", () => {
    setMobilePanel(mobilePanels[0], false);
    void findNextArea(true);
  });
  document.querySelector("#mobile-tools-open")!.addEventListener("click", openMobileTools);
  document.querySelector("#mobile-tools-close")!.addEventListener("click", closeMobileTools);
  document.querySelector("#mobile-bulk-open")!.addEventListener("click", () => {
    setMobilePanel(mobilePanels[0], false);
    document.querySelector<HTMLButtonElement>("#multi-select")!.click();
  });
  document
    .querySelector("#mobile-next-area")!
    .addEventListener("click", openNextAreaPopup);
  const forwardMobileAction = (source: string) => {
    setMobilePanel(mobilePanels[0], false);
    document.querySelector<HTMLButtonElement>(source)?.click();
  };
  document.querySelector("#mobile-followup-open")!.addEventListener("click", () => forwardMobileAction("#followup-open"));
  document.querySelector("#mobile-conversation-open")!.addEventListener("click", () => forwardMobileAction("#conversation-open"));
  document.querySelector("#mobile-recruitment-open")!.addEventListener("click", () => forwardMobileAction("#recruitment-open"));
  document.querySelector("#mobile-quality-open")!.addEventListener("click", () => forwardMobileAction("#quality-open"));
  document.querySelector("#mobile-import-open")!.addEventListener("click", () => forwardMobileAction("#import-open"));
  document.querySelector("#mobile-print-open")!.addEventListener("click", () => forwardMobileAction("#print-route"));
  document.querySelector("#mobile-locate")!.addEventListener("click", () => {
    if (currentPosition) document.querySelector<HTMLButtonElement>("#recenter")!.click();
    else document.querySelector<HTMLButtonElement>("#locate")!.click();
  });
  document.querySelector("#mobile-previous-stop")!.addEventListener("click", () => document.querySelector<HTMLButtonElement>("#previous-stop")!.click());
  document.querySelector("#mobile-next-stop")!.addEventListener("click", () => document.querySelector<HTMLButtonElement>("#next-stop")!.click());
  document.querySelector("#mobile-mark-stop")!.addEventListener("click", () => {
    const save = document.querySelector<HTMLButtonElement>("#save-visit");
    if (save) save.click();
    else toast("Select the current route stop first");
  });
  document.querySelector("#mobile-route-more")!.addEventListener("click", openMobileTools);
  document.querySelector("#drawer")!.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("#drawer-close")) closeMobileDrawer();
  });
  let drawerTouchStartY = 0;
  document.querySelector("#drawer")!.addEventListener("touchstart", (event) => {
    drawerTouchStartY = (event as TouchEvent).changedTouches[0]?.clientY ?? 0;
  }, { passive: true });
  document.querySelector("#drawer")!.addEventListener("touchend", (event) => {
    if (((event as TouchEvent).changedTouches[0]?.clientY ?? drawerTouchStartY) - drawerTouchStartY > 56)
      closeMobileDrawer();
  }, { passive: true });
  const qualityDialog =
    document.querySelector<HTMLDialogElement>("#quality-dialog")!;
  document.querySelector("#quality-open")!.addEventListener("click", () => {
    document.querySelector("#quality-metrics")!.innerHTML =
      `<h3>Roof coverage</h3><dl>${Object.entries(buildingCoverage)
        .filter(
          ([key, value]) =>
            key !== "generated_at" &&
            key !== "association_counts" &&
            typeof value === "number",
        )
        .map(
          ([key, value]) =>
            `<div><dt>${key.replaceAll("_", " ")}</dt><dd>${Number(value).toLocaleString()}</dd></div>`,
        )
        .join("")}</dl><h3>Address quality</h3><dl>${Object.entries(
        addressQuality.totals,
      )
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
  const flyerDialog = document.querySelector<HTMLDialogElement>("#flyer-dialog")!;
  const openFlyerCatalogue = () => {
    if (document.querySelector<HTMLInputElement>("#volunteer-mode")!.checked)
      return toast("Flyer catalogue editing is hidden in volunteer mode");
    renderFlyerCatalogue();
    flyerDialog.showModal();
  };
  document.querySelector("#flyer-catalogue-open")!.addEventListener("click", openFlyerCatalogue);
  document.querySelector("#mobile-flyer-catalogue-open")!.addEventListener("click", () => {
    setMobilePanel(mobilePanels[0], false);
    openFlyerCatalogue();
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
