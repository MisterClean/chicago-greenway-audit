import { Map as LibreMap, NavigationControl, ScaleControl, Popup, addProtocol, setWorkerCount, setWorkerUrl, type GeoJSONSource, type MapMouseEvent } from 'maplibre-gl';
import { PMTiles, Protocol, SharedPromiseCache } from 'pmtiles';
import type { Feature, FeatureCollection, Geometry as GeoGeometry } from 'geojson';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { StaticTileSource, type ChunkIndex } from './static-tile-source';
import { boundaryTitle, coordinateAtFraction, distanceLabel, evidenceAppliesToRoute, longestRun, remainingDistance, type Coordinate, type Direction, type DirectionView, type EvidenceRecord, type Event as RouteEvent, type Geometry, type Route, type RouteData, type Run } from './route-model';
import './route-map.css';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const empty = (): FeatureCollection => ({type:'FeatureCollection', features:[]});
const feature = (geometry: GeoGeometry, properties: Record<string, unknown> = {}): Feature => ({type:'Feature', geometry, properties});
const collection = (features: Feature[]): FeatureCollection => ({type:'FeatureCollection', features});
const lines = (geometry: Geometry) => geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
function displayGeometry(geometry: Geometry): Geometry {
  const joined: Coordinate[][] = [];
  for (const part of lines(geometry)) {
    const previous = joined.at(-1);
    const last = previous?.at(-1);
    if (last && last[0] === part[0]?.[0] && last[1] === part[0]?.[1]) previous!.push(...part.slice(1));
    else joined.push([...part]);
  }
  return joined.length === 1 ? {type:'LineString',coordinates:joined[0]} : {type:'MultiLineString',coordinates:joined};
}
const pointAt = (run: Run, end: boolean): Coordinate => end ? lines(run.geometry).at(-1)!.at(-1)! : lines(run.geometry)[0][0];
const directions: Direction[] = ['forward','reverse'];
const colors = {forward:'#187456', reverse:'#2864a0', blocked:'#a84135', unknown:'#867247'};
const query = new URLSearchParams(location.search);
let data: RouteData, route: Route, map: LibreMap | undefined, ready = false;
let direction: DirectionView = ['forward','reverse','both'].includes(query.get('direction') ?? '') ? query.get('direction') as DirectionView : 'both';
let selectedRun: Run | undefined, selectedPoint: Coordinate | undefined, selectedEvent: RouteEvent | undefined;
let evidence: EvidenceRecord[] = [];
let popup: Popup | undefined;

$('app').innerHTML = `
<header class="site-header"><a class="brand" href="/" aria-label="Chicago Greenway Audit home"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 27V7h20M16 27V17h10"/></svg><span>Chicago Greenway Audit</span></a><div class="header-actions"><span class="pilot-label">Route pilot</span><button id="share">Copy link</button></div></header>
<main class="workspace">
  <aside class="sidebar" aria-label="Greenway route explorer">
    <div class="intro"><h1>How far can a car follow the greenway?</h1><p>Explore each direction. See what interrupts the path.</p></div>
    <div class="route-controls"><label for="route-picker">Greenway route</label><select id="route-picker" disabled><option>Loading routes…</option></select><div class="direction-control" role="group" aria-label="Travel direction"><button id="both" data-direction="both" aria-pressed="true">Both</button><button id="forward" data-direction="forward" aria-pressed="false">Forward</button><button id="reverse" data-direction="reverse" aria-pressed="false">Reverse</button></div></div>
    <section class="route-summary" aria-label="Directional driving paths"><h2>Longest mapped stretches</h2><div id="direction-summary"></div><p class="small" id="coverage"></p></section>
    <div class="evidence-note"><strong>Source-inferred · awaiting field review</strong><p>These paths use mapped road rules. Unknown links stay unresolved. A short path does not establish low traffic stress.</p></div>
    <section class="path-detail" id="path-detail" aria-live="polite"><h2>Select a path</h2><p>Choose a stretch below, or select a colored line on the map.</p></section>
    <section class="path-list-section"><h2>Continuous stretches <span id="run-count"></span></h2><div id="run-list" class="run-list"></div></section>
    <details class="review-section" id="review-section"><summary>Interruptions & review points <span id="event-count"></span></summary><div id="event-list"></div></details>
    <details class="method"><summary>Sources & method</summary><p>A car follows the mapped greenway through permitted turns. Signals and speed humps do not break access. A detour away from the greenway does.</p><p>Distances end at a restriction, an unknown link, or the end of the mapped designation. A designation end is not a physical car barrier.</p><p id="dates"></p><p><a href="/routes/pilot.json" target="_blank">Download route data</a> · <a href="/routes/review-evidence.json" target="_blank">Review evidence</a></p><div id="evidence-records"></div><p>Roads © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>. Designations: <a href="https://data.cityofchicago.org/Transportation/Bike-Routes/hvv9-38ut" target="_blank" rel="noreferrer">City of Chicago</a>.</p></details>
  </aside>
  <section class="map-wrap" aria-label="Directional greenway map">
    <div id="map"></div>
    <div class="map-heading"><strong id="map-title">Loading routes…</strong><span id="map-subtitle"></span></div>
    <div class="map-actions"><button id="fit-route" disabled>Fit route</button><button id="fit-pilots" disabled>All pilots</button></div>
    <div class="map-legend" aria-label="Map legend"><span><i class="line-sample forward"></i><b id="forward-legend">Forward</b></span><span><i class="line-sample reverse"></i><b id="reverse-legend">Reverse</b></span><span><i class="line-sample blocked"></i>Car access restricted</span><span><i class="line-sample unknown"></i>Unknown</span><span><i class="end-sample"></i>Selected path endpoint</span></div>
    <p id="map-notice" class="map-notice" hidden role="status"></p>
  </section>
</main><span id="announcement" class="sr-only" aria-live="polite"></span>`;

