function safeJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}

export function renderInteractiveMap(data: unknown): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Owen Sound Transit Network MVP</title>
  <style>
    :root { color-scheme: light; font-family: Inter, system-ui, sans-serif; color: #18201d; background: #eef0eb; }
    * { box-sizing: border-box; }
    body { margin: 0; display: grid; grid-template-columns: minmax(270px, 340px) 1fr; min-height: 100vh; }
    aside { padding: 18px; background: #f8f8f4; border-right: 1px solid #c9cec7; overflow: auto; }
    h1 { margin: 0 0 4px; font-size: 21px; letter-spacing: 0; }
    h2 { margin: 22px 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0; color: #59625d; }
    p { font-size: 13px; line-height: 1.45; color: #4e5752; }
    label { display: flex; align-items: center; gap: 8px; margin: 8px 0; font-size: 13px; }
    select { width: 100%; padding: 8px; border: 1px solid #aeb6b0; background: white; border-radius: 4px; }
    dl { display: grid; grid-template-columns: 1fr auto; gap: 7px 12px; margin: 10px 0; font-size: 13px; }
    dt { color: #58615c; } dd { margin: 0; font-variant-numeric: tabular-nums; }
    main { position: relative; min-width: 0; background: #dfe5df; }
    svg { display: block; width: 100%; height: 100vh; touch-action: none; }
    .boundary { fill: #f5f4ed; stroke: #515c56; stroke-width: 1.4; }
    .street { fill: none; stroke: #b8bcb7; stroke-width: .8; vector-effect: non-scaling-stroke; }
    .block { stroke: #ffffff; stroke-width: .35; vector-effect: non-scaling-stroke; }
    .access-gained { fill: #169c62; fill-opacity: .72; stroke: #087444; stroke-width: .7; vector-effect: non-scaling-stroke; }
    .access-lost { fill: #d94b45; fill-opacity: .72; stroke: #a82f2b; stroke-width: .7; vector-effect: non-scaling-stroke; }
    .route { fill: none; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
    .route-existing { stroke: #c62828; }
    .route-clockwise { stroke: #176b87; }
    .route-counter { stroke: #8e4b9b; stroke-dasharray: 9 5; }
    .route-brooke-0 { stroke: #34784b; }
    .route-brooke-1 { stroke: #bd6b21; stroke-dasharray: 10 4; }
    .route-brooke-2 { stroke: #5a56a5; stroke-dasharray: 3 4; }
    .traffic-leg { fill: none; stroke: #b9231f; stroke-linecap: round; vector-effect: non-scaling-stroke; }
    .new-count { fill: #111; stroke: #fff; stroke-width: 1.2; vector-effect: non-scaling-stroke; }
    .bike-stress { fill: none; stroke-width: 2.2; stroke-linecap: round; vector-effect: non-scaling-stroke; }
    .bike-lts-1 { stroke: #238b57; } .bike-lts-2 { stroke: #82ad3d; } .bike-lts-3 { stroke: #e18c25; } .bike-lts-4 { stroke: #b9231f; }
    .bike-route { fill: none; stroke-width: 4; stroke-linecap: round; vector-effect: non-scaling-stroke; }
    .bike-comfortable { stroke: #087f5b; } .bike-connecting { stroke: #d17b0f; stroke-dasharray: 8 4; } .bike-experienced_rider { stroke: #9d2522; stroke-dasharray: 3 4; }
    .bike-transfer { fill: #fff; stroke: #087f5b; stroke-width: 2.5; vector-effect: non-scaling-stroke; }
    .multilane { fill: none; stroke: #4c2a85; stroke-width: 5; stroke-opacity: .7; vector-effect: non-scaling-stroke; }
    .integrated-route { fill: none; stroke: #16697a; stroke-width: 5; stroke-linecap: round; stroke-opacity: .84; vector-effect: non-scaling-stroke; }
    .multimodal-route { fill: none; stroke: #d06b23; stroke-width: 2.5; stroke-dasharray: 7 4; vector-effect: non-scaling-stroke; }
    .arrow-existing { fill: #c62828; } .arrow-clockwise { fill: #176b87; } .arrow-counter { fill: #8e4b9b; }
    .coverage-circle { fill: #52a86c; fill-opacity: .07; stroke: #3f8a58; stroke-width: .5; vector-effect: non-scaling-stroke; }
    .stop { fill: #fff; stroke: #192c25; stroke-width: 1.4; vector-effect: non-scaling-stroke; }
    .stop.major { fill: #ffd447; stroke-width: 2; }
    .destination { fill: #176b87; stroke: white; stroke-width: 1.2; vector-effect: non-scaling-stroke; }
    .tooltip { position: absolute; pointer-events: none; display: none; max-width: 260px; padding: 8px 10px; background: rgba(20,27,24,.94); color: white; border-radius: 4px; font-size: 12px; line-height: 1.4; }
    .legend { display: grid; grid-template-columns: 16px 1fr; gap: 6px 8px; align-items: center; font-size: 12px; }
    .swatch { width: 14px; height: 10px; border: 1px solid #777; }
    .warning { padding: 9px; border-left: 3px solid #b45b2c; background: #fff3e8; color: #713b20; }
    @media (max-width: 760px) { body { grid-template-columns: 1fr; grid-template-rows: auto 65vh; } aside { border-right: 0; border-bottom: 1px solid #c9cec7; } svg { height: 65vh; } }
  </style>
</head>
<body>
  <aside>
    <h1>Owen Sound Transit MVP</h1>
    <p>Hill Line and directional Hill Loop concept comparison.</p>
    <p class="warning">The unrelated Pierce County transit-route layer is excluded.</p>
    <h2>Operating case</h2>
    <select id="scenario"></select>
    <dl id="metrics"></dl>
    <h2>Complete network</h2>
    <select id="integrated-scenario"></select>
    <dl id="integrated-metrics"></dl>
    <h2>Map layers</h2>
    <label><input id="show-streets" type="checkbox" checked> Bus-suitable streets</label>
    <label><input id="show-existing" type="checkbox" checked> Existing Hill Line</label>
    <label><input id="show-clockwise" type="checkbox"> Hill Loop clockwise</label>
    <label><input id="show-counter" type="checkbox"> Hill Loop counter-clockwise</label>
    <label><input id="show-brooke" type="checkbox"> Brooke / West Side alternatives</label>
    <label><input id="show-stops" type="checkbox" checked> Stops</label>
    <label><input id="show-destinations" type="checkbox" checked> Destinations</label>
    <label><input id="show-blocks" type="checkbox" checked> Census blocks</label>
    <label><input id="show-changes" type="checkbox"> Blocks gaining/losing access</label>
    <label><input id="show-circles" type="checkbox"> Circular stop buffers</label>
    <label><input id="show-traffic" type="checkbox"> 2016 measured AADT legs</label>
    <label><input id="show-newtraffic" type="checkbox"> Newer measured-study locations</label>
    <label><input id="show-multilane" type="checkbox"> Officially recorded multilane corridors</label>
    <label><input id="show-bikestress" type="checkbox"> Measured and inferred bicycle stress</label>
    <label><input id="show-bikeroutes" type="checkbox"> Recommended bicycle routes</label>
    <label><input id="show-bikeaccess" type="checkbox"> Bicycle access to Hill Loop</label>
    <label><input type="checkbox" disabled> Climbing difficulty (data unavailable)</label>
    <label><input id="show-biketransfers" type="checkbox"> Bicycle parking / transfer candidates</label>
    <label><input id="show-integrated" type="checkbox"> Selected complete network</label>
    <label><input id="show-multimodal" type="checkbox"> Representative bicycle-plus-bus journeys</label>
    <label>Coverage threshold <select id="threshold"><option value="300">300 m</option><option value="400" selected>400 m</option><option value="600">600 m</option></select></label>
    <h2>Coverage legend</h2>
    <div class="legend"><span class="swatch" style="background:#81b29a"></span><span>Within selected network walk</span><span class="swatch" style="background:#e6a57e"></span><span>Outside selected network walk</span><span class="swatch" style="background:#d8d8d0"></span><span>Not snapped to walking graph</span></div>
    <h2>Method</h2>
    <p>Drag to pan and use the mouse wheel or trackpad to zoom. Hover or tap a census block, stop, or destination for details. Network coverage uses OSM pedestrian streets and paths; circles are the optimistic comparison.</p>
  </aside>
  <main>
    <svg id="map" viewBox="0 0 1000 900" role="img" aria-label="Interactive Owen Sound Hill Line map"></svg>
    <div id="tooltip" class="tooltip"></div>
  </main>
  <script>
    const DATA = ${safeJson(data)};
    const svg = document.getElementById('map');
    const tip = document.getElementById('tooltip');
    const boundaryCoords = DATA.boundary.features[0].geometry.coordinates[0];
    const all = boundaryCoords;
    const minLon = Math.min(...all.map(p => p[0])), maxLon = Math.max(...all.map(p => p[0]));
    const minLat = Math.min(...all.map(p => p[1])), maxLat = Math.max(...all.map(p => p[1]));
    const pad = 42, width = 1000, height = 900;
    const sx = (width - pad * 2) / (maxLon - minLon), sy = (height - pad * 2) / (maxLat - minLat);
    const scale = Math.min(sx, sy);
    const x = lon => pad + (lon - minLon) * scale;
    const y = lat => height - pad - (lat - minLat) * scale;
    const path = coords => coords.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(2) + ',' + y(p[1]).toFixed(2)).join(' ') + ' Z';
    const line = coords => coords.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(2) + ',' + y(p[1]).toFixed(2)).join(' ');
    const el = (tag, attrs = {}) => { const node = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k,v] of Object.entries(attrs)) node.setAttribute(k, v); return node; };
    const root = el('g'); svg.append(root);
    const groups = Object.fromEntries(['boundary','blocks','bikeaccess','changes','streets','multilane','bikestress','circles','existing','clockwise','counter','brooke','integrated','bikeroutes','multimodal','traffic','newtraffic','stops','destinations','biketransfers'].map(id => { const g=el('g',{id:'layer-'+id}); root.append(g); return [id,g]; }));
    groups.boundary.append(el('path',{d:path(boundaryCoords),class:'boundary'}));
    function polygonRings(geometry) { if (geometry.type === 'Polygon') return [geometry.coordinates[0]]; if (geometry.type === 'MultiPolygon') return geometry.coordinates.map(p => p[0]); return []; }
    function showTip(event, html) { tip.innerHTML=html; tip.style.display='block'; tip.style.left=(event.clientX+12)+'px'; tip.style.top=(event.clientY+12)+'px'; }
    function hideTip() { tip.style.display='none'; }
    function drawBlocks() {
      const threshold = Number(document.getElementById('threshold').value);
      groups.blocks.replaceChildren();
      for (const f of DATA.coverage.features) for (const ring of polygonRings(f.geometry)) {
        const loopScenario = document.getElementById('scenario').value !== 'existing-hill-line-two-bus';
        const d = loopScenario ? f.properties.loop_network_walk_m : f.properties.line_network_walk_m;
        const fill = d == null ? '#d8d8d0' : d <= threshold ? '#81b29a' : '#e6a57e';
        const node=el('path',{d:path(ring),class:'block',fill});
        node.addEventListener('pointermove',e=>showTip(e,'<b>Population block</b><br>Population: '+(f.properties.population||0)+'<br>Dwellings: '+(f.properties.dwellings||0)+'<br>Network walk: '+(d == null ? 'not connected' : d+' m')+'<br>Circular distance: '+f.properties.circular_walk_m+' m'));
        node.addEventListener('pointerleave',hideTip); groups.blocks.append(node);
      }
    }
    function drawCircles() {
      const threshold = Number(document.getElementById('threshold').value);
      groups.circles.replaceChildren();
      const metresPerLon = 111320 * Math.cos((minLat+maxLat)/2*Math.PI/180);
      const radius = threshold / metresPerLon * scale;
      const source = document.getElementById('scenario').value === 'existing-hill-line-two-bus' ? DATA.stops : DATA.loopStops;
      for (const f of source.features) groups.circles.append(el('circle',{cx:x(f.geometry.coordinates[0]),cy:y(f.geometry.coordinates[1]),r:radius,class:'coverage-circle'}));
    }
    function drawChanges(){const selected=Number(document.getElementById('threshold').value),threshold=selected===600?600:400,field='access_change_'+threshold+'m';groups.changes.replaceChildren();for(const f of DATA.accessChanges.features){const status=f.properties[field];if(status!=='gained'&&status!=='lost')continue;for(const ring of polygonRings(f.geometry)){const node=el('path',{d:path(ring),class:'access-'+status});node.addEventListener('pointermove',e=>showTip(e,'<b>'+status+' access</b><br>Population: '+(f.properties.population||0)+'<br>Previous walk: '+(f.properties.previous_network_walk_m??'not connected')+' m<br>Loop walk: '+(f.properties.loop_network_walk_m??'not connected')+' m'));node.addEventListener('pointerleave',hideTip);groups.changes.append(node);}}}
    drawBlocks(); drawCircles(); drawChanges();
    for (const f of DATA.streets.features) groups.streets.append(el('path',{d:line(f.geometry.coordinates),class:'street'}));
    function drawArrow(group, coords, routeClass) { for(let i=12;i<coords.length-1;i+=18){const a=coords[i-1],b=coords[i+1],angle=Math.atan2(y(b[1])-y(a[1]),x(b[0])-x(a[0]))*180/Math.PI;group.append(el('polygon',{points:'-6,-4 7,0 -6,4',transform:'translate('+x(coords[i][0])+','+y(coords[i][1])+') rotate('+angle+')',class:'arrow-'+routeClass}));} }
    for (const f of DATA.routes.features) { const direction=f.properties.direction, group=direction==='existing'?groups.existing:direction==='clockwise'?groups.clockwise:groups.counter, routeClass=direction==='existing'?'existing':direction==='clockwise'?'clockwise':'counter'; const node=el('path',{d:line(f.geometry.coordinates),class:'route route-'+routeClass}); node.addEventListener('pointermove',e=>showTip(e,'<b>'+f.properties.title+'</b><br>Cycle: '+(f.properties.cycle_minutes||f.properties.generalized_travel_minutes)+' min<br>Arrival interval: '+(f.properties.arrival_interval_minutes||f.properties.arrival_interval_one_bus_minutes)+' min'));node.addEventListener('pointerleave',hideTip);group.append(node);drawArrow(group,f.geometry.coordinates,routeClass); }
    DATA.brookeRoutes.features.forEach((f,index)=>{const routeClass='brooke-'+index,node=el('path',{d:line(f.geometry.coordinates),class:'route route-'+routeClass});node.addEventListener('pointermove',e=>showTip(e,'<b>'+f.properties.title+'</b><br>Expected cycle: '+f.properties.expected_cycle_minutes+' min<br>All-stops cycle: '+f.properties.worst_case_cycle_minutes+' min'));node.addEventListener('pointerleave',hideTip);groups.brooke.append(node);drawArrow(groups.brooke,f.geometry.coordinates,'clockwise');});
    for(const f of DATA.measuredTraffic.features){const p=f.properties,node=el('path',{d:line(f.geometry.coordinates),class:'traffic-leg','stroke-width':Math.max(2,Math.min(9,p.aadt_2016/2200))});node.addEventListener('pointermove',e=>showTip(e,'<b>'+p.street_1+' & '+p.street_2+' '+p.approach+' leg</b><br>2016 AADT: '+p.aadt_2016.toLocaleString()+'<br>2006 AADT: '+(p.aadt_2006?.toLocaleString()??'n/a')+'<br>Truck share: '+(p.truck_percent??'n/a')+'% (provisional definition)<br>Confidence: measured local<br>Historical count; no inflation applied.'));node.addEventListener('pointerleave',hideTip);groups.traffic.append(node);}
    for(const f of DATA.newerTrafficStudies.features){const p=f.geometry.coordinates,n=el('circle',{cx:x(p[0]),cy:y(p[1]),r:6,class:'new-count'});n.addEventListener('pointermove',e=>showTip(e,'<b>'+f.properties.name+'</b><br>Observed turning counts: 12 Sep 2024<br>Structured movement transcription pending'));n.addEventListener('pointerleave',hideTip);groups.newtraffic.append(n);}
    for(const f of DATA.multilaneAudit.features)for(const coords of (f.geometry.type==='MultiLineString'?f.geometry.coordinates:[f.geometry.coordinates])){const n=el('path',{d:line(coords),class:'multilane'});n.addEventListener('pointermove',e=>showTip(e,'<b>'+f.properties.ROAD_NAME+'</b><br>'+f.properties.LANE_COUNT+' recorded lanes<br>'+f.properties.lane_audit.replaceAll('_',' ')+'<br>'+f.properties.verification_status.replaceAll('_',' ')));n.addEventListener('pointerleave',hideTip);groups.multilane.append(n);}
    for(const f of DATA.bicycleStress.features){const p=f.properties,node=el('path',{d:line(f.geometry.coordinates),class:'bike-stress bike-lts-'+p.lts});node.addEventListener('pointermove',e=>showTip(e,'<b>'+p.category.replaceAll('_',' ')+'</b><br>LTS proxy: '+p.lts+'<br>Evidence: '+p.confidence.replaceAll('_',' ')+'<br>AADT: '+(p.measured_aadt??'not measured')+'<br>'+p.reasons.join('; ')+'<br>Climbing: unavailable'));node.addEventListener('pointerleave',hideTip);groups.bikestress.append(node);}
    for(const f of DATA.bicycleRoutes.features){const p=f.properties,node=el('path',{d:line(f.geometry.coordinates),class:'bike-route bike-'+p.category});node.addEventListener('pointermove',e=>showTip(e,'<b>'+p.from+' to '+p.to+'</b><br>'+p.preference.replaceAll('_',' ')+'<br>'+p.distance_m+' m; '+p.estimated_minutes+' min<br>Maximum LTS '+p.maximum_lts+'<br>Climbing not yet quantified'));node.addEventListener('pointerleave',hideTip);groups.bikeroutes.append(node);}
    function drawBikeAccess(){groups.bikeaccess.replaceChildren();for(const f of DATA.bicycleAccess.features){const d=f.properties.bicycle_distance_to_hill_loop_m;if(d==null||d>3000)continue;const fill=d<=1000?'#64b98a':d<=2000?'#b2cf73':'#e8c675';for(const ring of polygonRings(f.geometry))groups.bikeaccess.append(el('path',{d:path(ring),fill,'fill-opacity':.68,class:'block'}));}}
    drawBikeAccess();
    for(const f of DATA.bicycleTransfers.features){const p=f.geometry.coordinates,n=el('circle',{cx:x(p[0]),cy:y(p[1]),r:7,class:'bike-transfer'});n.addEventListener('pointermove',e=>showTip(e,'<b>'+f.properties.name+'</b><br>Secure parking candidate<br>'+(f.properties.repair_station_candidate?'Repair-station candidate<br>':'')+'Current rack: 2 bicycles (user-supplied, unverified)<br>Future: 3 where compatible'));n.addEventListener('pointerleave',hideTip);groups.biketransfers.append(n);}
    const integratedScenario=document.getElementById('integrated-scenario');for(const row of DATA.integratedComparisons)integratedScenario.append(new Option(row.title,row.scenario_id));
    function drawIntegrated(){groups.integrated.replaceChildren();for(const f of DATA.integratedScenarios.features.filter(f=>f.properties.scenario_id===integratedScenario.value)){const n=el('path',{d:line(f.geometry.coordinates),class:'integrated-route'});n.addEventListener('pointermove',e=>showTip(e,'<b>'+f.properties.title+'</b><br>'+f.properties.buses+' bus<br>Expected cycle: '+f.properties.expected_cycle_minutes+' min<br>Adverse cycle: '+f.properties.adverse_cycle_minutes+' min'));n.addEventListener('pointerleave',hideTip);groups.integrated.append(n);}const row=DATA.integratedComparisons.find(r=>r.scenario_id===integratedScenario.value);document.getElementById('integrated-metrics').innerHTML='<dt>400 m walk: people</dt><dd>'+row.people_400m_walk.toLocaleString()+' ('+row.percentage_of_city_population_400m_walk+'%)</dd><dt>400 m walk: dwellings</dt><dd>'+row.dwellings_400m_walk.toLocaleString()+' ('+row.percentage_of_city_dwellings_400m_walk+'%)</dd><dt>2 km comfortable cycle: people</dt><dd>'+row.people_2km_comfortable_cycle.toLocaleString()+' ('+row.percentage_of_city_population_2km_comfortable_cycle+'%)</dd><dt>2 km comfortable cycle: dwellings</dt><dd>'+row.dwellings_2km_comfortable_cycle.toLocaleString()+' ('+row.percentage_of_city_dwellings_2km_comfortable_cycle+'%)</dd><dt>Daily vehicle-km</dt><dd>'+row.daily_vehicle_km+'</dd><dt>Annual range</dt><dd>$'+row.annual_operating_cost_low.toLocaleString()+'–$'+row.annual_operating_cost_high.toLocaleString()+'</dd>';}
    integratedScenario.addEventListener('change',drawIntegrated);drawIntegrated();
    for(const f of DATA.multimodalRoutes.features){const n=el('path',{d:line(f.geometry.coordinates),class:'multimodal-route'});n.addEventListener('pointermove',e=>showTip(e,'<b>'+f.properties.origin+' to '+f.properties.destination+'</b><br>Bicycle plus Hill Loop<br>Elevation gain unavailable'));n.addEventListener('pointerleave',hideTip);groups.multimodal.append(n);}
    function drawStops(){groups.stops.replaceChildren();const source=scenario.value==='existing-hill-line-two-bus'?DATA.stops:DATA.loopStops;for(const f of source.features){const p=f.geometry.coordinates,n=el('circle',{cx:x(p[0]),cy:y(p[1]),r:f.properties.major?5:3.3,class:'stop'+(f.properties.major?' major':'')});n.addEventListener('pointermove',e=>showTip(e,'<b>'+f.properties.name+'</b><br>'+(f.properties.fixed?'Fixed major stop':'Intermediate stop')));n.addEventListener('pointerleave',hideTip);groups.stops.append(n);}}
    for (const f of DATA.destinations.features) { const p=f.geometry.coordinates,n=el('rect',{x:x(p[0])-3.5,y:y(p[1])-3.5,width:7,height:7,class:'destination'}); n.addEventListener('pointermove',e=>showTip(e,'<b>'+f.properties.name+'</b><br>'+f.properties.category+'<br>Source: '+f.properties.source)); n.addEventListener('pointerleave',hideTip); groups.destinations.append(n); }
    const scenario = document.getElementById('scenario');
    for (const row of DATA.comparisons) scenario.append(new Option(row.scenario_id.replaceAll('-',' '),row.scenario_id));
    function syncRoutes(){const id=scenario.value;document.getElementById('show-existing').checked=id==='existing-hill-line-two-bus';document.getElementById('show-clockwise').checked=id!=='existing-hill-line-two-bus';document.getElementById('show-counter').checked=id==='hill-loop-counter-rotating';for(const id of ['existing','clockwise','counter'])groups[id].style.display=document.getElementById('show-'+id).checked?'':'none';drawStops();drawBlocks();drawCircles();}
    function metrics() { const row=DATA.comparisons.find(r=>r.scenario_id===scenario.value)||DATA.comparisons[0];const directions=Object.entries(row.direction_specific_headway_minutes).map(([k,v])=>k.replaceAll('_',' ')+': '+v+' min').join('<br>');const counter=row.scenario_id==='hill-loop-counter-rotating';const used=counter?'CW '+row.estimated_used_stops.clockwise.expected+' / CCW '+row.estimated_used_stops.counter_clockwise.expected:row.estimated_used_stops.expected+' of '+row.stop_count;const range=counter?'CW '+row.cycle_time_range_minutes.clockwise.low+'–'+row.cycle_time_range_minutes.clockwise.all_stops+' / CCW '+row.cycle_time_range_minutes.counter_clockwise.low+'–'+row.cycle_time_range_minutes.counter_clockwise.all_stops:row.cycle_time_range_minutes.low+'–'+row.cycle_time_range_minutes.all_stops;document.getElementById('metrics').innerHTML='<dt>Active buses</dt><dd>'+row.active_buses+'</dd><dt>Scheduled stops</dt><dd>'+row.stop_count+'</dd><dt>Expected used</dt><dd>'+used+'</dd><dt>Expected cycle</dt><dd>'+row.complete_cycle_time_minutes+' min</dd><dt>Cycle range</dt><dd>'+range+' min</dd><dt>Any-bus interval</dt><dd>'+row.headway_any_bus_minutes+' min</dd><dt>Directional interval</dt><dd>'+directions+'</dd><dt>Average wait</dt><dd>'+row.average_wait_minutes+' min</dd><dt>Average journey</dt><dd>'+row.average_generalized_passenger_journey_minutes+' min</dd><dt>Route length</dt><dd>'+row.route_length_km+' km</dd><dt>400 m population</dt><dd>'+row.population_400m_network.toLocaleString()+'</dd><dt>Turns</dt><dd>'+row.turns.total+'</dd><dt>Signals</dt><dd>'+row.signalized_intersection_crossings.total+'</dd><dt>Validation</dt><dd>'+row.street_validation_status.replaceAll('_',' ')+'</dd>'; }
    scenario.addEventListener('change',()=>{metrics();syncRoutes()}); metrics();syncRoutes();
    document.getElementById('threshold').addEventListener('change',()=>{drawBlocks();drawCircles();drawChanges()});
    for (const id of ['streets','existing','clockwise','counter','brooke','stops','destinations','blocks','changes','circles','traffic','newtraffic','multilane','bikestress','bikeroutes','bikeaccess','biketransfers','integrated','multimodal']) document.getElementById('show-'+id).addEventListener('change',e=>groups[id].style.display=e.target.checked?'':'none');
    groups.circles.style.display='none';
    groups.changes.style.display='none';
    groups.brooke.style.display='none';
    for(const id of ['traffic','newtraffic','multilane','bikestress','bikeroutes','bikeaccess','biketransfers','integrated','multimodal'])groups[id].style.display='none';
    let view={x:0,y:0,w:1000,h:900},drag;
    function apply(){svg.setAttribute('viewBox',view.x+' '+view.y+' '+view.w+' '+view.h)}
    svg.addEventListener('wheel',e=>{e.preventDefault();const f=e.deltaY>0?1.15:.87,cx=view.x+e.offsetX/svg.clientWidth*view.w,cy=view.y+e.offsetY/svg.clientHeight*view.h;view={x:cx-(cx-view.x)*f,y:cy-(cy-view.y)*f,w:view.w*f,h:view.h*f};apply()},{passive:false});
    svg.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,vx:view.x,vy:view.y};svg.setPointerCapture(e.pointerId)});
    svg.addEventListener('pointermove',e=>{if(!drag)return;view.x=drag.vx-(e.clientX-drag.x)/svg.clientWidth*view.w;view.y=drag.vy-(e.clientY-drag.y)/svg.clientHeight*view.h;apply()});
    svg.addEventListener('pointerup',()=>drag=null); svg.addEventListener('pointercancel',()=>drag=null);
  </script>
</body>
</html>`;
}
