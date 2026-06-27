#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

function parseArgs(argv) {
  const args = {
    osmPbf: 'data/osm/owen-sound.osm.pbf',
    rankedCsv: 'artifacts/corner-lot-flyering-ranked-deduped.csv',
    rankedGeojson: 'artifacts/corner-lot-flyering-ranked-deduped.geojson',
    radiusM: 75,
    outCsv: 'artifacts/corner-lot-flyering-ranked-residential-first.csv',
    outGeojson: 'artifacts/corner-lot-flyering-ranked-residential-first.geojson',
    outPya: 'artifacts/corner-lot-flyering-ranked-residential-first.pya'
  };
  for (let i = 2; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--osm-pbf') args.osmPbf = argv[++i] ?? args.osmPbf;
    else if (t === '--ranked-csv') args.rankedCsv = argv[++i] ?? args.rankedCsv;
    else if (t === '--ranked-geojson') args.rankedGeojson = argv[++i] ?? args.rankedGeojson;
    else if (t === '--radius-m') args.radiusM = Number(argv[++i] ?? args.radiusM);
    else if (t === '--out-csv') args.outCsv = argv[++i] ?? args.outCsv;
    else if (t === '--out-geojson') args.outGeojson = argv[++i] ?? args.outGeojson;
    else if (t === '--out-pya') args.outPya = argv[++i] ?? args.outPya;
  }
  return args;
}