function notify(message: string) { $('map-notice').hidden = false; $('map-notice').textContent = message; }
function shown(directionOfItem: Direction) { return direction === 'both' || direction === directionOfItem; }
function writeUrl() {
  if (!route) return;
  const url = new URL(location.href);
  url.search = '';
  url.searchParams.set('route', route.id);
  url.searchParams.set('direction', direction);
  if (selectedRun) url.searchParams.set('run', selectedRun.id);
  if (selectedRun && selectedPoint) {
    const measurement = remainingDistance(selectedRun, selectedPoint);
    if (measurement) url.searchParams.set('position', (measurement.offset_m / selectedRun.length_m).toFixed(6));
  }
  if (selectedEvent) url.searchParams.set('event', selectedEvent.id);
  if (map) { const center = map.getCenter(); url.searchParams.set('map', `${map.getZoom().toFixed(3)},${center.lat.toFixed(6)},${center.lng.toFixed(6)}`); }
  history.replaceState(null,'',url);
}
function setSource(name: string, features: Feature[]) { if (ready) (map!.getSource(name) as GeoJSONSource).setData(collection(features)); }
function eventTitle(event: RouteEvent): string {
  if (event.evidence_status === 'conflicting') return 'Sources disagree';
  if (event.status === 'unknown') return 'Needs review';
  if (event.kind === 'physical') return 'Physical filter';
  if (event.kind === 'direction') return event.evidence_urls.some(url => url.includes('/relation/')) ? 'Prohibited route movement' : 'One-way restriction';
  return 'Access restriction';
}
function links(urls: string[]) {
  return [...new Set(urls)].filter(url => /^https:\/\//.test(url)).map(url => {
    const parsed = new URL(url);
    const label = parsed.hostname.endsWith('openstreetmap.org') ? `OSM ${parsed.pathname.split('/').slice(-2).join(' ')}` : parsed.hostname.replace(/^www\./,'');
    return `<a href="${escape(url)}" target="_blank" rel="noreferrer">${escape(label)}</a>`;
  }).join(' · ');
}
function updateMap() {
  if (!ready) return;
  setSource('selected-route', [feature(route.geometry)]);
  for (const d of directions) {
    const visible = shown(d);
    setSource(`edges-${d}`, visible ? route.edges.map(edge => {
      const geometry = edge.traversals?.[d]?.geometry ?? (d === 'forward' ? edge.geometry : {type:'MultiLineString' as const,coordinates:lines(edge.geometry).map(part => [...part].reverse()).reverse()});
      return feature(geometry, {status:edge.access[d].status, edge_id:edge.id});
    }) : []);
    setSource(`runs-${d}`, visible ? route.runs.filter(run => run.direction === d).map(run => feature(displayGeometry(run.geometry), {run_id:run.id,direction:d})) : []);
  }
  setSource('events', route.events.filter(event => shown(event.direction)).map(event => feature({type:'Point',coordinates:event.coordinate},{id:event.id,status:event.status,kind:event.kind,label:event.status === 'unknown' ? '?' : '×'})));
  setSource('highlight', selectedRun && shown(selectedRun.direction) ? [feature(selectedRun.geometry)] : []);
  const endpoints: Feature[] = [];
  if (selectedRun) {
    endpoints.push(feature({type:'Point',coordinates:pointAt(selectedRun,false)},{label:'Start',kind:selectedRun.start.kind}));
    endpoints.push(feature({type:'Point',coordinates:pointAt(selectedRun,true)},{label:'End',kind:selectedRun.end.kind}));
  }
  setSource('endpoints',endpoints);
  setSource('chosen-point',selectedPoint ? [feature({type:'Point',coordinates:selectedPoint})] : []);
  writeUrl();
}
function renderDetail() {
  const el = $('path-detail');
  if (selectedEvent) {
    const event = selectedEvent;
    const streetView = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${event.coordinate[1]},${event.coordinate[0]}`;
    el.innerHTML = `<h2>${escape(eventTitle(event))}</h2><p class="detail-direction">${escape(route.direction_labels[event.direction])}</p><p>${escape(event.reason)}</p><p class="small">${event.evidence_status === 'conflicting' ? 'Conflicting sources · unresolved' : 'Source-inferred · not field-verified'}</p><div class="evidence-links">${links(event.evidence_urls)}</div><p><a href="${escape(streetView)}" target="_blank" rel="noreferrer">Inspect nearby Street View</a></p><p class="small">Check the imagery date and both approaches. Opening imagery does not verify this decision.</p>`;
    return;
  }
  if (!selectedRun) {
    el.innerHTML = route.runs.some(run => shown(run.direction))
      ? '<h2>Select a path</h2><p>Choose a continuous stretch below, or select a colored line on the map.</p>'
      : '<h2>No established car path</h2><p>Open an interruption or review point to see the restrictions and unresolved evidence.</p>';
    return;
  }
  const run = selectedRun;
  const distance = selectedPoint ? remainingDistance(run,selectedPoint) : undefined;
  const percentage = distance ? Math.round(distance.offset_m / run.length_m * 100) : 0;
  const wayUrls = route.edges.filter(edge => run.edge_ids.includes(edge.id)).flatMap(edge => edge.evidence_urls);
  el.innerHTML = `<div class="detail-heading"><h2>${escape(route.direction_labels[run.direction])} path</h2><span class="direction-dot ${run.direction}"></span></div>
    <dl class="distance-pair"><div><dt>Full mapped stretch</dt><dd>${distanceLabel(run.length_m)}</dd></div><div><dt>Remaining from selection</dt><dd id="remaining-value">${distanceLabel(distance?.remaining_m ?? run.length_m)}</dd></div></dl>
    <div class="position-control"><label for="path-position">Measure from <output id="position-value">${percentage}%</output> along this path</label><input id="path-position" type="range" min="0" max="100" step="1" value="${percentage}" aria-valuetext="${percentage}% along the path"><p class="small">Move the slider or select a point on the map.</p></div>
    <p class="small">${run.complete_within_route ? 'Complete within this mapped route, using source-inferred rules.' : 'Continuation is unresolved at one or both ends. This is not a confirmed maximum.'}</p>
    <ol class="endpoints"><li><span>Start</span><strong>${escape(boundaryTitle(run.start))}</strong><p>${escape(run.start.reason)}</p></li><li><span>End</span><strong>${escape(boundaryTitle(run.end))}</strong><p>${escape(run.end.reason)}</p></li></ol>
    <details class="path-sources"><summary>Path source records (${new Set(wayUrls).size})</summary><div class="evidence-links">${links(wayUrls)}</div></details>`;
  $<HTMLInputElement>('path-position').oninput = event => {
    const slider = event.target as HTMLInputElement;
    selectedPoint = coordinateAtFraction(run, Number(slider.value) / 100);
    $('remaining-value').textContent = distanceLabel(run.length_m * (1 - Number(slider.value) / 100));
    $('position-value').textContent = `${slider.value}%`;
    slider.setAttribute('aria-valuetext',`${slider.value}% along the path`);
    popup?.remove(); updateMap();
  };
}
function chooseRun(id: string, coordinate?: Coordinate) {
  selectedRun = route.runs.find(run => run.id === id);
  selectedEvent = undefined;
  selectedPoint = coordinate && selectedRun ? remainingDistance(selectedRun,coordinate)?.coordinate : undefined;
  if (selectedRun && !shown(selectedRun.direction)) direction = selectedRun.direction;
  popup?.remove(); render();
  if (ready && selectedRun && selectedPoint) {
    const distance = remainingDistance(selectedRun, selectedPoint)!;
    popup = new Popup({closeButton:true,maxWidth:'250px'})
      .setLngLat(selectedPoint)
      .setHTML(`<strong>${escape(route.direction_labels[selectedRun.direction])} · ${distanceLabel(distance.remaining_m)} remaining</strong><p>To the end of this source-inferred stretch. See the path details below.</p>`)
      .addTo(map!);
  }
}
function chooseEvent(id: string, fly = false) {
  selectedEvent = route.events.find(event => event.id === id);
  if (!selectedEvent) return;
  selectedRun = undefined; selectedPoint = undefined;
  if (!shown(selectedEvent.direction)) direction = selectedEvent.direction;
  render();
  if (ready) {
    popup?.remove();
    popup = new Popup({closeButton:true,maxWidth:'280px'}).setLngLat(selectedEvent.coordinate).setHTML(`<strong>${escape(eventTitle(selectedEvent))}</strong><p>${escape(selectedEvent.reason)}</p>`).addTo(map!);
    if (fly) map!.easeTo({center:selectedEvent.coordinate,zoom:Math.max(16,map!.getZoom()),duration:motionDuration()});
  }
}
function render() {
  $('map-title').textContent = `${route.name} greenway`;
  $('map-subtitle').textContent = route.extent_label;
  $('forward').textContent = route.direction_labels.forward;
  $('reverse').textContent = route.direction_labels.reverse;
  $('forward-legend').textContent = route.direction_labels.forward;
  $('reverse-legend').textContent = route.direction_labels.reverse;
  for (const d of ['both',...directions]) $(d).setAttribute('aria-pressed',String(direction === d));
  $('direction-summary').innerHTML = directions.map(d => {
    const run = longestRun(route,d);
    return `<button class="direction-summary-row ${d}" data-longest="${d}" ${run ? '' : 'disabled'}><span><i class="direction-dot ${d}"></i>${escape(route.direction_labels[d])}</span><strong>${run ? distanceLabel(run.length_m) : 'No mapped path'}</strong></button>`;
  }).join('');
  document.querySelectorAll<HTMLButtonElement>('[data-longest]').forEach(button => button.onclick = () => { const run = longestRun(route,button.dataset.longest as Direction); if (run) chooseRun(run.id); });
  const coverage = route.coverage;
  $('coverage').textContent = `${distanceLabel(coverage.designated_m)} designated · ${distanceLabel(coverage.unknown_m)} unmatched geometry · ${coverage.unknown_connections} ${coverage.unknown_connections === 1 ? 'connection' : 'connections'} unresolved. Distances are source-inferred, not verified maxima.`;
  const runs = route.runs.filter(run => shown(run.direction));
  $('run-count').textContent = String(runs.length);
  $('run-list').innerHTML = runs.length ? runs.map(run => `<button class="run-row ${run.direction}" data-run="${escape(run.id)}" aria-pressed="${selectedRun?.id === run.id}"><span class="run-row-heading"><span>${escape(route.direction_labels[run.direction])}</span><strong>${distanceLabel(run.length_m)}</strong></span><span class="small">${escape(boundaryTitle(run.end))}</span></button>`).join('') : '<p class="small empty-message">No continuous car path is established in this direction. Inspect the restrictions and unknown links below.</p>';
  document.querySelectorAll<HTMLButtonElement>('[data-run]').forEach(button => button.onclick = () => chooseRun(button.dataset.run!));
  const events = route.events.filter(event => shown(event.direction));
  $('event-count').textContent = String(events.length);
  $('event-list').innerHTML = events.length ? events.map(event => `<button class="event-row" data-event="${escape(event.id)}"><strong>${escape(eventTitle(event))}</strong><span>${escape(route.direction_labels[event.direction])} · ${escape(event.reason)}</span></button>`).join('') : '<p class="small">No interruption is encoded for this route. Field review is still needed.</p>';
  document.querySelectorAll<HTMLButtonElement>('[data-event]').forEach(button => button.onclick = () => chooseEvent(button.dataset.event!,true));
  $('evidence-records').innerHTML = evidence.filter(record => evidenceAppliesToRoute(record,route)).map(record => `<details><summary>${escape(record.location)}</summary><p>${escape(record.source_inference)}</p><p><strong>Review needed:</strong> ${escape(record.review_needed)}</p>${record.sources.map(source => `<p>${links([source.url])}<br>${escape(source.source_date ?? 'Date unverified')} · ${escape(source.status)}<br><span class="small">${escape(source.scope)}</span></p>`).join('')}</details>`).join('');
  renderDetail(); updateMap(); writeUrl();
}
function motionDuration() { return matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450; }
function fitPadding() { return matchMedia('(max-width: 800px)').matches ? {top:120,bottom:110,left:30,right:30} : {top:130,bottom:80,left:50,right:50}; }
function fitRoute() { if (map && route) map.fitBounds(route.bounds,{padding:fitPadding(),duration:motionDuration(),maxZoom:16}); }
// Runs are oriented in travel direction, so both drawn traces sit left of
// their own centerline. Measure clicks against that visible, offset trace.
function screenDistance(run: Run, point: {x: number; y: number}) {
  let closest = Infinity;
  for (const part of lines(run.geometry)) {
    for (let i = 1; i < part.length; i++) {
      const a = map!.project(part[i - 1]);
      const b = map!.project(part[i]);
      const dx = b.x - a.x, dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      if (!length) continue;
      const x = a.x + 4 * dy / length;
      const y = a.y - 4 * dx / length;
      const t = Math.max(0, Math.min(1, ((point.x - x) * dx + (point.y - y) * dy) / (length * length)));
      closest = Math.min(closest, Math.hypot(point.x - x - t * dx, point.y - y - t * dy));
    }
  }
  return closest;
}
function chooseRoute(id: string, fit = true) {
  const next = data.routes.find(item => item.id === id); if (!next) return;
  route = next; $('route-picker').setAttribute('aria-label',`Greenway route: ${route.name}`);
  $<HTMLSelectElement>('route-picker').value = route.id;
  selectedRun = undefined; selectedEvent = undefined; selectedPoint = undefined; popup?.remove();
  render(); if (fit) fitRoute();
  $('announcement').textContent = `${route.name}: ${route.extent_label}. Source-inferred driving access.`;
}

function addMapLayers() {
  if (!map) return;
  for (const name of ['all-routes','selected-route','edges-forward','edges-reverse','runs-forward','runs-reverse','highlight','events','endpoints','chosen-point']) map.addSource(name,{type:'geojson',data:empty()});
  map.addLayer({id:'all-routes-line',source:'all-routes',type:'line',paint:{'line-color':'#8b9c90','line-width':3,'line-opacity':0.6}});
  map.addLayer({id:'selected-route-line',source:'selected-route',type:'line',paint:{'line-color':'#fff','line-width':18}});
  const canvas = document.createElement('canvas'); canvas.width = 24; canvas.height = 24;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(6,4);ctx.lineTo(18,12);ctx.lineTo(6,20);ctx.lineTo(9,12);ctx.closePath();ctx.fill();
  map.addImage('travel-arrow',ctx.getImageData(0,0,24,24));
  for (const d of directions) {
    const offset = -4; // Both edge and run geometries follow their travel direction.
    map.addLayer({id:`edges-${d}`,source:`edges-${d}`,type:'line',layout:{'line-cap':'butt','line-join':'round'},paint:{'line-color':['match',['get','status'],'allowed',colors[d],'blocked',colors.blocked,colors.unknown],'line-width':6,'line-offset':offset}});
    map.addLayer({id:`unknown-${d}`,source:`edges-${d}`,type:'line',filter:['==',['get','status'],'unknown'],paint:{'line-color':'#fff','line-width':2,'line-offset':offset,'line-dasharray':[1,2]}});
    map.addLayer({id:`restricted-${d}`,source:`edges-${d}`,type:'line',filter:['==',['get','status'],'blocked'],paint:{'line-color':'#fff','line-width':1.5,'line-offset':offset,'line-dasharray':[0.3,3]}});
    map.addLayer({id:`run-hit-${d}`,source:`runs-${d}`,type:'line',paint:{'line-width':16,'line-opacity':0,'line-offset':-4}});
    map.addLayer({id:`arrows-${d}`,source:`runs-${d}`,type:'symbol',layout:{'symbol-placement':'line','symbol-spacing':65,'icon-image':'travel-arrow','icon-size':0.5,'icon-rotation-alignment':'map','icon-allow-overlap':true,'icon-ignore-placement':true,'icon-offset':[0,-8],'icon-keep-upright':false}});
  }
  map.addLayer({id:'highlight-outline',source:'highlight',type:'line',paint:{'line-color':'#17362f','line-width':2,'line-dasharray':[3,2]}});
  map.addLayer({id:'events-dot',source:'events',type:'circle',paint:{'circle-radius':6,'circle-color':['case',['==',['get','status'],'unknown'],colors.unknown,colors.blocked],'circle-stroke-color':'#fff','circle-stroke-width':2}});
  map.addLayer({id:'events-label',source:'events',type:'symbol',layout:{'text-field':['get','label'],'text-size':13,'text-allow-overlap':false},paint:{'text-color':'#fff'}});
  map.addLayer({id:'endpoints-dot',source:'endpoints',type:'circle',paint:{'circle-radius':7,'circle-color':'#fff','circle-stroke-color':'#17362f','circle-stroke-width':2}});
  map.addLayer({id:'endpoints-label',source:'endpoints',type:'symbol',layout:{'text-field':['get','label'],'text-size':12,'text-offset':[0,1.5],'text-allow-overlap':true},paint:{'text-color':'#17362f','text-halo-color':'#fff','text-halo-width':2}});
  map.addLayer({id:'chosen-point',source:'chosen-point',type:'circle',paint:{'circle-radius':6,'circle-color':'#17362f','circle-stroke-color':'#fff','circle-stroke-width':3}});
  ready = true;
  setSource('all-routes',data.routes.map(item => feature(item.geometry,{route_id:item.id})));
  updateMap();
  map.on('click',(event: MapMouseEvent) => {
    const events = map!.queryRenderedFeatures(event.point,{layers:['events-dot']});
    if (events.length) { chooseEvent(String(events[0].properties.id)); return; }
    const candidates = map!.queryRenderedFeatures(event.point,{layers:['run-hit-forward','run-hit-reverse']});
    if (candidates.length) {
      const unique = [...new Set(candidates.map(item => String(item.properties.run_id)))];
      const point: Coordinate = [event.lngLat.lng,event.lngLat.lat];
      const closest = unique.map(id => route.runs.find(run => run.id === id)!).filter(Boolean).map(run => ({run,distance:screenDistance(run,event.point)})).sort((a,b) => a.distance - b.distance);
      if (closest[0]) chooseRun(closest[0].run.id,point);
      return;
    }
    const other = map!.queryRenderedFeatures(event.point,{layers:['all-routes-line']})[0];
    if (other) chooseRoute(String(other.properties.route_id));
  });
  map.on('mousemove',event => { const hit = map!.queryRenderedFeatures(event.point,{layers:['events-dot','run-hit-forward','run-hit-reverse','all-routes-line']}); map!.getCanvas().style.cursor = hit.length ? 'pointer' : ''; });
}
async function loadInventory() {
  try {
    const pointer = await fetch('/current.json').then(response => response.json());
    const tileUrl = new URL(`/tile-chunks/${pointer.build_id}`,location.origin).href;
    const index: ChunkIndex = await fetch(`${tileUrl}/index.json`).then(response => response.json());
    const protocol = new Protocol(); addProtocol('pmtiles',protocol.tile);
    protocol.add(new PMTiles(new StaticTileSource(tileUrl,index),new SharedPromiseCache(16)));
    map!.addSource('city-inventory',{type:'vector',url:`pmtiles://${tileUrl}`,attribution:'Bike routes: City of Chicago · © OpenStreetMap contributors'});
    map!.addLayer({id:'city-inventory-line',source:'city-inventory','source-layer':'greenways',type:'line',paint:{'line-color':'#94a29a','line-width':2,'line-opacity':0.35}},'all-routes-line');
  } catch { notify('Citywide background could not load. Pilot routes and their details are still available.'); }
}
async function start() {
  try {
    const response = await fetch('/routes/pilot.json');
    if (!response.ok) throw new Error('Route data could not be loaded.');
    data = await response.json();
    if (data.schema_version !== 1 || !Array.isArray(data.routes) || !data.routes.length) throw new Error('Route data has an unsupported format.');
    const picker = $<HTMLSelectElement>('route-picker'); picker.innerHTML = '';
    const groups = new globalThis.Map<string,HTMLOptGroupElement>();
    for (const item of data.routes) {
      let group = groups.get(item.name); if (!group) { group = document.createElement('optgroup'); group.label = item.name; groups.set(item.name,group); picker.append(group); }
      const option = document.createElement('option'); option.value = item.id; option.textContent = `${item.name}: ${item.extent_label}`; group.append(option);
    }
    picker.disabled = false;
    $('dates').textContent = `Road snapshot: ${data.source.osm_date}. Official designation: ${data.source.designation_date}. No field-reviewed movement decisions in this pilot.`;
    const defaultRoute = data.routes.filter(item => item.name === 'Wood').sort((a,b) => b.coverage.designated_m - a.coverage.designated_m)[0] ?? data.routes[0];
    chooseRoute(data.routes.some(item => item.id === query.get('route')) ? query.get('route')! : defaultRoute.id,false);
    const initialRun = route.runs.find(run => run.id === query.get('run'));
    if (initialRun) {
      const position = Number(query.get('position'));
      const point = query.has('position') && Number.isFinite(position) && position >= 0 && position <= 1 ? coordinateAtFraction(initialRun,position) : undefined;
      chooseRun(initialRun.id,point);
    }
    if (route.events.some(event => event.id === query.get('event'))) chooseEvent(query.get('event')!);
    fetch('/routes/review-evidence.json').then(response => response.ok ? response.json() : {records:[]}).then(value => { evidence = value.records ?? []; render(); }).catch(() => {});
    setWorkerUrl(workerUrl); setWorkerCount(2);
    const position = query.get('map')?.split(',').map(Number);
    const valid = position?.length === 3 && position.every(Number.isFinite) && position[0] >= 8 && position[0] <= 19 && position[1] > 41 && position[1] < 43 && position[2] > -89 && position[2] < -87;
    map = new LibreMap({container:'map',style:'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',center:valid ? [position![2],position![1]] : [-87.6723,41.902],zoom:valid ? position![0] : 14,bounds:valid ? undefined : route.bounds,fitBoundsOptions:{padding:fitPadding()},minZoom:8,maxZoom:19,renderWorldCopies:false,maxTileCacheSize:64,maxTileCacheZoomLevels:3,attributionControl:{compact:true}});
    map.addControl(new NavigationControl({showCompass:false}),'top-right'); map.addControl(new ScaleControl({unit:'imperial'}),'bottom-left');
    map.on('load',() => { addMapLayers(); if (selectedEvent) chooseEvent(selectedEvent.id); void loadInventory(); });
    map.on('moveend',writeUrl);
    map.on('error',() => notify('Some basemap tiles could not load. Route details remain available.'));
    $('fit-route').removeAttribute('disabled'); $('fit-pilots').removeAttribute('disabled');
  } catch (error) {
    $('map-title').textContent = 'Route data unavailable';
    $('path-detail').innerHTML = '<h2>Unable to load routes</h2><p>Reload the page to try again.</p><button id="retry">Reload routes</button>';
    $('retry').onclick = () => location.reload(); notify(String(error));
  }
}
$<HTMLSelectElement>('route-picker').onchange = event => chooseRoute((event.target as HTMLSelectElement).value);
document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach(button => button.onclick = () => {
  direction = button.dataset.direction as DirectionView;
  if (selectedRun && !shown(selectedRun.direction)) { selectedRun = undefined; selectedPoint = undefined; }
  if (selectedEvent && !shown(selectedEvent.direction)) selectedEvent = undefined;
  popup?.remove(); render();
});
$('fit-route').onclick = fitRoute;
$('fit-pilots').onclick = () => { if (!map) return; const bounds = data.routes.flatMap(item => item.bounds); map.fitBounds([[Math.min(...bounds.map(p=>p[0])),Math.min(...bounds.map(p=>p[1]))],[Math.max(...bounds.map(p=>p[0])),Math.max(...bounds.map(p=>p[1]))]],{padding:70,duration:motionDuration()}); };
$('share').onclick = async () => { try { writeUrl(); await navigator.clipboard.writeText(location.href); $('share').textContent='Link copied'; setTimeout(()=>$('share').textContent='Copy link',1800); } catch { notify('Copy the browser address to share this route and direction.'); } };
void start();
