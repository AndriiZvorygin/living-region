import { appendFile, mkdir, readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { DatabaseSync, backup } from "node:sqlite";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const root = resolve(process.cwd());
const host = process.env.CANVASS_HOST ?? "127.0.0.1";
const port = Number(process.env.CANVASS_PORT ?? 4174);
const token = process.env.CANVASS_AUTH_TOKEN ?? "";
if (!["127.0.0.1", "localhost", "::1"].includes(host) && !token) throw new Error("CANVASS_AUTH_TOKEN is required when canvassing server is exposed beyond localhost");
const storePath = resolve(process.env.CANVASS_DB ?? "private/canvassing/owen-sound.sqlite");
const journalPath = resolve(process.env.CANVASS_EVENT_LOG ?? "private/canvassing/visits.pya.jsonl");
await mkdir(dirname(storePath), { recursive: true });
const db = new DatabaseSync(storePath);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS structures (id TEXT PRIMARY KEY, geometry_json TEXT NOT NULL, building_type TEXT NOT NULL, external_source TEXT, external_id TEXT, source_confidence TEXT, imported_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS addresses (id TEXT PRIMARY KEY, structure_id TEXT REFERENCES structures(id), civic_number TEXT, street TEXT, unit TEXT, label TEXT, lon REAL NOT NULL, lat REAL NOT NULL, external_source TEXT, external_id TEXT, association_status TEXT, imported_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS households (id TEXT PRIMARY KEY, address_id TEXT NOT NULL REFERENCES addresses(id), unit_label TEXT, created_at TEXT NOT NULL, UNIQUE(address_id, unit_label));
CREATE TABLE IF NOT EXISTS people (id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id), name TEXT, phone TEXT, email TEXT, voluntarily_supplied INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS routes (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_by TEXT NOT NULL, created_at TEXT NOT NULL, resumed_at TEXT);
CREATE TABLE IF NOT EXISTS route_stops (id TEXT PRIMARY KEY, route_id TEXT NOT NULL REFERENCES routes(id), household_id TEXT NOT NULL REFERENCES households(id), sequence INTEGER NOT NULL, street_side TEXT, completed_at TEXT, skipped INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS visits (id TEXT PRIMARY KEY, occurred_at TEXT NOT NULL, user_id TEXT NOT NULL, household_id TEXT NOT NULL REFERENCES households(id), route_id TEXT, flyer_delivered INTEGER NOT NULL, door_knocked INTEGER NOT NULL, outcome TEXT NOT NULL, conversation_occurred INTEGER NOT NULL, issue_categories_json TEXT NOT NULL, notes TEXT NOT NULL, follow_up_action TEXT, follow_up_date TEXT, support_category TEXT, source TEXT NOT NULL, imported_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS issue_categories (id TEXT PRIMARY KEY, label TEXT UNIQUE NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS follow_ups (id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id), visit_id TEXT REFERENCES visits(id), action TEXT NOT NULL, due_date TEXT, completed_at TEXT);
CREATE TABLE IF NOT EXISTS imports (id TEXT PRIMARY KEY, source_name TEXT NOT NULL, imported_by TEXT NOT NULL, imported_at TEXT NOT NULL, record_count INTEGER NOT NULL, warnings_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, occurred_at TEXT NOT NULL, user_id TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, detail_json TEXT NOT NULL);`);

const now = () => new Date().toISOString();
const json = (res: ServerResponse, status: number, value: unknown, contentType = "application/json") => { const body = contentType === "application/json" ? JSON.stringify(value) : String(value); res.writeHead(status, { "content-type": `${contentType}; charset=utf-8`, "cache-control": "no-store" }); res.end(body); };
const body = async (req: IncomingMessage) => { const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk)); return Buffer.concat(chunks).toString("utf8"); };
const audit = (user: string, action: string, type: string, id: string | null, detail: unknown) => db.prepare("INSERT INTO audit_events VALUES (?, ?, ?, ?, ?, ?, ?)").run(randomUUID(), now(), user, action, type, id, JSON.stringify(detail));
const recordEvent = async (event: unknown) => { await mkdir(dirname(journalPath), { recursive: true }); await appendFile(journalPath, JSON.stringify(event) + "\n", { mode: 0o600 }); };

async function seed() {
  if ((db.prepare("SELECT count(*) n FROM structures").get() as any).n) return;
  const base = join(root, "packages/web-client/public/canvassing");
  const structures = JSON.parse(await readFile(join(base, "structures.geojson"), "utf8"));
  const addresses = JSON.parse(await readFile(join(base, "addresses.geojson"), "utf8"));
  const timestamp = now();
  db.exec("BEGIN");
  try {
    const insertStructure = db.prepare("INSERT INTO structures VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const feature of structures.features) insertStructure.run(feature.properties.structure_id, JSON.stringify(feature.geometry), feature.properties.building_type, feature.properties.external_source, feature.properties.external_id, feature.properties.confidence, timestamp);
    const insertAddress = db.prepare("INSERT INTO addresses VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const insertHousehold = db.prepare("INSERT INTO households VALUES (?, ?, ?, ?)");
    for (const feature of addresses.features) {
      const p = feature.properties, [lon, lat] = feature.geometry.coordinates;
      insertAddress.run(p.address_id, p.structure_id, p.civic_number, p.street, p.unit, p.label, lon, lat, p.external_source, p.external_id, p.association_status, timestamp);
      insertHousehold.run(`household_${p.address_id.slice(8)}`, p.address_id, p.unit || "", timestamp);
    }
    db.exec("COMMIT");
    audit("system", "seed", "import", null, { structures: structures.features.length, addresses: addresses.features.length });
  } catch (error) { try { db.exec("ROLLBACK"); } catch {} throw error; }
}
await seed();

function state() {
  const households = db.prepare(`SELECT h.id household_id,h.unit_label,a.id address_id,a.structure_id,a.civic_number,a.street,a.unit,a.label,a.lon,a.lat,a.association_status,
    COALESCE((SELECT v.outcome FROM visits v WHERE v.household_id=h.id ORDER BY v.occurred_at DESC,v.rowid DESC LIMIT 1),'untouched') status,
    COALESCE((SELECT max(v.flyer_delivered) FROM visits v WHERE v.household_id=h.id),0) flyer_delivered,
    COALESCE((SELECT max(v.door_knocked) FROM visits v WHERE v.household_id=h.id),0) door_knocked,
    (SELECT count(*) FROM visits v WHERE v.household_id=h.id) visit_count
    FROM households h JOIN addresses a ON a.id=h.address_id`).all();
  const routes = db.prepare("SELECT r.*,count(s.id) stop_count,sum(CASE WHEN s.completed_at IS NOT NULL THEN 1 ELSE 0 END) completed_count FROM routes r LEFT JOIN route_stops s ON s.route_id=r.id GROUP BY r.id ORDER BY r.created_at DESC").all();
  const route_stops = db.prepare("SELECT s.*,a.label,a.lon,a.lat FROM route_stops s JOIN households h ON h.id=s.household_id JOIN addresses a ON a.id=h.address_id ORDER BY s.route_id,s.sequence").all();
  const summary = db.prepare(`SELECT count(*) total_households,
    sum(EXISTS(SELECT 1 FROM visits v WHERE v.household_id=h.id AND v.flyer_delivered=1)) flyers_delivered,
    sum(EXISTS(SELECT 1 FROM visits v WHERE v.household_id=h.id AND v.door_knocked=1)) doors_knocked,
    sum(EXISTS(SELECT 1 FROM visits v WHERE v.household_id=h.id AND v.outcome IN ('conversation','supportive','undecided','opposed','volunteer_interest','lawn_sign_interest'))) answers,
    sum(EXISTS(SELECT 1 FROM visits v WHERE v.household_id=h.id AND v.conversation_occurred=1)) conversations,
    sum(EXISTS(SELECT 1 FROM visits v WHERE v.household_id=h.id AND v.outcome='revisit')) revisits,
    sum(EXISTS(SELECT 1 FROM visits v WHERE v.household_id=h.id AND v.outcome='supportive')) supporters,
    sum(EXISTS(SELECT 1 FROM visits v WHERE v.household_id=h.id AND v.outcome='volunteer_interest')) volunteers,
    sum(EXISTS(SELECT 1 FROM visits v WHERE v.household_id=h.id AND v.outcome='lawn_sign_interest')) lawn_signs
    FROM households h`).get() as any;
  summary.untouched_households = Number(summary.total_households) - households.filter((h: any) => h.status !== "untouched").length;
  summary.answer_rate = summary.doors_knocked ? +(summary.answers / summary.doors_knocked * 100).toFixed(1) : 0;
  summary.conversation_rate = summary.doors_knocked ? +(summary.conversations / summary.doors_knocked * 100).toFixed(1) : 0;
  const span = db.prepare("SELECT min(occurred_at) first,max(occurred_at) last,count(DISTINCT household_id) completed FROM visits").get() as any;
  const hours = span.first && span.last ? Math.max(1 / 60, (Date.parse(span.last) - Date.parse(span.first)) / 3_600_000) : 0;
  summary.households_completed_per_hour = hours ? +(span.completed / hours).toFixed(1) : 0;
  return { households, routes, route_stops, summary };
}

function parseCsv(text: string) { const rows: string[][] = []; let row: string[] = [], value = "", quoted = false; for (let i = 0; i <= text.length; i++) { const c = text[i] ?? "\n"; if (c === '"' && quoted && text[i + 1] === '"') { value += '"'; i++; } else if (c === '"') quoted = !quoted; else if (c === ',' && !quoted) { row.push(value); value = ""; } else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(value); if (row.some(Boolean)) rows.push(row); row = []; value = ""; } else value += c; } const headers = rows.shift() ?? []; return rows.map((values) => Object.fromEntries(headers.map((header, i) => [header.trim(), values[i] ?? ""]))); }
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (token && req.headers.authorization !== `Bearer ${token}`) return json(res, 401, { error: "authentication required" });
    const user = String(req.headers["x-canvass-user"] ?? "local-user");
    const role = String(req.headers["x-canvass-role"] ?? "candidate");
    if (req.method === "GET" && url.pathname === "/api/canvassing/state") return json(res, 200, state());
    if (req.method === "POST" && url.pathname === "/api/canvassing/visits") {
      const input = JSON.parse(await body(req));
      if (role === "volunteer") { input.notes = ""; input.support_category = null; input.issue_categories = []; input.follow_up_action = null; input.follow_up_date = null; }
      const allowed = ["untouched","flyer_delivered","knocked_no_answer","conversation","revisit","supportive","undecided","opposed","volunteer_interest","lawn_sign_interest","inaccessible","vacant","no_campaign_material_requested"];
      if (!allowed.includes(input.outcome)) return json(res, 400, { error: "invalid outcome" });
      const event = { id: randomUUID(), occurred_at: input.occurred_at ?? now(), user_id: user, household_id: input.household_id, route_id: input.route_id ?? null, flyer_delivered: Boolean(input.flyer_delivered), door_knocked: Boolean(input.door_knocked), outcome: input.outcome, conversation_occurred: Boolean(input.conversation_occurred), issue_categories: input.issue_categories ?? [], notes: input.notes ?? "", follow_up_action: input.follow_up_action ?? null, follow_up_date: input.follow_up_date ?? null, support_category: input.support_category ?? null, source: input.source ?? "candidate", imported_at: now() };
      db.prepare("INSERT INTO visits VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(event.id,event.occurred_at,event.user_id,event.household_id,event.route_id,+event.flyer_delivered,+event.door_knocked,event.outcome,+event.conversation_occurred,JSON.stringify(event.issue_categories),event.notes,event.follow_up_action,event.follow_up_date,event.support_category,event.source,event.imported_at);
      if (event.route_id) db.prepare("UPDATE route_stops SET completed_at=? WHERE route_id=? AND household_id=?").run(event.occurred_at,event.route_id,event.household_id);
      if (event.follow_up_action) db.prepare("INSERT INTO follow_ups VALUES (?,?,?,?,?,NULL)").run(randomUUID(),event.household_id,event.id,event.follow_up_action,event.follow_up_date);
      audit(user,"append","visit",event.id,{ household_id:event.household_id, outcome:event.outcome }); await recordEvent({ type:"canvassing.visit.appended", ...event }); return json(res,201,event);
    }
    if (req.method === "POST" && url.pathname === "/api/canvassing/routes") {
      const input = JSON.parse(await body(req)); const id = randomUUID(), created = now();
      db.exec("BEGIN"); try { db.prepare("INSERT INTO routes VALUES (?,?,?,?,?,NULL)").run(id,input.name || `Route ${created.slice(0,10)}`,"active",user,created); const insert=db.prepare("INSERT INTO route_stops VALUES (?,?,?,?,?,NULL,0)"); (input.household_ids ?? []).forEach((householdId:string,index:number)=>insert.run(randomUUID(),id,householdId,index+1,input.street_side??null)); db.exec("COMMIT"); } catch(error){db.exec("ROLLBACK");throw error;}
      audit(user,"create","route",id,{ stop_count:input.household_ids?.length??0 }); return json(res,201,{id});
    }
    if (req.method === "PATCH" && url.pathname.startsWith("/api/canvassing/routes/")) { const id=url.pathname.split('/').at(-1)!; const input=JSON.parse(await body(req)); db.prepare("UPDATE routes SET status=?,resumed_at=? WHERE id=?").run(input.status,input.status==='active'?now():null,id); audit(user,"update","route",id,input); return json(res,200,{id,status:input.status}); }
    if (req.method === "POST" && url.pathname === "/api/canvassing/import.csv") { const records=parseCsv(await body(req)); let imported=0; for(const row of records){ const address=String(row.address??"").toLowerCase(); const match=db.prepare("SELECT h.id FROM households h JOIN addresses a ON a.id=h.address_id WHERE lower(a.label)=? LIMIT 1").get(address) as any; if(!match)continue; const event={household_id:match.id,outcome:row.outcome||"conversation",notes:row.notes||"",support_category:row.support_level||null,occurred_at:row.date_met||now()}; const request={...event,flyer_delivered:false,door_knocked:true,conversation_occurred:true,issue_categories:String(row.issues||"").split(';').filter(Boolean),follow_up_action:row.follow_up||null,source:"import"}; const id=randomUUID(); db.prepare("INSERT INTO visits VALUES (?,?,?,?,NULL,?,?,?,?,?,?,?,?,?,?,?)").run(id,request.occurred_at,user,request.household_id,0,1,request.outcome,1,JSON.stringify(request.issue_categories),request.notes,request.follow_up_action,null,request.support_category,"import",now()); await recordEvent({type:"canvassing.visit.imported",id,...request}); imported++; } const importId=randomUUID(); db.prepare("INSERT INTO imports VALUES (?,?,?,?,?,?)").run(importId,"csv_upload",user,now(),imported,"[]"); audit(user,"import","csv",importId,{imported}); return json(res,200,{imported,total_records:records.length}); }
    if (req.method === "GET" && url.pathname === "/api/canvassing/export/routes.csv") { const rows=db.prepare("SELECT r.name route,s.sequence,a.label,h.id household_id,s.completed_at,s.skipped FROM route_stops s JOIN routes r ON r.id=s.route_id JOIN households h ON h.id=s.household_id JOIN addresses a ON a.id=h.address_id ORDER BY r.name,s.sequence").all() as any[]; const headers=["route","sequence","address","household_id","completed_at","skipped"]; audit(user,"export","route_csv",null,{rows:rows.length}); return json(res,200,[headers.join(','),...rows.map(row=>headers.map(h=>csvCell(row[h])).join(','))].join('\n'),"text/csv"); }
    if (req.method === "GET" && url.pathname === "/api/canvassing/export/redacted.geojson") { const rows=state().households as any[]; const features=rows.map(row=>({type:"Feature",properties:{household_id:row.household_id,status:row.status,flyer_delivered:Boolean(row.flyer_delivered),door_knocked:Boolean(row.door_knocked)},geometry:{type:"Point",coordinates:[row.lon,row.lat]}})); audit(user,"export","redacted_geojson",null,{features:features.length}); return json(res,200,{type:"FeatureCollection",metadata:{redacted:true,excluded:["people","contact_information","notes","political_impressions"]},features}); }
    if (req.method === "POST" && url.pathname === "/api/canvassing/backup") { const path=resolve(`private/canvassing/backups/owen-sound-${Date.now()}.sqlite`); await mkdir(dirname(path),{recursive:true}); await backup(db,path); audit(user,"backup","database",null,{path}); return json(res,201,{path}); }
    return json(res,404,{error:"not found"});
  } catch(error) { console.error(error); return json(res,500,{error:error instanceof Error?error.message:"server error"}); }
});
server.listen(port,host,()=>console.log(`Private canvassing API listening on http://${host}:${port}`));