function sh(v){return `'${String(v).replace(/'/g,`'\\''`)}'`;}
function run(cmd){return execSync(cmd,{stdio:'pipe'}).toString('utf8');}

function parseCsv(text) {
  const rows=[]; let i=0,f='',r=[],q=false;
  while(i<text.length){const c=text[i];
    if(q){if(c==='"'&&text[i+1]==='"'){f+='"';i+=2;continue;} if(c==='"'){q=false;i++;continue;} f+=c;i++;continue;}
    if(c==='"'){q=true;i++;continue;} if(c===','){r.push(f);f='';i++;continue;} if(c==='\n'){r.push(f);rows.push(r);r=[];f='';i++;continue;} if(c==='\r'){i++;continue;} f+=c;i++;}
  if(f.length||r.length){r.push(f);rows.push(r);} if(!rows.length) return {headers:[],rows:[]};
  const h=rows[0];
  return {headers:h,rows:rows.slice(1).filter(x=>x.some(y=>y!=='')).map(x=>Object.fromEntries(h.map((k,idx)=>[k,x[idx]??''])))};
}
function csvEscape(v){const s=String(v??''); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
function toCsv(headers,rows){return [headers.join(','),...rows.map(r=>headers.map(h=>csvEscape(r[h])).join(','))].join('\n')+'\n';}

function haversineM(lat1, lon1, lat2, lon2){const R=6371000; const toRad=d=>d*Math.PI/180; const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1); const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(a));}

function centroidOfGeometry(g){
  if(!g) return null;
  if(g.type==='Point') return [g.coordinates[0],g.coordinates[1]];
  if(g.type==='MultiPoint'){ if(!g.coordinates.length) return null; const s=g.coordinates.reduce((a,p)=>[a[0]+p[0],a[1]+p[1]],[0,0]); return [s[0]/g.coordinates.length,s[1]/g.coordinates.length];}
  const pts=[];
  const walk=(c)=>{ if(!Array.isArray(c)) return; if(typeof c[0]==='number') pts.push(c); else c.forEach(walk); };
  walk(g.coordinates);
  if(!pts.length) return null;
  const s=pts.reduce((a,p)=>[a[0]+p[0],a[1]+p[1]],[0,0]);
  return [s[0]/pts.length,s[1]/pts.length];
}

function polygonAreaM2(geom){
  // Rough equirectangular projection around centroid
  const c=centroidOfGeometry(geom); if(!c) return 0;
  const lon0=c[0]*Math.PI/180; const lat0=c[1]*Math.PI/180;
  const R=6378137;
  function proj(pt){const lon=pt[0]*Math.PI/180, lat=pt[1]*Math.PI/180; return [R*(lon-lon0)*Math.cos(lat0), R*(lat-lat0)];}
  function ringArea(ring){if(!ring||ring.length<3) return 0; let a=0; for(let i=0,j=ring.length-1;i<ring.length;j=i++) {const [xi,yi]=proj(ring[i]); const [xj,yj]=proj(ring[j]); a+=(xj*yi-xi*yj);} return Math.abs(a)/2;}
  if(geom.type==='Polygon'){const outer=ringArea(geom.coordinates[0]||[]); const holes=(geom.coordinates.slice(1)||[]).reduce((s,r)=>s+ringArea(r),0); return Math.max(0,outer-holes);}
  if(geom.type==='MultiPolygon'){return (geom.coordinates||[]).reduce((s,p)=>s+polygonAreaM2({type:'Polygon',coordinates:p}),0);}
  return 0;
}

function isParkingFeature(props){
  const amenity=String(props.amenity||'').toLowerCase();
  const parking=String(props.parking||'').toLowerCase();
  return amenity==='parking' || parking==='surface';
}

function isCommercialFeature(props){
  const landuse=String(props.landuse||'').toLowerCase();
  const building=String(props.building||'').toLowerCase();
  const amenity=String(props.amenity||'').toLowerCase();
  const office=String(props.office||'').toLowerCase();
  return (
    ['retail','commercial','industrial'].includes(landuse) ||
    ['retail','commercial'].includes(building) ||
    props.shop != null ||
    ['fuel','fast_food','restaurant','bank'].includes(amenity) ||
    office.length>0
  );
}

function extractAllTaggedGeojson(osmPbf){
  run('osmium --version');
  const tmpDir=fs.mkdtempSync(path.join(os.tmpdir(),'lr-osm-context-'));
  const outGeo=path.join(tmpDir,'osm-all.geojson');
  run(`osmium export ${sh(path.resolve(osmPbf))} -o ${sh(outGeo)} --overwrite`);
  return {geo:JSON.parse(fs.readFileSync(outGeo,'utf8')), tmpDir};
}

const args=parseArgs(process.argv);
const rankedCsvPath=path.resolve(args.rankedCsv);
const rankedGeoPath=path.resolve(args.rankedGeojson);
if(!fs.existsSync(rankedCsvPath)) { console.error(`Missing ranked CSV: ${rankedCsvPath}`); process.exit(1); }
if(!fs.existsSync(rankedGeoPath)) { console.error(`Missing ranked GeoJSON: ${rankedGeoPath}`); process.exit(1); }
if(!fs.existsSync(path.resolve(args.osmPbf))) { console.error(`Missing OSM PBF: ${path.resolve(args.osmPbf)}`); process.exit(1); }

const rankedCsv=parseCsv(fs.readFileSync(rankedCsvPath,'utf8'));
const rankedGeo=JSON.parse(fs.readFileSync(rankedGeoPath,'utf8'));
const byRankGeo=new Map((rankedGeo.features||[]).map(f=>[String(f.properties?.global_rank||''),f]));

const {geo:osmGeo,tmpDir}=extractAllTaggedGeojson(args.osmPbf);

const contextFeatures=[];
for(const f of (osmGeo.features||[])){
  const p=f.properties||{};
  if(!(isParkingFeature(p)||isCommercialFeature(p))) continue;
  const c=centroidOfGeometry(f.geometry); if(!c) continue;
  const areaM2=polygonAreaM2(f.geometry);
  contextFeatures.push({
    lon:c[0], lat:c[1],
    areaM2,
    parking:isParkingFeature(p),
    commercial:isCommercialFeature(p),
    largeParking:isParkingFeature(p) && areaM2>=2500,
    props:p
  });
}

const rows=rankedCsv.rows.map(r=>({ ...r }));
const downgraded=[];
for(const r of rows){
  const rank=String(r.global_rank||'');
  const gf=byRankGeo.get(rank);
  const lat=Number(r.representative_lat||r.lat||gf?.geometry?.coordinates?.[1]);
  const lon=Number(r.representative_lon||r.lon||gf?.geometry?.coordinates?.[0]);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)) continue;

  let parkingCount=0, largeParkingCount=0, parkingArea=0, commCount=0;
  for(const cf of contextFeatures){
    const d=haversineM(lat,lon,cf.lat,cf.lon);
    if(d>args.radiusM) continue;
    if(cf.parking){parkingCount+=1; parkingArea+=cf.areaM2; if(cf.largeParking) largeParkingCount+=1;}
    if(cf.commercial) commCount+=1;
  }

  let cps=0;
  cps += Math.min(30, largeParkingCount*20);
  cps += Math.min(20, parkingCount*4);
  cps += Math.min(25, commCount*3);
  cps += Math.min(25, Math.floor(parkingArea/800));
  cps = Math.max(0, Math.min(100, cps));

  let rls=100-cps;
  if(rls<0) rls=0;

  let flag='low', strategy='keep_residential_first_pass', reason='';
  if(cps>=70){flag='high'; strategy='skip_for_residential_first_pass'; reason='large parking/commercial OSM context';}
  else if(cps>=40){flag='medium'; strategy='flyer_only_if_nearby'; reason='possible commercial/mixed-use context';}

  r.nearby_parking_lot_count=parkingCount;
  r.nearby_large_parking_lot_count=largeParkingCount;
  r.nearby_parking_area_m2=Math.round(parkingArea);
  r.nearby_retail_commercial_feature_count=commCount;
  r.commercial_proxy_score=cps;
  r.residential_likelihood_score=Math.round(rls);
  r.commercial_context_flag=flag;
  r.field_strategy_adjusted=strategy;
  r.downgrade_reason=reason;

  // Adjust residential-first priority score for resorting
  const base=Number(r.daily_priority_score||0);
  let adjusted=base;
  if(flag==='high') adjusted -= 45;
  else if(flag==='medium') adjusted -= 20;
  r.daily_priority_score_adjusted=Math.max(0, Math.round(adjusted));

  if(flag!=='low') downgraded.push(r);
}

const tierOrder={S:1,A:2,B:3,C:4};
rows.sort((a,b)=>{
  const da=Number(a.daily_priority_score_adjusted||a.daily_priority_score||0);
  const db=Number(b.daily_priority_score_adjusted||b.daily_priority_score||0);
  if(da!==db) return db-da;
  const ta=tierOrder[String(a.daily_tier||'').toUpperCase()]||99;
  const tb=tierOrder[String(b.daily_tier||'').toUpperCase()]||99;
  if(ta!==tb) return ta-tb;
  return Number(a.global_rank||999999)-Number(b.global_rank||999999);
});

for(let i=0;i<rows.length;i+=1){
  const rank=i+1;
  rows[i].global_rank=rank;
  rows[i].daily_tier = rank<=20?'S':rank<=70?'A':rank<=170?'B':'C';
  rows[i].canvass_order = rows[i].daily_tier==='S'?1:rows[i].daily_tier==='A'?2:rows[i].daily_tier==='B'?3:4;
  rows[i].suggested_day=`Day ${Math.ceil(rank/15)}`;
}

// Map back into geojson
const byOldKey=new Map(rows.map(r=>[String(r.node_id||r.canonical_intersection_key||r.display_intersection_name),r]));
const outFeatures=(rankedGeo.features||[]).map(f=>{
  const p={...(f.properties||{})};
  const key=String(p.node_id||p.canonical_intersection_key||p.display_intersection_name||'');
  const row=byOldKey.get(key);
  if(row){ for(const [k,v] of Object.entries(row)) p[k]=v; }
  return { ...f, properties:p };
});

const headers=[...rankedCsv.headers];
for(const h of ['nearby_parking_lot_count','nearby_large_parking_lot_count','nearby_parking_area_m2','nearby_retail_commercial_feature_count','commercial_proxy_score','residential_likelihood_score','commercial_context_flag','field_strategy_adjusted','downgrade_reason','daily_priority_score_adjusted']) if(!headers.includes(h)) headers.push(h);

const outCsvText=toCsv(headers,rows);
const outGeoObj={type:'FeatureCollection',features:outFeatures};
const topDowngraded=downgraded.slice().sort((a,b)=>Number(b.commercial_proxy_score)-Number(a.commercial_proxy_score)).slice(0,25).map(r=>({rank:r.global_rank,intersection:r.display_intersection_name||r.canonical_intersection_name,commercial_proxy_score:r.commercial_proxy_score,flag:r.commercial_context_flag,downgrade_reason:r.downgrade_reason}));
const top20=rows.slice(0,20).map(r=>({rank:r.global_rank,tier:r.daily_tier,intersection:r.display_intersection_name||r.canonical_intersection_name,adjusted_score:r.daily_priority_score_adjusted,commercial_flag:r.commercial_context_flag}));

const summary={
  generated_at:new Date().toISOString(),
  source_osm_pbf:path.resolve(args.osmPbf),
  source_ranked_csv:rankedCsvPath,
  source_ranked_geojson:rankedGeoPath,
  radius_m:args.radiusM,
  context_feature_count:contextFeatures.length,
  intersections_total:rows.length,
  intersections_downgraded_due_to_parking_commercial_proxy:downgraded.length,
  top_25_downgraded_intersections:topDowngraded,
  new_top_20_residential_first_intersections:top20,
  output_csv:path.resolve(args.outCsv),
  output_geojson:path.resolve(args.outGeojson),
  extraction_tmp_dir:tmpDir,
  caveat:'OSM parking/commercial context is a field-priority proxy only; not proof of parcel ownership or legal zoning.'
};

fs.mkdirSync(path.dirname(path.resolve(args.outCsv)),{recursive:true});
fs.writeFileSync(path.resolve(args.outCsv),outCsvText);
fs.writeFileSync(path.resolve(args.outGeojson),JSON.stringify(outGeoObj,null,2)+'\n');
fs.writeFileSync(path.resolve(args.outPya),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
